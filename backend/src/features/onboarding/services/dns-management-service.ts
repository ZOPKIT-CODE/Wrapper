// AWS SDK v3 (Route 53) - explicit dist-cjs path for ESM resolution (Node 22)
import {
  Route53Client,
  ChangeResourceRecordSetsCommand,
  ListResourceRecordSetsCommand,
  GetChangeCommand,
  ListHostedZonesCommand,
} from '@aws-sdk/client-route-53/dist-cjs/index.js';
import { db } from '../../../db/index.js';
import { tenants } from '../../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

type Route53ClientInstance = InstanceType<typeof Route53Client>;

class DNSManagementService {
  private route53: Route53ClientInstance | null;
  private hostedZoneId: string | undefined;
  private _baseDomain: string;
  private serverTarget: string;
  private _recordTypes: { SUBDOMAIN: string; CUSTOM_DOMAIN: string; VERIFICATION: string };

  /** Public access for route handlers */
  get baseDomain(): string {
    return this._baseDomain;
  }
  get recordTypes(): { SUBDOMAIN: string; CUSTOM_DOMAIN: string; VERIFICATION: string } {
    return this._recordTypes;
  }

  constructor() {
    this.route53 = null;
    this.hostedZoneId = process.env.AWS_HOSTED_ZONE_ID;
    this._baseDomain = process.env.BASE_DOMAIN || 'myapp.com';
    this.serverTarget = process.env.SERVER_TARGET || this._baseDomain;

    this._recordTypes = {
      SUBDOMAIN: 'A',
      CUSTOM_DOMAIN: 'CNAME',
      VERIFICATION: 'TXT'
    };

    this.initializeAWS();
  }

  async initializeAWS(): Promise<void> {
    try {
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        this.route53 = new Route53Client({
          region: process.env.AWS_REGION || 'us-east-1',
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          },
        });
        console.log('✅ AWS Route 53 initialized successfully');
      } else {
        console.log('⚠️ AWS credentials not configured, using mock DNS service');
      }
    } catch (err: unknown) {
      const error = err as Error;
      console.warn('⚠️ AWS SDK not available, using mock DNS service:', error.message);
    }
  }

  /**
   * Create subdomain for tenant
   */
  async createTenantSubdomain(tenantId: string, customTarget: string | null = null): Promise<Record<string, unknown>> {
    try {
      console.log(`🏢 Creating subdomain for tenant: ${tenantId}`);

      // Get tenant details
      const tenant = await db
        .select({
          tenantId: tenants.tenantId,
          companyName: tenants.companyName,
          subdomain: tenants.subdomain
        })
        .from(tenants)
        .where(eq(tenants.tenantId, tenantId))
        .limit(1);

      if (tenant.length === 0) {
        throw new Error('Tenant not found');
      }

      let subdomain = tenant[0].subdomain;
      let isExisting = false;

      if (subdomain) {
        // Tenant already has a subdomain in database
        console.log(`📋 Tenant already has subdomain in database: ${subdomain}`);
        isExisting = true;
      } else {
        // Generate new unique subdomain
        subdomain = await this.generateUniqueSubdomain(tenant[0].companyName);
        console.log(`🔧 Generated new subdomain: ${subdomain}`);
      }

      // Create DNS record (this will handle existing records gracefully)
      const targetValue = this.serverTarget;
      const dnsResult = await this.createDNSRecord(
        `${subdomain}.${this._baseDomain}`,
        this._recordTypes.SUBDOMAIN,
        targetValue
      );

      // Update tenant record with subdomain if not already set
      if (!tenant[0].subdomain) {
        await db.update(tenants)
          .set({
            subdomain,
            updatedAt: new Date()
          })
          .where(eq(tenants.tenantId, tenantId));

        console.log(`✅ Subdomain set in database: ${subdomain}.${this.baseDomain} → ${targetValue}`);
      } else {
        console.log(`✅ Subdomain already exists: ${subdomain}.${this.baseDomain} → ${targetValue}`);
      }

      return {
        success: true,
        subdomain,
        fullDomain: `${subdomain}.${this._baseDomain}`,
        target: targetValue,
        dnsChangeId: dnsResult.changeId,
        tenantId,
        isExisting
      };

    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Subdomain creation failed:', error);
      throw new Error(`Subdomain creation failed: ${error.message}`);
    }
  }

  /**
   * Setup custom domain for tenant
   */
  async setupCustomDomain(tenantId: string, customDomain: string): Promise<Record<string, unknown>> {
    try {
      console.log(`🔧 Setting up custom domain: ${customDomain} for tenant: ${tenantId}`);

      // Validate domain format
      if (!this.isValidDomain(customDomain)) {
        throw new Error('Invalid domain format');
      }

      // Check if domain is already in use
      const existingTenant = await db
        .select({ tenantId: tenants.tenantId, companyName: tenants.companyName })
        .from(tenants)
        .where(eq(tenants.customDomain, customDomain))
        .limit(1);

      if (existingTenant.length > 0) {
        throw new Error(`Domain already assigned to ${existingTenant[0].companyName}`);
      }

      // Generate verification token
      const verificationToken = this.generateVerificationToken();

      // Create verification TXT record
      const verificationDomain = `_verify.${customDomain}`;
      await this.createDNSRecord(
        verificationDomain,
        this._recordTypes.VERIFICATION,
        `"${verificationToken}"`
      );

      // Store verification request (you might want to add a verification_requests table)
      const verificationRequest = {
        tenantId,
        customDomain,
        verificationToken,
        verificationDomain,
        status: 'pending',
        createdAt: new Date()
      };
      void verificationRequest;

      console.log(`✅ Verification setup complete for: ${customDomain}`);
      console.log(`📝 TXT Record: ${verificationDomain} = "${verificationToken}"`);

      return {
        success: true,
        status: 'verification_required',
        customDomain,
        verificationDomain,
        verificationToken,
        instructions: [
          `Add TXT record: ${verificationDomain}`,
          `Value: "${verificationToken}"`,
          `TTL: 300`,
          'Then call the verification endpoint'
        ]
      };

    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Custom domain setup failed:', error);
      throw new Error(`Custom domain setup failed: ${error.message}`);
    }
  }

  /**
   * Verify domain ownership
   */
  async verifyDomainOwnership(tenantId: string, customDomain: string): Promise<Record<string, unknown>> {
    try {
      console.log(`🔍 Verifying domain ownership: ${customDomain}`);

      // Get stored verification data (from your verification_requests table)
      const verificationData = await this.getVerificationData(tenantId, customDomain);

      if (!verificationData) {
        throw new Error('No verification request found for this domain');
      }

      // Check if TXT record exists with correct value
      const verification = verificationData as { verificationDomain: string; verificationToken: string; instructions?: unknown };
      const isVerified = await this.checkTXTRecord(
        verification.verificationDomain,
        verification.verificationToken
      );

      if (!isVerified) {
        return {
          success: false,
          verified: false,
          message: 'TXT record not found or incorrect value',
          instructions: verification.instructions
        };
      }

      // Create CNAME record for the domain
      const cnameResult = await this.createDNSRecord(
        customDomain,
        this._recordTypes.CUSTOM_DOMAIN,
        this.serverTarget
      );

      // Update tenant record
      await db.update(tenants)
        .set({
          customDomain,
          updatedAt: new Date()
        })
        .where(eq(tenants.tenantId, tenantId));

      // Clean up verification record
      await this.deleteDNSRecord(verification.verificationDomain, this._recordTypes.VERIFICATION);

      console.log(`✅ Domain verified and configured: ${customDomain}`);

      return {
        success: true,
        verified: true,
        customDomain,
        cnameChangeId: cnameResult.changeId,
        message: 'Domain successfully verified and configured'
      };

    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Domain verification failed:', error);
      throw new Error(`Domain verification failed: ${error.message}`);
    }
  }

  /**
   * Check if TXT record exists with correct value
   */
  async checkTXTRecord(domain: string, expectedValue: string): Promise<boolean> {
    try {
      console.log(`🔍 Checking TXT record: ${domain} = "${expectedValue}"`);

      // Use DNS lookup to check TXT record
      const dns = require('dns').promises;

      try {
        const records = await dns.resolveTxt(domain);

        // Flatten the records array and check for our value
        const txtValues = records.flat();

        // Remove quotes from expected value for comparison
        const cleanExpectedValue = expectedValue.replace(/"/g, '');

        const hasCorrectValue = txtValues.some((value: string) =>
          value.replace(/"/g, '') === cleanExpectedValue
        );

        console.log(`📋 Found TXT values:`, txtValues);
        console.log(`✅ TXT record ${hasCorrectValue ? 'verified' : 'not found'}`);

        return hasCorrectValue;

      } catch (dnsErr: unknown) {
        const dnsError = dnsErr as Error;
        console.log(`❌ DNS lookup failed for ${domain}:`, dnsError.message);
        return false;
      }

    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ TXT record check failed:', error);
      return false;
    }
  }

  /**
   * Create DNS record in Route 53
   */
  async createDNSRecord(domain: string, type: string, value: string): Promise<Record<string, unknown>> {
    // Ensure AWS is initialized
    if (!this.route53) {
      await this.initializeAWS();
    }

    // If AWS SDK is not available, return mock response
    if (!this.route53) {
      console.log(`🔄 Mock DNS record creation: ${domain} (${type}) → ${value}`);
      return {
        changeId: 'mock-change-id-' + Date.now(),
        status: 'INSYNC',
        domain,
        type,
        value,
        isMock: true
      };
    }

    const params = {
      HostedZoneId: this.hostedZoneId,
      ChangeBatch: {
        Comment: `DNS record for domain: ${domain}`,
        Changes: [{
          Action: 'UPSERT',
          ResourceRecordSet: {
            Name: domain.endsWith('.') ? domain : `${domain}.`,
            Type: type,
            TTL: 300,
            ResourceRecords: [{
              Value: value
            }]
          }
        }]
      }
    };

    try {
      // AWS SDK dist-cjs types may expect 0 args; input is passed at runtime
      const result = (await this.route53!.send(new (ChangeResourceRecordSetsCommand as new (input: unknown) => InstanceType<typeof ChangeResourceRecordSetsCommand>)(params))) as {
        ChangeInfo: { Id: string; Status: string };
      };

      console.log(`✅ DNS record upserted: ${domain} (${type}) → ${value}`);
      console.log(`   Change ID: ${result.ChangeInfo.Id}`);

      return {
        changeId: result.ChangeInfo.Id,
        status: result.ChangeInfo.Status,
        domain,
        type,
        value
      };

    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ DNS record creation failed:', error);
      throw new Error(`DNS record creation failed: ${error.message}`);
    }
  }

  /**
   * Delete DNS record from Route 53
   */
  async deleteDNSRecord(domain: string, type: string): Promise<Record<string, unknown>> {
    try {
      console.log(`🗑️ Deleting DNS record: ${domain} (${type})`);

      // Get current record first
      const currentRecord = await this.getDNSRecord(domain, type);

      if (!currentRecord) {
        console.warn(`⚠️ DNS record not found: ${domain}`);
        return { deleted: false, reason: 'Record not found' };
      }

      if (!this.route53) {
        return { deleted: false, reason: 'Route53 not initialized' };
      }

      const params = {
        HostedZoneId: this.hostedZoneId,
        ChangeBatch: {
          Comment: `Delete DNS record: ${domain}`,
          Changes: [{
            Action: 'DELETE',
            ResourceRecordSet: {
              Name: domain,
              Type: type,
              TTL: currentRecord.TTL,
              ResourceRecords: currentRecord.ResourceRecords
            }
          }]
        }
      };

      const result = (await this.route53.send(new (ChangeResourceRecordSetsCommand as new (input: unknown) => InstanceType<typeof ChangeResourceRecordSetsCommand>)(params))) as {
        ChangeInfo: { Id: string };
      };

      console.log(`✅ DNS record deleted: ${domain}`);

      return {
        deleted: true,
        changeId: result.ChangeInfo.Id,
        domain,
        type
      };

    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ DNS record deletion failed:', error);
      throw new Error(`DNS record deletion failed: ${error.message}`);
    }
  }

  /**
   * Get DNS record from Route 53
   */
  async getDNSRecord(domain: string, type: string): Promise<{ Name?: string; Type?: string; TTL?: number; ResourceRecords?: { Value: string }[] } | null> {
    if (!this.route53) return null;
    const params = {
      HostedZoneId: this.hostedZoneId,
      StartRecordName: domain.endsWith('.') ? domain : `${domain}.`,
      StartRecordType: type,
      MaxItems: 1
    };

    try {
      const result = (await this.route53.send(new (ListResourceRecordSetsCommand as new (input: unknown) => InstanceType<typeof ListResourceRecordSetsCommand>)(params))) as {
        ResourceRecordSets?: { Name?: string; Type?: string; TTL?: number; ResourceRecords?: { Value: string }[] }[];
      };

      const record = (result.ResourceRecordSets || []).find(
        (r: { Name?: string; Type?: string }) => r.Name === (domain.endsWith('.') ? domain : `${domain}.`) && r.Type === type
      );

      return record || null;

    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error getting DNS record:', error);
      return null;
    }
  }

  /**
   * Generate unique subdomain
   */
  async generateUniqueSubdomain(companyName: string): Promise<string> {
    const baseSubdomain = companyName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 15);

    let subdomain = baseSubdomain;
    let counter = 0;
    let isUnique = false;

    while (!isUnique && counter < 100) {
      const existing = await db
        .select({ tenantId: tenants.tenantId })
        .from(tenants)
        .where(eq(tenants.subdomain, subdomain))
        .limit(1);

      if (existing.length === 0) {
        isUnique = true;
      } else {
        counter++;
        subdomain = `${baseSubdomain}${counter}`;
      }
    }

    if (!isUnique) {
      // Fallback to UUID-based subdomain
      subdomain = `tenant-${crypto.randomBytes(4).toString('hex')}`;
    }

    return subdomain;
  }

  /**
   * Generate verification token
   */
  generateVerificationToken() {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Validate domain format
   */
  isValidDomain(domain: string): boolean {
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domain);
  }

  /**
   * Get verification data (placeholder - implement based on your storage)
   */
  async getVerificationData(tenantId: string, customDomain: string): Promise<Record<string, unknown>> {
    // This should retrieve from your verification_requests table
    // For now, return a placeholder structure
    return {
      tenantId,
      customDomain,
      verificationToken: 'placeholder-token',
      verificationDomain: `_verify.${customDomain}`,
      instructions: [
        'Add TXT record to your DNS',
        'Wait for propagation (may take up to 24 hours)',
        'Call verification endpoint'
      ]
    };
  }

  /**
   * Get DNS change status
   */
  async getChangeStatus(changeId: string): Promise<Record<string, unknown>> {
    try {
      if (!this.route53) throw new Error('Route53 not initialized');
      const result = (await this.route53.send(new (GetChangeCommand as new (input: unknown) => InstanceType<typeof GetChangeCommand>)({ Id: changeId }))) as {
        ChangeInfo: { Status: string; SubmittedAt?: Date; Comment?: string };
      };

      return {
        changeId,
        status: result.ChangeInfo.Status,
        submittedAt: result.ChangeInfo.SubmittedAt,
        comment: result.ChangeInfo.Comment || ''
      };

    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ Error getting change status:', error);
      throw new Error(`Failed to get change status: ${error.message}`);
    }
  }

  /**
   * Health check for DNS service
   */
  async healthCheck() {
    try {
      // Ensure AWS is initialized
      if (!this.route53) {
        await this.initializeAWS();
      }

      // If AWS SDK is not available, return mock health status
      if (!this.route53) {
        return {
          status: 'healthy',
          service: 'Mock DNS Service',
          hostedZoneId: this.hostedZoneId || 'mock-zone-id',
          baseDomain: this.baseDomain,
          serverTarget: this.serverTarget,
          zonesAvailable: 1,
          isMock: true,
          timestamp: new Date().toISOString()
        };
      }

      // Test connectivity by listing hosted zones
      const zones = (await this.route53.send(new (ListHostedZonesCommand as new (input: unknown) => InstanceType<typeof ListHostedZonesCommand>)({ MaxItems: 1 }))) as {
        HostedZones?: unknown[];
      };

      return {
        status: 'healthy',
        service: 'Route53',
        hostedZoneId: this.hostedZoneId,
        baseDomain: this.baseDomain,
        serverTarget: this.serverTarget,
        zonesAvailable: zones.HostedZones?.length || 0,
        timestamp: new Date().toISOString()
      };

    } catch (err: unknown) {
      const error = err as Error;
      return {
        status: 'unhealthy',
        service: 'Route53',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get tenant domains
   */
  async getTenantDomains(tenantId: string): Promise<Record<string, unknown>> {
    const tenant = await db
      .select({
        tenantId: tenants.tenantId,
        companyName: tenants.companyName,
        subdomain: tenants.subdomain,
        customDomain: tenants.customDomain
      })
      .from(tenants)
      .where(eq(tenants.tenantId, tenantId))
      .limit(1);

    if (tenant.length === 0) {
      throw new Error('Tenant not found');
    }

    const tenantData = tenant[0];

    return {
      tenantId: tenantData.tenantId,
      companyName: tenantData.companyName,
      subdomain: tenantData.subdomain
        ? `${tenantData.subdomain}.${this.baseDomain}`
        : null,
      customDomain: tenantData.customDomain,
      serverTarget: this.serverTarget,
      baseDomain: this.baseDomain
    };
  }
}

export default new DNSManagementService();
