import { eq, and, desc, count, ne } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  tenants,
  tenantInvitations,
  subscriptions,
  tenantUsers,
  customRoles,
  userRoleAssignments,
  organizationMemberships,
  entities,
  auditLogs
} from '../db/schema/index.js';
import { v4 as uuidv4 } from 'uuid';
import { kindeService } from '../features/auth/index.js';
import { getEmailProvider } from '../features/notifications/adapters/brevo-adapter.js';
import { SubscriptionService } from '../features/subscriptions/index.js';
import { sql } from 'drizzle-orm';
import { inArray } from 'drizzle-orm';
import { amazonMQPublisher } from '../features/messaging/utils/amazon-mq-publisher.js';
import { TenantRepository } from './tenant-repository.js';

type CreateTenantData = {
  companyName: string;
  subdomain: string;
  kindeOrgId: string;
  adminEmail: string;
  companySize?: string;
  organizationSize?: string;
  industry?: string;
  timezone?: string;
  country?: string;
  kindeUserId: string;
  adminFirstName?: string;
  adminLastName?: string;
};

export class TenantService {
  // Create a new tenant
  static async createTenant(data: CreateTenantData): Promise<{ tenant: typeof tenants.$inferSelect; adminRole: typeof customRoles.$inferSelect; adminUser: typeof tenantUsers.$inferSelect }> {
    const tenantId = uuidv4();
    const adminUserId = uuidv4();
    
    try {
      const result = await db.transaction(async (tx) => {
        // 1. Create tenant (tenants schema uses organizationSize, not companySize)
        const [tenant] = await tx.insert(tenants).values({
          tenantId,
          companyName: data.companyName,
          subdomain: data.subdomain,
          kindeOrgId: data.kindeOrgId,
          adminEmail: data.adminEmail,
          organizationSize: data.organizationSize ?? data.companySize ?? undefined,
          industry: data.industry,
          defaultTimeZone: data.timezone || 'UTC',
          onboardedAt: new Date(),
        }).returning();

        // 2. Create admin user with Kinde ID (must be provided)
        if (!data.kindeUserId) {
          throw new Error('kindeUserId is required for tenant creation');
        }

        const [adminUser] = await tx.insert(tenantUsers).values({
          userId: adminUserId,
          tenantId,
          kindeUserId: data.kindeUserId,
          email: data.adminEmail,
          name: `${data.adminFirstName} ${data.adminLastName}`,
          isVerified: true,
          isActive: true,
          isTenantAdmin: true,
          onboardingCompleted: false,
        }).returning();

        // 3. Create default admin role with proper createdBy reference
        const [adminRole] = await tx.insert(customRoles).values({
          tenantId,
          roleName: 'Administrator',
          description: 'Full access to all features and settings',
          permissions: this.getDefaultAdminPermissions(),
          restrictions: {},
          isSystemRole: true,
          isDefault: true,
          priority: 100,
          createdBy: adminUserId,
        }).returning();

        // 4. Assign admin role to admin user
        await tx.insert(userRoleAssignments).values({
          userId: adminUserId,
          roleId: adminRole.roleId,
          assignedBy: adminUserId, // Self-assigned during setup
        });

        return { tenant, adminRole, adminUser };
      });

      // 5. Create default subscription (trial) after transaction commits
      await SubscriptionService.createTrialSubscription(tenantId);

      return result;
    } catch (error) {
      console.error('Failed to create tenant:', error);
      throw new Error('Tenant creation failed');
    }
  }

  // Get tenant by subdomain
  static async getBySubdomain(subdomain: string): Promise<Record<string, unknown> | null> {
    return TenantRepository.getBySubdomain(subdomain);
  }

  // Get tenant by Kinde org ID
  static async getByKindeOrgId(kindeOrgId: string): Promise<Record<string, unknown> | null> {
    return TenantRepository.getByKindeOrgId(kindeOrgId);
  }

  // Get tenant details with subscription info
  static async getTenantDetails(tenantId: string): Promise<Record<string, unknown>> {
    try {
      const [tenant] = await db
        .select({
          tenantId: tenants.tenantId,
          companyName: tenants.companyName,
          subdomain: tenants.subdomain,
          kindeOrgId: tenants.kindeOrgId,
          adminEmail: tenants.adminEmail,
          isActive: tenants.isActive,
          isVerified: tenants.isVerified,
          createdAt: tenants.createdAt,
          updatedAt: tenants.updatedAt,
          // Company Information
          legalCompanyName: tenants.legalCompanyName,
          logoUrl: tenants.logoUrl,
          companyType: tenants.companyType,
          industry: tenants.industry,
          website: tenants.website,
          organizationSize: tenants.organizationSize,
          // Contact Details
          billingEmail: tenants.billingEmail,
          supportEmail: tenants.supportEmail,
          contactSalutation: tenants.contactSalutation,
          contactMiddleName: tenants.contactMiddleName,
          contactDepartment: tenants.contactDepartment,
          contactJobTitle: tenants.contactJobTitle,
          contactDirectPhone: tenants.contactDirectPhone,
          contactMobilePhone: tenants.contactMobilePhone,
          contactPreferredContactMethod: tenants.contactPreferredContactMethod,
          contactAuthorityLevel: tenants.contactAuthorityLevel,
          preferredContactMethod: tenants.preferredContactMethod,
          phone: tenants.phone,
          // Mailing Address
          mailingAddressSameAsRegistered: tenants.mailingAddressSameAsRegistered,
          mailingStreet: tenants.mailingStreet,
          mailingCity: tenants.mailingCity,
          mailingState: tenants.mailingState,
          mailingZip: tenants.mailingZip,
          mailingCountry: tenants.mailingCountry,
          // Billing Address
          billingStreet: tenants.billingStreet,
          billingCity: tenants.billingCity,
          billingState: tenants.billingState,
          billingZip: tenants.billingZip,
          billingCountry: tenants.billingCountry,
          // Banking & Financial Information
          bankName: tenants.bankName,
          bankBranch: tenants.bankBranch,
          accountHolderName: tenants.accountHolderName,
          accountNumber: tenants.accountNumber,
          accountType: tenants.accountType,
          bankAccountCurrency: tenants.bankAccountCurrency,
          swiftBicCode: tenants.swiftBicCode,
          iban: tenants.iban,
          routingNumberUs: tenants.routingNumberUs,
          sortCodeUk: tenants.sortCodeUk,
          ifscCodeIndia: tenants.ifscCodeIndia,
          bsbNumberAustralia: tenants.bsbNumberAustralia,
          paymentTerms: tenants.paymentTerms,
          creditLimit: tenants.creditLimit,
          preferredPaymentMethod: tenants.preferredPaymentMethod,
          // Tax & Compliance
          taxRegistered: tenants.taxRegistered,
          vatGstRegistered: tenants.vatGstRegistered,
          gstin: tenants.gstin,
          taxRegistrationDetails: tenants.taxRegistrationDetails,
          taxResidenceCountry: tenants.taxResidenceCountry,
          taxExemptStatus: tenants.taxExemptStatus,
          taxExemptionCertificateNumber: tenants.taxExemptionCertificateNumber,
          taxExemptionExpiryDate: tenants.taxExemptionExpiryDate,
          withholdingTaxApplicable: tenants.withholdingTaxApplicable,
          withholdingTaxRate: tenants.withholdingTaxRate,
          taxTreatyCountry: tenants.taxTreatyCountry,
          w9StatusUs: tenants.w9StatusUs,
          w8FormTypeUs: tenants.w8FormTypeUs,
          reverseChargeMechanism: tenants.reverseChargeMechanism,
          vatGstRateApplicable: tenants.vatGstRateApplicable,
          regulatoryComplianceStatus: tenants.regulatoryComplianceStatus,
          industrySpecificLicenses: tenants.industrySpecificLicenses,
          dataProtectionRegistration: tenants.dataProtectionRegistration,
          professionalIndemnityInsurance: tenants.professionalIndemnityInsurance,
          insurancePolicyNumber: tenants.insurancePolicyNumber,
          insuranceExpiryDate: tenants.insuranceExpiryDate,
          // Localization
          defaultLanguage: tenants.defaultLanguage,
          defaultLocale: tenants.defaultLocale,
          defaultCurrency: tenants.defaultCurrency,
          defaultTimeZone: tenants.defaultTimeZone,
          fiscalYearStartMonth: tenants.fiscalYearStartMonth,
          fiscalYearEndMonth: tenants.fiscalYearEndMonth,
          fiscalYearStartDay: tenants.fiscalYearStartDay,
          fiscalYearEndDay: tenants.fiscalYearEndDay,
          // Branding
          primaryColor: tenants.primaryColor,
          customDomain: tenants.customDomain,
          brandingConfig: tenants.brandingConfig,
          // Settings
          settings: tenants.settings,
          onboardedAt: tenants.onboardedAt
        })
        .from(tenants)
        .where(eq(tenants.tenantId, tenantId))
        .limit(1);

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      // Get subscription info
      let subscription = null;
      try {
        subscription = await SubscriptionService.getCurrentSubscription(tenantId);
      } catch (error) {
        console.warn('Could not fetch subscription for tenant:', tenantId);
      }

      // Get user count
      const userCount = await db
        .select({ count: count() })
        .from(tenantUsers)
        .where(eq(tenantUsers.tenantId, tenantId));

      // Get admin user
      const [adminUser] = await db
        .select()
        .from(tenantUsers)
        .where(and(
          eq(tenantUsers.tenantId, tenantId),
          eq(tenantUsers.isTenantAdmin, true)
        ))
        .limit(1);

      const tenantObj = tenant as Record<string, unknown>;
      const sub = subscription as { status?: string; plan?: string } | null;
      return {
        ...tenantObj,
        subscription,
        userCount: userCount[0]?.count || 0,
        adminUser: adminUser || null,
        isFullyOnboarded: Boolean(tenant.onboardedAt && adminUser?.onboardingCompleted),
        subscriptionStatus: sub?.status ?? 'none'
      } as Record<string, unknown>;
    } catch (error) {
      console.error('Error getting tenant details:', error);
      throw error;
    }
  }

  // Check if organization needs onboarding completion
  static async getOnboardingStatus(tenantId: string): Promise<Record<string, unknown>> {
    try {
      const tenant = await this.getTenantDetails(tenantId) as Record<string, unknown>;
      
      const needsOnboarding = !tenant.isFullyOnboarded;
      const hasSubscription = tenant.subscription && (tenant.subscription as { status?: string })?.status !== 'none';
      
      return {
        needsOnboarding,
        hasSubscription,
        onboardedAt: tenant.onboardedAt,
        subscriptionStatus: tenant.subscriptionStatus,
        currentPlan: (tenant.subscription as { plan?: string } | null)?.plan || 'none',
        userCount: tenant.userCount,
        canCreateSubscription: !needsOnboarding,
        adminUser: tenant.adminUser
      };
    } catch (error) {
      console.error('Error getting onboarding status:', error);
      throw error;
    }
  }

  // Update tenant onboarding completion
  static async markOnboardingComplete(tenantId: string, userId: string): Promise<{ success: boolean; completedAt: Date; message: string }> {
    try {
      // Mark tenant as onboarded
      await db
        .update(tenants)
        .set({
          onboardedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(tenants.tenantId, tenantId));

      // Mark user onboarding as complete
      await db
        .update(tenantUsers)
        .set({
          onboardingCompleted: true,
          onboardingStep: 'completed',
          updatedAt: new Date()
        })
        .where(eq(tenantUsers.userId, userId));

      return {
        success: true,
        completedAt: new Date(),
        message: 'Onboarding completed successfully'
      };
    } catch (error) {
      console.error('Error marking onboarding complete:', error);
      throw error;
    }
  }

  // Update tenant settings
  static async updateTenant(tenantId: string, updates: Record<string, unknown>): Promise<typeof tenants.$inferSelect | undefined> {
    return TenantRepository.updateTenantById(tenantId, updates);
  }

  // Invite user to tenant
  static async inviteUser(data: {
    tenantId: string;
    email: string;
    roleId?: string | null;
    invitedBy: string;
    entities?: Array<{ entityId?: string; roleId?: string | null; entityType?: string | null; membershipType?: string }>;
    primaryEntityId?: string | null;
    message?: string;
  }): Promise<typeof tenantInvitations.$inferSelect> {
    const invitationToken = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    try {
      // Check if user already exists
      const existingUser = await db
        .select()
        .from(tenantUsers)
        .where(and(
          eq(tenantUsers.tenantId, data.tenantId),
          eq(tenantUsers.email, data.email)
        ))
        .limit(1);

      if (existingUser.length > 0) {
        throw new Error('User is already a member of this organization');
      }

      // Normalize multi-entity payload if present
      let invitationScope = 'tenant';
      let targetEntities: Array<{ entityId?: string; roleId?: string | null; entityType?: string | null; membershipType?: string }> = [];
      let primaryEntityId: string | null = null;

      if (Array.isArray(data.entities) && data.entities.length > 0) {
        invitationScope = 'multi-entity';
        targetEntities = data.entities
          .filter((entity: { entityId?: string }) => entity?.entityId)
          .map((entity: { entityId?: string; roleId?: string | null; entityType?: string | null; membershipType?: string }) => ({
            entityId: entity.entityId,
            roleId: entity.roleId || null,
            entityType: entity.entityType || null,
            membershipType: entity.membershipType || 'direct'
          }));

        primaryEntityId = data.primaryEntityId || targetEntities[0]?.entityId || null;
      } else if (data.primaryEntityId) {
        invitationScope = 'organization';
        primaryEntityId = data.primaryEntityId;
      } else if (data.roleId) {
        invitationScope = 'tenant';
      }

      // Generate invitation URL with proper environment detection
      let baseUrl = process.env.INVITATION_BASE_URL || process.env.FRONTEND_URL;
      
      // In development, default to localhost:3001 if no URL is set
      if (!baseUrl || baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
        if (process.env.NODE_ENV === 'production') {
          // In production, use zopkit.com as fallback if no env var is set
          baseUrl = process.env.BASE_URL || 'https://zopkit.com';
        } else {
          // In development, use localhost
          baseUrl = 'http://localhost:3001';
        }
      }
      
      const invitationUrl = `${baseUrl}/invite/accept?token=${invitationToken}`;
      
      // Ensure we always have a valid URL
      if (!invitationUrl || !invitationUrl.startsWith('http')) {
        throw new Error(`Invalid invitation URL generated: ${invitationUrl}`);
      }
      
      console.log('🔗 Generated invitation URL in TenantService:', {
        invitationUrl,
        baseUrl,
        env: {
          INVITATION_BASE_URL: process.env.INVITATION_BASE_URL,
          FRONTEND_URL: process.env.FRONTEND_URL,
          BASE_URL: process.env.BASE_URL,
          NODE_ENV: process.env.NODE_ENV
        }
      });

      // Create invitation
      console.log('💾 Saving invitation to database with URL:', {
        email: data.email,
        invitationToken: invitationToken.substring(0, 8) + '...',
        invitationUrl,
        invitationScope,
        hasUrl: !!invitationUrl
      });
      
      const invitationValues = {
        tenantId: data.tenantId,
        email: data.email,
        roleId: data.roleId ?? null,
        invitedBy: data.invitedBy,
        invitationToken,
        invitationUrl,
        expiresAt,
        invitationScope,
        primaryEntityId,
        targetEntities: JSON.parse(JSON.stringify(targetEntities)),
      };
      const [invitation] = await db.insert(tenantInvitations).values(invitationValues).returning();
      
      console.log('✅ Invitation saved to database:', {
        invitationId: invitation.invitationId,
        email: invitation.email,
        storedUrl: invitation.invitationUrl,
        hasStoredUrl: !!invitation.invitationUrl
      });

      // Get tenant and role details for email
      const tenant = await this.getTenantDetails(data.tenantId);
      const [role] = data.roleId
        ? await db.select().from(customRoles).where(eq(customRoles.roleId, data.roleId)).limit(1)
        : [undefined];

      // Get inviter's name
      const [inviter] = await db
        .select()
        .from(tenantUsers)
        .where(eq(tenantUsers.userId, data.invitedBy))
        .limit(1);

      // Send invitation email
      console.log(`📧 Preparing to send invitation email to ${data.email}`);
      try {
        const roleName = role?.roleName || 'Member';

        // Get organization and location names for the email
        let organizations = [];
        let locations = [];

        if (Array.isArray(targetEntities) && targetEntities.length > 0) {
          for (const entity of targetEntities) {
            if (entity.entityId) {
              const [entityRecord] = await db
                .select({
                  entityId: entities.entityId,
                  entityName: entities.entityName,
                  entityType: entities.entityType
                })
                .from(entities)
                .where(eq(entities.entityId, entity.entityId))
                .limit(1);

              if (entityRecord) {
                if (entityRecord.entityType === 'organization') {
                  organizations.push(entityRecord.entityName);
                } else if (entityRecord.entityType === 'location') {
                  locations.push(entityRecord.entityName);
                }
              }
            }
          }
        } else if (primaryEntityId) {
          // For single-entity invitations, get the entity name
          const [entityRecord] = await db
            .select({
              entityName: entities.entityName,
              entityType: entities.entityType
            })
            .from(entities)
            .where(eq(entities.entityId, primaryEntityId))
            .limit(1);

          if (entityRecord) {
            if (entityRecord.entityType === 'organization') {
              organizations.push(entityRecord.entityName);
            } else if (entityRecord.entityType === 'location') {
              locations.push(entityRecord.entityName);
            }
          }
        }

        console.log(`📧 Email details:`, {
          email: data.email,
          tenantName: tenant.companyName,
          roleName,
          invitationToken: invitationToken.substring(0, 8) + '...',
          invitedByName: inviter?.name || 'Team Administrator',
          hasMessage: !!data.message,
          organizations: organizations.length,
          locations: locations.length,
          invitedDate: invitation.createdAt,
          expiryDate: invitation.expiresAt
        });

        const emailResult = await getEmailProvider().sendUserInvitation({
          email: data.email,
          tenantName: (tenant as { companyName: string }).companyName,
          roleName,
          invitationToken,
          invitedByName: inviter?.name || 'Team Administrator',
          message: data.message,
          invitedDate: invitation.createdAt ?? undefined,
          expiryDate: invitation.expiresAt ? (typeof invitation.expiresAt === 'string' ? invitation.expiresAt : invitation.expiresAt.toISOString()) : undefined,
          organizations: organizations.length > 0 ? organizations : undefined,
          locations: locations.length > 0 ? locations : undefined,
        });

        console.log(`✅ Invitation email sent successfully to ${data.email}:`, emailResult);
      } catch (err: unknown) {
        const emailError = err as Error & { response?: { data?: unknown } };
        console.error(`❌ Failed to send invitation email to ${data.email}:`, {
          error: emailError.message,
          stack: emailError.stack,
          response: emailError.response?.data
        });

        // Don't fail the entire invitation process if email fails
        // The invitation is still created and can be resent later
        console.log(`⚠️ Invitation created but email failed. Token: ${invitationToken}`);

        // You might want to queue this for retry or notify admins
        // For now, we'll continue with the invitation creation
      }

      return invitation;
    } catch (error) {
      console.error('Failed to invite user:', error);
      throw error;
    }
  }

  // Accept invitation
  static async acceptInvitation(
    invitationToken: string,
    kindeUserId: string,
    userData: { email: string; name?: string; avatar?: string }
  ): Promise<typeof tenantUsers.$inferSelect> {
    try {
      return await db.transaction(async (tx) => {
        // Get invitation
        const [invitation] = await tx
          .select()
          .from(tenantInvitations)
          .where(and(
            eq(tenantInvitations.invitationToken, invitationToken),
            eq(tenantInvitations.status, 'pending')
          ))
          .limit(1);

        if (!invitation) {
          throw new Error('Invalid or expired invitation');
        }

        if (invitation.expiresAt < new Date()) {
          throw new Error('Invitation has expired');
        }

        // Create user
        const [user] = await tx.insert(tenantUsers).values({
          tenantId: invitation.tenantId,
          kindeUserId,
          email: userData.email,
          name: userData.name ?? userData.email,
          avatar: userData.avatar ?? null,
          isVerified: true,
        }).returning();

        // Collect role assignments so we can publish role_assigned to other apps after commit
        const roleAssignmentsToPublish = [];

        // Assign role if available
        if (invitation.roleId) {
          const [mainAssignment] = await tx.insert(userRoleAssignments).values({
            userId: user.userId,
            roleId: invitation.roleId,
            assignedBy: invitation.invitedBy,
          }).returning();
          if (mainAssignment) {
            roleAssignmentsToPublish.push(mainAssignment);
          }
        }

        // Handle multi-entity or scoped invitations
        const targetEntitiesList = Array.isArray(invitation.targetEntities) ? invitation.targetEntities : [];
        if (targetEntitiesList.length > 0) {
          for (const entity of targetEntitiesList as Array<{ entityId?: string; roleId?: string | null; entityType?: string | null; membershipType?: string }>) {
            if (!entity.entityId) continue;

            await tx.insert(organizationMemberships).values({
              userId: user.userId,
              tenantId: invitation.tenantId,
              entityId: entity.entityId,
              entityType: entity.entityType || 'organization',
              roleId: entity.roleId || invitation.roleId,
              membershipType: entity.membershipType || 'direct',
              membershipStatus: 'active',
              isPrimary: invitation.primaryEntityId === entity.entityId,
              canAccessSubEntities: true,
              invitedBy: invitation.invitedBy,
              invitedAt: invitation.createdAt,
              joinedAt: new Date(),
              createdBy: invitation.invitedBy,
              createdAt: new Date(),
              updatedAt: new Date()
            });

            // Assign scoped role if provided
            if (entity.roleId) {
              const [scopedAssignment] = await tx.insert(userRoleAssignments).values({
                userId: user.userId,
                roleId: entity.roleId,
                assignedBy: invitation.invitedBy,
                organizationId: entity.entityType === 'organization' ? entity.entityId : null,
                locationId: entity.entityType === 'location' ? entity.entityId : null,
                scope: entity.entityType === 'location' ? 'location' : 'organization'
              }).returning();
              if (scopedAssignment) {
                roleAssignmentsToPublish.push(scopedAssignment);
              }
            }
          }
        } else if (invitation.primaryEntityId) {
          // Legacy single-entity invitation - create membership and scoped role
          await tx.insert(organizationMemberships).values({
            userId: user.userId,
            tenantId: invitation.tenantId,
            entityId: invitation.primaryEntityId,
            entityType: 'organization',
            roleId: invitation.roleId,
            membershipType: 'direct',
            membershipStatus: 'active',
            isPrimary: true,
            canAccessSubEntities: true,
            invitedBy: invitation.invitedBy,
            invitedAt: invitation.createdAt,
            joinedAt: new Date(),
            createdBy: invitation.invitedBy,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }

        // Update user's primary organization if specified
        if (invitation.primaryEntityId) {
          await tx
            .update(tenantUsers)
            .set({
              primaryOrganizationId: invitation.primaryEntityId,
              updatedAt: new Date()
            })
            .where(eq(tenantUsers.userId, user.userId));

          // Publish organization assignment created event (async, don't wait)
          setImmediate(async () => {
            try {
              const { OrganizationAssignmentService } = await import('../features/organizations/services/organization-assignment-service.js');

              // Get organization details for event
              const primaryId = invitation.primaryEntityId;
              const [organization] = primaryId
                ? await db
                    .select({
                      entityId: entities.entityId,
                      entityName: entities.entityName,
                      entityCode: entities.entityCode
                    })
                    .from(entities)
                    .where(and(
                      eq(entities.entityId, primaryId),
                      eq(entities.tenantId, invitation.tenantId)
                    ))
                    .limit(1)
                : [];

              if (organization) {
                const assignmentData = {
                  assignmentId: `${user.userId}_${invitation.primaryEntityId}_${Date.now()}`,
                  tenantId: invitation.tenantId,
                  userId: user.userId,
                  organizationId: invitation.primaryEntityId,
                  organizationCode: organization.entityCode,
                  assignmentType: 'primary',
                  isActive: true,
                  assignedAt: new Date().toISOString(),
                  priority: 1,
                  assignedBy: invitation.invitedBy,
                  metadata: {
                    source: 'invitation_acceptance',
                    invitationId: invitation.invitationId
                  }
                };

                await OrganizationAssignmentService.publishOrgAssignmentCreated(assignmentData);
                console.log(`📡 Published organization assignment created event for user ${user.email} via invitation`);
              }
            } catch (err: unknown) {
              const publishError = err as Error;
              console.error('❌ [EVENT-DROPPED] Failed to publish org assignment event:', publishError.message);
            }
          });
        }

        // Update invitation status
        await tx
          .update(tenantInvitations)
          .set({
            status: 'accepted',
            acceptedAt: new Date(),
          })
          .where(eq(tenantInvitations.invitationId, invitation.invitationId));

        // Trigger Kinde organization assignment asynchronously (best effort)
        const tenant = await this.getTenantDetails(invitation.tenantId) as { kindeOrgId?: string };
        if (tenant?.kindeOrgId && kindeService?.addUserToOrganization) {
          kindeService.addUserToOrganization(kindeUserId, tenant.kindeOrgId, { exclusive: true })
            .then((result: { success?: boolean; error?: string; message?: string }) => {
              if (!result?.success) {
                console.warn('⚠️ Kinde org assignment reported failure:', result?.error || result?.message);
              }
            })
            .catch((err: unknown) => {
              const e = err as Error;
              console.warn('⚠️ Failed to assign user to Kinde organization:', e.message);
            });
        }

        // Publish user creation event to Amazon MQ for suite sync
        try {
          // Split name into firstName and lastName for CRM requirements
          const nameParts = (user.name || '').split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';
          
          await amazonMQPublisher.publishUserEventToSuite('user_created', invitation.tenantId, user.userId, {
            userId: user.userId,
            email: user.email,
            kindeUserId: user.kindeUserId,
            firstName: firstName,
            lastName: lastName,
            name: user.name || `${firstName} ${lastName}`.trim(),
            isActive: user.isActive !== undefined ? user.isActive : true,
            createdAt: user.createdAt ? (typeof user.createdAt === 'string' ? user.createdAt : user.createdAt.toISOString()) : new Date().toISOString()
          });
          console.log('📡 Published user_created event to Amazon MQ');
        } catch (err: unknown) {
          const streamError = err as Error;
          console.error('❌ [EVENT-DROPPED] Failed to publish user_created event:', streamError.message);
        }

        // Publish role_assigned for each role so other apps get the role (after transaction commits)
        if (roleAssignmentsToPublish.length > 0) {
          const tenantId = invitation.tenantId;
          const userId = user.userId;
          const assignedBy = invitation.invitedBy;
          const assignments = roleAssignmentsToPublish;
          setImmediate(async () => {
            try {
              for (const a of assignments) {
                await amazonMQPublisher.publishRoleEventToSuite('role_assigned', tenantId, a.roleId, {
                  assignmentId: a.id,
                  userId,
                  roleId: a.roleId,
                  assignedAt: a.assignedAt ? (typeof a.assignedAt === 'string' ? a.assignedAt : a.assignedAt.toISOString()) : new Date().toISOString(),
                  assignedBy,
                  expiresAt: (a as { expiresAt?: Date | string }).expiresAt,
                  entityId: (a as { organizationId?: string }).organizationId
                });
              }
              console.log('📡 Published role_assigned events for invitation acceptance:', assignments.length);
            } catch (err: unknown) {
              const publishError = err as Error;
              console.error('❌ [EVENT-DROPPED] Failed to publish role_assigned events:', publishError.message);
            }
          });
        }

        return user;
      });
    } catch (error) {
      console.error('Failed to accept invitation:', error);
      throw error;
    }
  }

  // Get pending invitations
  static async getPendingInvitations(tenantId: string) {
    return await db
      .select({
        invitation: tenantInvitations,
        role: customRoles,
      })
      .from(tenantInvitations)
      .leftJoin(customRoles, eq(tenantInvitations.roleId, customRoles.roleId))
      .where(and(
        eq(tenantInvitations.tenantId, tenantId),
        eq(tenantInvitations.status, 'pending')
      ))
      .orderBy(desc(tenantInvitations.createdAt));
  }

  // Resend invitation email
  static async resendInvitationEmail(invitationId: string, tenantId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Get invitation details
      const [invitation] = await db
        .select()
        .from(tenantInvitations)
        .where(and(
          eq(tenantInvitations.invitationId, invitationId),
          eq(tenantInvitations.tenantId, tenantId),
          eq(tenantInvitations.status, 'pending')
        ))
        .limit(1);

      if (!invitation) {
        throw new Error('Invitation not found or not pending');
      }

      // Check if invitation has expired
      if (invitation.expiresAt < new Date()) {
        throw new Error('Invitation has expired');
      }

      // Get tenant and role details
      const tenant = await this.getTenantDetails(tenantId);
      const [role] = invitation.roleId
        ? await db.select().from(customRoles).where(eq(customRoles.roleId, invitation.roleId)).limit(1)
        : [undefined];

      // Get inviter's name
      const [inviter] = await db
        .select()
        .from(tenantUsers)
        .where(eq(tenantUsers.userId, invitation.invitedBy))
        .limit(1);

      // Send invitation email (tenant_invitations has no message column; use empty string)
      const roleRow = role as { roleName?: string } | undefined;
      await getEmailProvider().sendUserInvitation({
        email: invitation.email,
        tenantName: (tenant as { companyName: string }).companyName,
        roleName: roleRow?.roleName ?? 'Member',
        invitationToken: invitation.invitationToken,
        invitedByName: inviter?.name ?? 'Team Administrator',
        message: '',
        invitedDate: invitation.createdAt ?? undefined,
        expiryDate: invitation.expiresAt ?? undefined,
      });

      // Update invitation with new expiry (extend by 7 days)
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await db
        .update(tenantInvitations)
        .set({ 
          expiresAt: newExpiresAt,
          updatedAt: new Date()
        })
        .where(eq(tenantInvitations.invitationId, invitationId));

      console.log(`✅ Invitation email resent successfully to ${invitation.email}`);
      return { success: true, message: 'Invitation email resent successfully' };

    } catch (error) {
      console.error('Failed to resend invitation email:', error);
      throw error;
    }
  }

  // Get default admin permissions
  static getDefaultAdminPermissions() {
    return {
      crm: {
        contacts: ['view', 'create', 'edit', 'delete', 'export', 'import'],
        deals: ['view', 'create', 'edit', 'delete', 'approve', 'reject'],
        reports: ['view', 'create', 'export', 'share', 'schedule'],
        settings: ['view', 'edit', 'manage_users'],
        dashboard: ['view', 'customize']
      },
      hr: {
        employees: ['view', 'create', 'edit', 'delete', 'view_salary'],
        payroll: ['view', 'process', 'approve', 'export'],
        documents: ['view', 'upload', 'delete', 'approve'],
        reports: ['view', 'create', 'export'],
        settings: ['view', 'edit']
      },
      affiliate: {
        partners: ['view', 'create', 'edit', 'delete', 'approve'],
        commissions: ['view', 'calculate', 'approve', 'pay', 'dispute'],
        analytics: ['view', 'export', 'create_reports'],
        settings: ['view', 'edit']
      },
      accounting: {
        dashboard: ['view', 'customize', 'export'],
        general_ledger: ['read', 'create', 'update', 'delete', 'post', 'approve', 'close_period', 'export'],
        chart_of_accounts: ['read', 'create', 'update', 'delete', 'import', 'export'],
        journal_entries: ['read', 'create', 'update', 'delete', 'post', 'approve', 'reverse', 'export'],
        invoices: ['read', 'read_all', 'create', 'update', 'delete', 'send', 'post', 'export', 'import', 'generate_pdf'],
        customers: ['read', 'read_all', 'create', 'update', 'delete', 'export', 'import'],
        credit_notes: ['read', 'create', 'update', 'delete', 'apply', 'export'],
        sales_orders: ['read', 'read_all', 'create', 'update', 'delete', 'approve', 'convert', 'export'],
        estimates: ['read', 'create', 'update', 'delete', 'send', 'convert', 'export', 'generate_pdf'],
        bills: ['read', 'read_all', 'create', 'update', 'delete', 'pay', 'approve', 'export'],
        vendors: ['read', 'read_all', 'create', 'update', 'delete', 'export', 'import'],
        purchase_orders: ['read', 'read_all', 'create', 'update', 'delete', 'approve', 'receive', 'export'],
        expense_reports: ['read', 'read_all', 'create', 'update', 'delete', 'approve', 'reimburse', 'export'],
        vendor_credits: ['read', 'create', 'update', 'delete', 'apply', 'export'],
        banking: ['read', 'read_all', 'create', 'update', 'delete', 'reconcile', 'import_feeds', 'transfer', 'export'],
        tax: ['read', 'create', 'update', 'delete', 'configure', 'file_returns', 'reconcile', 'export'],
        reports: ['read', 'read_all', 'create', 'export', 'schedule', 'generate_pdf'],
        analytics: ['read', 'read_all', 'create', 'export', 'schedule', 'customize_dashboards'],
        budgeting: ['read', 'read_all', 'create', 'update', 'delete', 'approve', 'forecast', 'export'],
        cost_accounting: ['read', 'read_all', 'create', 'update', 'delete', 'allocate', 'export'],
        fixed_assets: ['read', 'read_all', 'create', 'update', 'delete', 'depreciate', 'dispose', 'transfer', 'export'],
        payroll: ['read', 'read_all', 'create', 'update', 'delete', 'run', 'approve', 'view_salary', 'export'],
        projects: ['read', 'read_all', 'create', 'update', 'delete', 'track_time', 'bill', 'allocate_resources', 'export'],
        inventory: ['read', 'read_all', 'create', 'update', 'delete', 'adjust', 'movement', 'count', 'export', 'import'],
        multi_entity: ['read', 'read_all', 'create', 'update', 'delete', 'consolidate', 'inter_company', 'manage_currency', 'export'],
        compliance: ['read', 'read_all', 'create', 'update', 'delete', 'manage_controls', 'manage_risks', 'audit_trail', 'export'],
        workflows: ['read', 'read_all', 'create', 'update', 'delete', 'approve', 'manage_templates', 'export'],
        documents: ['read', 'read_all', 'create', 'update', 'delete', 'download', 'export'],
        integrations: ['read', 'create', 'update', 'delete', 'manage_api_keys', 'manage_webhooks', 'sync', 'export'],
        ai_insights: ['read', 'read_all', 'generate', 'export', 'configure'],
        security: ['read', 'configure', 'manage_mfa', 'manage_sso', 'manage_policies', 'view_threats', 'manage_alerts', 'export'],
        performance: ['read', 'manage_cache', 'manage_jobs', 'configure_alerts', 'export'],
        notifications: ['read', 'update', 'manage_preferences'],
        system: [
          'settings_read', 'settings_update',
          'users_read', 'users_read_all', 'users_create', 'users_update', 'users_delete', 'users_activate', 'users_reset_password', 'users_export', 'users_import',
          'roles_read', 'roles_read_all', 'roles_create', 'roles_update', 'roles_delete', 'roles_assign', 'roles_export',
          'audit_read', 'audit_read_all', 'audit_export',
          'tenant_config_read', 'tenant_config_update',
          'credit_config_view', 'credit_config_edit',
          'backup_create', 'backup_restore',
          'dropdowns_read', 'dropdowns_manage',
          'fiscal_year_manage', 'sequences_manage',
          'wrapper_sync'
        ]
      },
      admin: {
        users: ['view', 'create', 'edit', 'delete', 'invite'],
        roles: ['view', 'create', 'edit', 'delete'],
        billing: ['view', 'manage'],
        settings: ['view', 'edit'],
        audit: ['view', 'export']
      }
    };
  }

  // Deactivate tenant
  static async deactivateTenant(tenantId: string, reason: string): Promise<typeof tenants.$inferSelect | undefined> {
    const updated = await TenantRepository.deactivateTenant(tenantId, reason);

    // Also deactivate all users
    await db
      .update(tenantUsers)
      .set({ isActive: false })
      .where(eq(tenantUsers.tenantId, tenantId));

    return updated;
  }

  // Reactivate tenant
  static async reactivateTenant(tenantId: string): Promise<typeof tenants.$inferSelect | undefined> {
    return TenantRepository.reactivateTenant(tenantId);
  }

  // Get tenant users with consolidated invitation data
  static async getTenantUsers(tenantId: string): Promise<Array<Record<string, unknown>>> {
    try {
      console.log('🔍 Getting users for tenant:', tenantId);
      
      // Get active users
      const activeUsers = await db
        .select({
          userId: tenantUsers.userId,
          tenantId: tenantUsers.tenantId,
          kindeUserId: tenantUsers.kindeUserId,
          email: tenantUsers.email,
          name: tenantUsers.name,
          avatar: tenantUsers.avatar,
          title: tenantUsers.title,
          department: tenantUsers.department,
          isActive: tenantUsers.isActive,
          isVerified: tenantUsers.isVerified,
          isTenantAdmin: tenantUsers.isTenantAdmin,
          invitedAt: tenantUsers.invitedAt,
          lastActiveAt: tenantUsers.lastActiveAt,
          lastLoginAt: tenantUsers.lastLoginAt,
          loginCount: tenantUsers.loginCount,
          preferences: tenantUsers.preferences,
          onboardingCompleted: tenantUsers.onboardingCompleted,
          onboardingStep: tenantUsers.onboardingStep,
          createdAt: tenantUsers.createdAt,
          updatedAt: tenantUsers.updatedAt
        })
        .from(tenantUsers)
        .where(eq(tenantUsers.tenantId, tenantId))
        .orderBy(desc(tenantUsers.createdAt));

      // Get pending invitations
      const pendingInvitations = await db
        .select({
          invitationId: tenantInvitations.invitationId,
          tenantId: tenantInvitations.tenantId,
          email: tenantInvitations.email,
          roleId: tenantInvitations.roleId,
          invitedBy: tenantInvitations.invitedBy,
          invitationToken: tenantInvitations.invitationToken,
          invitationUrl: tenantInvitations.invitationUrl,
          status: tenantInvitations.status,
          expiresAt: tenantInvitations.expiresAt,
          acceptedAt: tenantInvitations.acceptedAt,
          cancelledAt: tenantInvitations.cancelledAt,
          cancelledBy: tenantInvitations.cancelledBy,
          createdAt: tenantInvitations.createdAt,
          updatedAt: tenantInvitations.updatedAt
        })
        .from(tenantInvitations)
        .where(and(
          eq(tenantInvitations.tenantId, tenantId),
          eq(tenantInvitations.status, 'pending')
        ))
        .orderBy(desc(tenantInvitations.createdAt));

      // Get user role assignments
      const userIds = activeUsers.map(u => u.userId).filter(Boolean) as string[];
      const userRoleData: Array<{ userId: string | null; roleId: string; assignedAt: Date | null }> = userIds.length > 0 ? await db
        .select({
          userId: userRoleAssignments.userId,
          roleId: userRoleAssignments.roleId,
          assignedAt: userRoleAssignments.assignedAt
        })
        .from(userRoleAssignments)
        .where(and(
          inArray(userRoleAssignments.userId, userIds),
          eq(userRoleAssignments.isActive, true)
        )) : [];

      // Get roles for users and invitations
      const pendingInvitationsList = pendingInvitations as Array<{ roleId?: string | null }>;
      const roleIds = [
        ...(userRoleData || []).filter(ur => ur && ur.roleId).map(ur => ur.roleId),
        ...pendingInvitationsList.filter(i => i && i.roleId).map(i => i.roleId)
      ].filter(Boolean) as string[];

      const roles = roleIds.length > 0 ? await db
        .select({
          roleId: customRoles.roleId,
          roleName: customRoles.roleName,
          description: customRoles.description,
          color: customRoles.color
        })
        .from(customRoles)
        .where(inArray(customRoles.roleId, roleIds)) : [];

      const roleMap = new Map((roles || []).filter(r => r && r.roleId).map(r => [r.roleId, r]));
      const userRoleMap = new Map((userRoleData || []).filter(ur => ur && ur.userId && ur.roleId).map(ur => [ur.userId, ur.roleId]));

      // Get accepted invitations for active users (to show invitationUrl if available)
      const acceptedInvitations = await db
        .select({
          invitationId: tenantInvitations.invitationId,
          email: tenantInvitations.email,
          invitationUrl: tenantInvitations.invitationUrl,
          status: tenantInvitations.status,
          acceptedAt: tenantInvitations.acceptedAt
        })
        .from(tenantInvitations)
        .where(and(
          eq(tenantInvitations.tenantId, tenantId),
          eq(tenantInvitations.status, 'accepted')
        ));

      // Create a map of email to accepted invitation for quick lookup
      const acceptedInvitationMap = new Map(
        acceptedInvitations
          .filter(inv => inv && inv.email)
          .map(inv => [inv.email.toLowerCase(), inv])
      );

      // Format active users
      const formattedUsers = activeUsers.map(user => {
        if (!user || !user.userId || !user.email) {
          return null;
        }

        const userRoleId = userRoleMap.get(user.userId);
        const role = userRoleId ? roleMap.get(userRoleId) : null;
        
        // Check if user has an accepted invitation
        const acceptedInvitation = acceptedInvitationMap.get(user.email.toLowerCase());
        const hasAcceptedInvitation = !!acceptedInvitation;
        
        return {
          id: user.userId,
          userId: user.userId,
          email: user.email,
          firstName: user.name?.split(' ')[0] || user.email.split('@')[0],
          lastName: user.name?.split(' ').slice(1).join(' ') || '',
          role: role?.roleName || 'No role assigned',
          roleId: role?.roleId || null,
          isActive: user.isActive !== false, // Default to true if undefined
          invitationStatus: hasAcceptedInvitation ? 'accepted' : 'active',
          invitedAt: user.invitedAt || user.createdAt,
          expiresAt: null,
          lastActiveAt: user.lastActiveAt,
          invitationId: acceptedInvitation?.invitationId || null,
          invitationUrl: acceptedInvitation?.invitationUrl || null, // Include invitationUrl if available
          invitationAcceptedAt: acceptedInvitation?.acceptedAt || null,
          status: 'active',
          userType: 'active',
          originalData: {
            user: {
              userId: user.userId,
              tenantId: user.tenantId,
              kindeUserId: user.kindeUserId,
              email: user.email,
              name: user.name,
              avatar: user.avatar,
              title: user.title,
              department: user.department,
              isActive: user.isActive,
              isVerified: user.isVerified,
              isTenantAdmin: user.isTenantAdmin,
              invitedAt: user.invitedAt,
              lastActiveAt: user.lastActiveAt,
              lastLoginAt: user.lastLoginAt,
              loginCount: user.loginCount,
              preferences: user.preferences,
              onboardingCompleted: user.onboardingCompleted,
              onboardingStep: user.onboardingStep,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
              invitationUrl: acceptedInvitation?.invitationUrl || null, // Include in originalData too
              invitationAcceptedAt: acceptedInvitation?.acceptedAt || null
            },
            role: role
          }
        };
      }).filter(user => user !== null);

      // Format pending invitations
      const formattedInvitations = pendingInvitations.map(invitation => {
        if (!invitation || !invitation.invitationId || !invitation.email) {
          return null;
        }

        const role = invitation.roleId ? roleMap.get(invitation.roleId) : null;
        return {
          id: `inv_${invitation.invitationId}`,
          email: invitation.email,
          firstName: invitation.email.split('@')[0],
          lastName: '',
          role: role?.roleName || 'No role assigned',
          roleId: invitation.roleId || role?.roleId || null,
          isActive: false,
          invitationStatus: 'pending',
          invitedAt: invitation.createdAt,
          expiresAt: invitation.expiresAt,
          lastActiveAt: null,
          invitationId: invitation.invitationId,
          status: 'pending',
          userType: 'invited',
          originalData: {
            user: {
              invitationId: invitation.invitationId,
              tenantId: invitation.tenantId,
              email: invitation.email,
              roleId: invitation.roleId,
              invitedBy: invitation.invitedBy,
              invitationToken: invitation.invitationToken,
              invitationUrl: invitation.invitationUrl,
              status: invitation.status,
              expiresAt: invitation.expiresAt,
              acceptedAt: invitation.acceptedAt,
              cancelledAt: invitation.cancelledAt,
              cancelledBy: invitation.cancelledBy,
              createdAt: invitation.createdAt,
              updatedAt: invitation.updatedAt
            },
            role: role
          }
        };
      }).filter(invitation => invitation !== null);

      // Combine and return
      const allUsers: Array<Record<string, unknown>> = [...formattedUsers, ...formattedInvitations];
      
      console.log(`✅ Found ${formattedUsers.length} active users and ${formattedInvitations.length} pending invitations`);
      
      return allUsers;
    } catch (error) {
      console.error('❌ Error getting tenant users:', error);
      throw error;
    }
  }

  // Get users filtered by entity (organization/location/department)
  static async getTenantUsersByEntity(tenantId: string, entityId: string | undefined): Promise<Array<Record<string, unknown>>> {
    try {
      console.log('🔍 Getting users for tenant and entity:', { tenantId, entityId });

      // If no entityId provided, return all users
      if (!entityId) {
        console.log('📋 No entityId provided, returning all tenant users');
        return await this.getTenantUsers(tenantId);
      }

      // Get all child entities for hierarchical filtering
      const childEntities = await this.getEntityChildren(entityId);
      const allRelevantEntities = new Set([entityId, ...childEntities]);

      console.log('📋 Entity hierarchy:', {
        entityId,
        childEntities: Array.from(childEntities),
        totalRelevantEntities: allRelevantEntities.size
      });

      // Try to get users through organization memberships
      let entityUserIds = new Set();

      try {
        const memberships = await db
          .select({
            userId: organizationMemberships.userId,
            entityId: organizationMemberships.entityId,
            membershipStatus: organizationMemberships.membershipStatus,
            canAccessSubEntities: organizationMemberships.canAccessSubEntities
          })
          .from(organizationMemberships)
          .where(and(
            eq(organizationMemberships.tenantId, tenantId),
            eq(organizationMemberships.membershipStatus, 'active'),
            inArray(organizationMemberships.entityId, Array.from(allRelevantEntities))
          ));

        console.log(`📋 Found ${memberships.length} organization memberships for entity hierarchy`);

        // Collect user IDs from memberships
        memberships.forEach(membership => {
          entityUserIds.add(membership.userId);
        });

      } catch (err: unknown) {
        const membershipError = err as Error;
        console.warn('⚠️ Could not query organization memberships:', membershipError.message);
        console.log('🔄 Falling back to alternative entity-user association methods');
      }

      // If no users found through memberships, try alternative approaches
      if (entityUserIds.size === 0) {
        console.log('📋 No users found through organization memberships, trying alternative methods');

        // Method 1: Check if users have this entity as their primary organization
        try {
          const primaryOrgUsers = await db
            .select({ userId: tenantUsers.userId })
            .from(tenantUsers)
            .where(and(
              eq(tenantUsers.tenantId, tenantId),
              eq(tenantUsers.primaryOrganizationId, entityId)
            ));

          primaryOrgUsers.forEach(user => entityUserIds.add(user.userId));
          console.log(`📋 Found ${primaryOrgUsers.length} users with this entity as primary organization`);
        } catch (err: unknown) {
          const primaryError = err as Error;
          console.warn('⚠️ Could not check primary organizations:', primaryError.message);
        }

        // Method 2: Check tenant invitations that target this entity
        try {
          const invitationUsers = await db
            .select({ invitedBy: tenantInvitations.invitedBy })
            .from(tenantInvitations)
            .where(and(
              eq(tenantInvitations.tenantId, tenantId),
              sql`(${tenantInvitations.targetEntities}::jsonb) ? (${entityId})`
            ));

          // Add the users who were invited to this entity
          for (const invitation of invitationUsers) {
            if (invitation.invitedBy) {
              // Also add the invited users by finding them through the invitation
              const invitedUsers = await db
                .select({ userId: tenantUsers.userId })
                .from(tenantUsers)
                .where(and(
                  eq(tenantUsers.tenantId, tenantId),
                  eq(tenantUsers.email, invitation.invitedBy) // This might not be correct, but it's a fallback
                ));

              invitedUsers.forEach(user => entityUserIds.add(user.userId));
            }
          }
        } catch (err: unknown) {
          const invitationError = err as Error;
          console.warn('⚠️ Could not check tenant invitations:', invitationError.message);
        }
      }

      // If we still have no users, return all users as fallback
      if (entityUserIds.size === 0) {
        console.log('⚠️ No users found for entity, returning all tenant users as fallback');
        return await this.getTenantUsers(tenantId);
      }

      console.log(`📊 Found ${entityUserIds.size} users associated with entity ${entityId}`);

      // Ensure we have valid user IDs before querying
      const validUserIds: string[] = Array.from(entityUserIds).filter((id): id is string => typeof id === 'string' && id.length > 0);
      if (validUserIds.length === 0) {
        console.log('⚠️ No valid user IDs found for entity, returning all tenant users as fallback');
        return await this.getTenantUsers(tenantId);
      }

      console.log(`📋 Querying ${validUserIds.length} valid user IDs`);

      // Get the actual user data for these users
      let users: Array<Record<string, unknown>> = [];
      try {
        const usersResult = await db
          .select({
            userId: tenantUsers.userId,
            tenantId: tenantUsers.tenantId,
            kindeUserId: tenantUsers.kindeUserId,
            email: tenantUsers.email,
            name: tenantUsers.name,
            avatar: tenantUsers.avatar,
            title: tenantUsers.title,
            department: tenantUsers.department,
            isActive: tenantUsers.isActive,
            isVerified: tenantUsers.isVerified,
            isTenantAdmin: tenantUsers.isTenantAdmin,
            invitedAt: tenantUsers.invitedAt,
            lastActiveAt: tenantUsers.lastActiveAt,
            lastLoginAt: tenantUsers.lastLoginAt,
            loginCount: tenantUsers.loginCount,
            preferences: tenantUsers.preferences,
            onboardingCompleted: tenantUsers.onboardingCompleted,
            onboardingStep: tenantUsers.onboardingStep,
            createdAt: tenantUsers.createdAt,
            updatedAt: tenantUsers.updatedAt,
            primaryOrganizationId: tenantUsers.primaryOrganizationId
          })
          .from(tenantUsers)
          .where(and(
            eq(tenantUsers.tenantId, tenantId),
            inArray(tenantUsers.userId, validUserIds)
          ))
          .orderBy(desc(tenantUsers.createdAt));

        users = usersResult as unknown as Array<Record<string, unknown>>;
        console.log(`✅ Successfully retrieved ${users.length} users from database`);
      } catch (userQueryError) {
        console.error('❌ Error querying users from database:', userQueryError);
        console.log('🔄 Falling back to all tenant users');
        return await this.getTenantUsers(tenantId);
      }

      // Get roles for these users (only if we have users)
      let userRoles: Array<{ userId: string | null; roleId: string; roleName: string | null; roleDescription: string | null; roleColor: string | null; rolePermissions: unknown }> = [];
      if (users.length > 0) {
        const userIdsForRoles = users.map(u => u.userId).filter((id): id is string => id != null && typeof id === 'string');
        if (userIdsForRoles.length > 0) {
          try {
            userRoles = await db
              .select({
                userId: userRoleAssignments.userId,
                roleId: userRoleAssignments.roleId,
                roleName: customRoles.roleName,
                roleDescription: customRoles.description,
                roleColor: customRoles.color,
                rolePermissions: customRoles.permissions
              })
              .from(userRoleAssignments)
              .leftJoin(customRoles, eq(userRoleAssignments.roleId, customRoles.roleId))
              .where(inArray(userRoleAssignments.userId, userIdsForRoles));

            console.log(`✅ Successfully retrieved ${userRoles.length} role assignments from database`);
          } catch (roleQueryError) {
            console.error('❌ Error querying user roles from database:', roleQueryError);
            userRoles = [];
          }
        }
      }

      // Get pending invitations for this entity
      let pendingInvitations: Array<typeof tenantInvitations.$inferSelect> = [];
      try {
        pendingInvitations = await db
          .select()
          .from(tenantInvitations)
          .where(and(
            eq(tenantInvitations.tenantId, tenantId),
            eq(tenantInvitations.status, 'pending'),
            sql`(${tenantInvitations.targetEntities}::jsonb) ? (${entityId})`
          ));

        console.log(`✅ Successfully retrieved ${pendingInvitations.length} pending invitations from database`);
      } catch (invitationQueryError) {
        console.error('❌ Error querying pending invitations from database:', invitationQueryError);
        pendingInvitations = [];
      }

      // Create role map
      const roleMap = new Map();
      try {
        (userRoles || []).forEach(ur => {
            if (ur && ur.roleId) {
            roleMap.set(ur.roleId, {
              roleId: ur.roleId,
              roleName: ur.roleName || 'Unknown Role',
              description: ur.roleDescription || '',
              color: ur.roleColor || '#6b7280',
              icon: 'User',
              permissions: (ur.rolePermissions as Record<string, unknown>) || {}
            });
          }
        });
        console.log(`✅ Successfully created role map with ${roleMap.size} roles`);
      } catch (roleMapError) {
        console.error('❌ Error creating role map:', roleMapError);
      }

      // Create user-role map
      const userRoleIdMap = new Map();
      try {
        (userRoles || []).forEach(ur => {
          if (ur && ur.userId && ur.roleId) {
            userRoleIdMap.set(ur.userId, ur.roleId);
          }
        });
        console.log(`✅ Successfully created user-role map with ${userRoleIdMap.size} mappings`);
      } catch (userRoleMapError) {
        console.error('❌ Error creating user-role map:', userRoleMapError);
      }

      // Format users
      const formattedUsers = users.map(user => {
        if (!user || !user.userId || !user.email) {
          return null;
        }

        const userRoleId = userRoleIdMap.get(user.userId);
        const role = userRoleId ? roleMap.get(userRoleId) : null;

        const u = user as { userId?: string; email?: string; name?: string; isActive?: boolean; invitedAt?: Date | null; lastActiveAt?: Date | null };
        return {
          id: u.userId,
          email: u.email ?? '',
          firstName: (typeof u.name === 'string' ? u.name.split(' ')[0] : '') || (typeof u.email === 'string' ? u.email.split('@')[0] : ''),
          lastName: typeof u.name === 'string' ? u.name.split(' ').slice(1).join(' ') : '',
          role: role?.roleName || '',
          isActive: u.isActive !== false, // Default to true if undefined
          invitationStatus: 'active',
          invitedAt: u.invitedAt,
          expiresAt: null,
          lastActiveAt: u.lastActiveAt,
          invitationId: null,
          status: 'active',
          userType: 'active',
          originalData: {
            user: user,
            role: role
          }
        };
      }).filter(u => u != null) as Array<Record<string, unknown>>;

      // Format pending invitations
      let formattedInvitations: Array<Record<string, unknown>> = [];
      try {
        formattedInvitations = pendingInvitations.map(invitation => {
          if (!invitation || !invitation.invitationId || !invitation.email) {
            return null;
          }

          const role = invitation.roleId ? roleMap.get(invitation.roleId) : null;
          return {
            id: `inv_${invitation.invitationId}`,
            email: invitation.email,
            firstName: invitation.email.split('@')[0],
            lastName: '',
            role: role?.roleName || 'Member',
            isActive: false,
            invitationStatus: 'pending',
            invitedAt: invitation.createdAt,
            expiresAt: invitation.expiresAt,
            lastActiveAt: null,
            invitationId: invitation.invitationId,
            status: 'pending',
            userType: 'invited',
            originalData: {
              invitation: invitation,
              role: role
            }
          };
        }).filter(invitation => invitation !== null);

        console.log(`✅ Successfully formatted ${formattedInvitations.length} invitations`);
      } catch (invitationFormatError) {
        console.error('❌ Error formatting invitations:', invitationFormatError);
        formattedInvitations = [];
      }

      // Combine and return
      let allUsers: Array<Record<string, unknown>> = [];
      try {
        allUsers = [...formattedUsers, ...formattedInvitations] as Array<Record<string, unknown>>;
        console.log(`✅ Found ${formattedUsers.length} active users and ${formattedInvitations.length} pending invitations for entity ${entityId}`);
        console.log(`✅ Successfully combined all users: ${allUsers.length} total`);
      } catch (combineError) {
        console.error('❌ Error combining formatted users and invitations:', combineError);
        // Return just the formatted users if combining fails
        allUsers = formattedUsers as Array<Record<string, unknown>>;
      }

      return allUsers;
    } catch (error) {
      console.error('❌ Error getting tenant users by entity:', error);
      throw error;
    }
  }

  // Helper method to get child entities
  static async getEntityChildren(entityId: string): Promise<Set<string>> {
    try {
      const children = new Set<string>();

      // Get direct children
      const directChildren = await db
        .select({ entityId: entities.entityId })
        .from(entities)
        .where(eq(entities.parentEntityId, entityId));

      // Add direct children
      directChildren.forEach(child => child.entityId && children.add(child.entityId));

      // Recursively get children of children (simplified - only one level deep for now)
      for (const child of directChildren) {
        if (!child.entityId) continue;
        const grandChildren = await db
          .select({ entityId: entities.entityId })
          .from(entities)
          .where(eq(entities.parentEntityId, child.entityId));

        grandChildren.forEach(gc => gc.entityId && children.add(gc.entityId));
      }

      return children;
    } catch (error) {
      console.error('❌ Error getting entity children:', error);
      return new Set();
    }
  }

  // Unified user operations
  static async deleteUser(userId: string, tenantId: string): Promise<unknown> {
    // Check if this is an invited user (starts with 'inv_')
    if (userId.startsWith('inv_')) {
      const invitationId = userId.replace('inv_', '');
      return await this.cancelInvitation(tenantId, invitationId);
    } else {
      return await this.removeActiveUser(userId, tenantId);
    }
  }

  // Remove user from tenant (including invitation cancellation)
  static async removeUser(tenantId: string, userId: string, removedBy: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🗑️ Removing user from tenant:', { tenantId, userId, removedBy });
      
      // Check if this is an invitation ID (prefixed with 'inv_')
      if (typeof userId === 'string' && userId.startsWith('inv_')) {
        // This is an invitation ID, check if we should cancel or handle accepted invitation
        const invitationId = userId.substring(4); // Remove 'inv_' prefix
        console.log('📧 Detected invitation ID:', invitationId);

        // Check invitation status
        const [invitation] = await db
          .select()
          .from(tenantInvitations)
          .where(and(
            eq(tenantInvitations.invitationId, invitationId),
            eq(tenantInvitations.tenantId, tenantId)
          ))
          .limit(1);

        if (invitation) {
          if (invitation.status === 'pending') {
            // Cancel pending invitation
            console.log('📧 Cancelling pending invitation');
            return await this.cancelInvitation(tenantId, invitationId as string, removedBy);
          } else if (invitation.status === 'accepted') {
            // Invitation was already accepted - remove the user instead
            console.log('📧 Invitation already accepted, removing user instead');

            // Find the user that was created from this invitation
            // We can match by email since invitations are unique per email
            const [user] = await db
              .select()
              .from(tenantUsers)
              .where(and(
                eq(tenantUsers.tenantId, tenantId),
                eq(tenantUsers.email, invitation.email)
              ))
              .limit(1);

            if (user) {
              console.log('👤 Found user from accepted invitation, removing user:', user.userId);
              // Remove the user (this will be handled by the regular user removal logic below)
              userId = user.userId;
            } else {
              throw new Error('User from accepted invitation not found');
            }
          } else {
            throw new Error(`Cannot remove user from invitation with status: ${invitation.status}`);
          }
        } else {
          throw new Error('Invitation not found');
        }
      }
      
      // Check if user exists in tenant
      const [user] = await db
        .select()
        .from(tenantUsers)
        .where(and(
          eq(tenantUsers.userId, userId),
          eq(tenantUsers.tenantId, tenantId)
        ))
        .limit(1);

      if (!user) {
        throw new Error('User not found in this tenant');
      }

      // Check if user is the last admin
      if (user.isTenantAdmin) {
        const adminCount = await db
          .select({ count: count() })
          .from(tenantUsers)
          .where(and(
            eq(tenantUsers.tenantId, tenantId),
            eq(tenantUsers.isTenantAdmin, true),
            eq(tenantUsers.isActive, true)
          ));
        
        if (adminCount[0].count <= 1) {
          throw new Error('Cannot remove the last admin user from the tenant');
        }
      }

      // Start transaction
      const result = await db.transaction(async (tx) => {
        // 1. Remove organization memberships
        const deletedMemberships = await tx
          .delete(organizationMemberships)
          .where(eq(organizationMemberships.userId, userId))
          .returning();
        console.log(`✅ Removed ${deletedMemberships.length} organization memberships for user`);

        // 2. Remove user role assignments
        await tx
          .delete(userRoleAssignments)
          .where(eq(userRoleAssignments.userId, userId));

        // 3. Remove responsible person assignments (where user is the responsible person)
        try {
          const { responsiblePersons } = await import('../db/schema/organizations/responsible_persons.js');
          const deletedAssignments = await tx
            .delete(responsiblePersons)
            .where(eq(responsiblePersons.userId, userId))
            .returning();
          console.log(`✅ Removed ${deletedAssignments.length} responsible person assignments`);
        } catch (err: unknown) {
          const rpError = err as Error;
          console.warn('⚠️ Error removing responsible person assignments:', rpError.message);
          // Continue even if this fails - might not exist
        }

        // 4. Handle responsible person assignments where user is the assigner (assignedBy)
        // Set assignedBy to another admin user if possible, otherwise delete the assignments
        try {
          const { responsiblePersons, responsibilityHistory } = await import('../db/schema/organizations/responsible_persons.js');
          // Find another admin user in the tenant to reassign
          const [replacementAdmin] = await tx
            .select({ userId: tenantUsers.userId })
            .from(tenantUsers)
            .where(and(
              eq(tenantUsers.tenantId, tenantId),
              eq(tenantUsers.isTenantAdmin, true),
              eq(tenantUsers.isActive, true),
              ne(tenantUsers.userId, userId) // Not the user being deleted
            ))
            .limit(1);

          if (replacementAdmin) {
            const updatedAssignments = await tx
              .update(responsiblePersons)
              .set({ assignedBy: replacementAdmin.userId })
              .where(eq(responsiblePersons.assignedBy, userId))
              .returning();
            console.log(`✅ Reassigned ${updatedAssignments.length} responsible person assignments to admin`);
            
            // Also update responsibility history where user is the changer
            const updatedHistory = await tx
              .update(responsibilityHistory)
              .set({ changedBy: replacementAdmin.userId })
              .where(eq(responsibilityHistory.changedBy, userId))
              .returning();
            console.log(`✅ Reassigned ${updatedHistory.length} responsibility history records to admin`);
          } else {
            // If no replacement admin, delete these assignments
            const deletedAssignments = await tx
              .delete(responsiblePersons)
              .where(eq(responsiblePersons.assignedBy, userId))
              .returning();
            console.log(`✅ Deleted ${deletedAssignments.length} responsible person assignments (no replacement admin)`);
            
            // Delete responsibility history records where user is the changer
            const deletedHistory = await tx
              .delete(responsibilityHistory)
              .where(eq(responsibilityHistory.changedBy, userId))
              .returning();
            console.log(`✅ Deleted ${deletedHistory.length} responsibility history records`);
          }
        } catch (err: unknown) {
          const rpError = err as Error;
          console.warn('⚠️ Error handling responsible person assignments:', rpError.message);
          // Continue even if this fails
        }

        // 5. Cancel all invitations for this user's email (pending and accepted) so tenant_invitations stays consistent
        const cancelledInvitations = await tx
          .update(tenantInvitations)
          .set({
            status: 'cancelled',
            cancelledAt: new Date(),
            cancelledBy: removedBy
          })
          .where(and(
            eq(tenantInvitations.tenantId, tenantId),
            eq(tenantInvitations.email, user.email)
          ))
          .returning();
        console.log(`✅ Cancelled ${cancelledInvitations.length} tenant invitation(s) for email ${user.email}`);

        // 6. Publish user deletion event to Amazon MQ before deletion
        try {
          // Split name into firstName and lastName for CRM requirements
          const nameParts = (user.name || '').split(' ');
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';
          // Use kindeUserId as entityId — FA/CRM look up wrapper_user_id_mapping by kindeId
          const entityIdForEvent = user.kindeUserId || user.userId;
          await amazonMQPublisher.publishUserEventToSuite('user_deleted', tenantId, entityIdForEvent, {
            userId: user.userId,
            kindeUserId: user.kindeUserId,
            email: user.email,
            firstName: firstName,
            lastName: lastName,
            name: user.name || `${firstName} ${lastName}`.trim(),
            deletedAt: new Date().toISOString(),
            deletedBy: removedBy,
            reason: 'user_removed_from_tenant'
          });
          console.log('📡 Published user_deleted event to AWS MQ');
        } catch (err: unknown) {
          const streamError = err as Error;
          console.error('❌ [EVENT-DROPPED] Failed to publish user_deleted event:', streamError.message);
        }

        // 6b. Clear audit_logs reference to this user so FK does not block delete (preserve logs, dissociate user)
        try {
          const auditResult = await tx
            .update(auditLogs)
            .set({ userId: null })
            .where(eq(auditLogs.userId, userId))
            .returning();
          console.log(`✅ Cleared user reference from ${auditResult.length} audit log(s)`);
        } catch (err: unknown) {
          const auditErr = err as Error;
          console.warn('⚠️ Error clearing audit_logs user reference:', auditErr.message);
          // Continue so user can still be deleted
        }

        // 7. Remove the user from tenant_users
        await tx
          .delete(tenantUsers)
          .where(and(
            eq(tenantUsers.userId, userId),
            eq(tenantUsers.tenantId, tenantId)
          ));

        return { success: true, message: 'User removed successfully' };
      });

      console.log('✅ User removed successfully:', { userId, tenantId });
      return result;
    } catch (error) {
      console.error('❌ Error removing user:', error);
      throw error;
    }
  }

  // Cancel invitation
  static async cancelInvitation(tenantId: string, invitationId: string, cancelledBy?: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log('❌ Cancelling invitation:', { tenantId, invitationId, cancelledBy });
      
      // Check if invitation exists and belongs to tenant
      const [invitation] = await db
        .select()
        .from(tenantInvitations)
        .where(and(
          eq(tenantInvitations.invitationId, invitationId),
          eq(tenantInvitations.tenantId, tenantId)
        ))
        .limit(1);

      if (!invitation) {
        throw new Error('Invitation not found');
      }

      if (invitation.status !== 'pending') {
        throw new Error('Can only cancel pending invitations');
      }

      // Cancel the invitation
      await db
        .update(tenantInvitations)
        .set({
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelledBy: cancelledBy
        })
        .where(eq(tenantInvitations.invitationId, invitationId));

      console.log('✅ Invitation cancelled successfully:', { invitationId, tenantId });
      return { success: true, message: 'Invitation cancelled successfully' };
    } catch (error) {
      console.error('❌ Error cancelling invitation:', error);
      throw error;
    }
  }

  // Remove active user
  static async removeActiveUser(userId: string, tenantId: string): Promise<{ success: boolean; message: string; data: typeof tenantUsers.$inferSelect }> {
    try {
      const [updatedUser] = await db
        .update(tenantUsers)
        .set({ 
          isActive: false,
          updatedAt: new Date()
        })
        .where(and(
          eq(tenantUsers.userId, userId),
          eq(tenantUsers.tenantId, tenantId)
        ))
        .returning();

      if (!updatedUser) {
        throw new Error('User not found');
      }

      // Publish user deactivation event to Amazon MQ
      try {
        // Split name into firstName and lastName for CRM requirements
        const nameParts = (updatedUser.name || '').split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        await amazonMQPublisher.publishUserEventToSuite('user_deactivated', tenantId, updatedUser.userId, {
          userId: updatedUser.userId,
          email: updatedUser.email,
          firstName: firstName,
          lastName: lastName,
          name: updatedUser.name || `${firstName} ${lastName}`.trim(),
          deactivatedAt: new Date().toISOString(),
          deactivatedBy: null, // System-initiated deactivation
          reason: 'user_deactivated'
        });
        console.log('📡 Published user_deactivated event to AWS MQ');
      } catch (err: unknown) {
        const publishError = err as Error;
        console.error('❌ [EVENT-DROPPED] Failed to publish user_deactivated event:', publishError.message);
      }

      return {
        success: true,
        message: 'User removed successfully',
        data: updatedUser
      };
    } catch (error) {
      console.error('Error removing user:', error);
      throw error;
    }
  }

  // Update user role (works for both user types)
  static async updateUserRole(userId: string, roleId: string, tenantId: string): Promise<{ success: boolean; message: string; data: unknown }> {
    try {
      if (userId.startsWith('inv_')) {
        // Update invitation role
        const invitationId = userId.replace('inv_', '');
        const [updatedInvitation] = await db
          .update(tenantInvitations)
          .set({ 
            roleId: roleId,
            updatedAt: new Date()
          })
          .where(and(
            eq(tenantInvitations.invitationId, invitationId),
            eq(tenantInvitations.tenantId, tenantId)
          ))
          .returning();

        if (!updatedInvitation) {
          throw new Error('Invitation not found');
        }

        return {
          success: true,
          message: 'Invitation role updated successfully',
          data: updatedInvitation
        };
      } else {
        // Update active user role
        // First remove existing role assignments and publish unassignment events
        const existingAssignments = await db
          .select({
            id: userRoleAssignments.id,
            roleId: userRoleAssignments.roleId,
            assignedAt: userRoleAssignments.assignedAt
          })
          .from(userRoleAssignments)
          .where(eq(userRoleAssignments.userId, userId));

        // Publish role unassignment events for removed roles
        for (const assignment of existingAssignments) {
          try {
            await amazonMQPublisher.publishRoleEventToSuite('role_unassigned', tenantId, assignment.roleId, {
              assignmentId: assignment.id,
              userId: userId,
              roleId: assignment.roleId,
              unassignedAt: new Date().toISOString(),
              unassignedBy: null, // Will be set by caller if available
              reason: 'Role updated to new assignment'
            });
            console.log('📡 Published role unassignment event successfully');
          } catch (err: unknown) {
            const streamError = err as Error;
            console.error('❌ [EVENT-DROPPED] Failed to publish role_unassigned event:', streamError.message);
          }
        }

        // Remove existing role assignments
        await db
          .delete(userRoleAssignments)
          .where(eq(userRoleAssignments.userId, userId));

        // Add new role assignment (assignedBy is required by schema; use userId as fallback)
        const [newRoleAssignment] = await db
          .insert(userRoleAssignments)
          .values({
            userId: userId,
            roleId: roleId,
            assignedBy: userId,
            assignedAt: new Date(),
            isActive: true
          })
          .returning();

        // Publish role assignment event for new role
        try {
          await amazonMQPublisher.publishRoleEventToSuite('role_assigned', tenantId, roleId, {
            assignmentId: newRoleAssignment.id,
            userId: userId,
            roleId: roleId,
            assignedAt: newRoleAssignment.assignedAt ? (typeof newRoleAssignment.assignedAt === 'string' ? newRoleAssignment.assignedAt : newRoleAssignment.assignedAt.toISOString()) : new Date().toISOString(),
            assignedBy: null, // Will be set by caller if available
            expiresAt: (newRoleAssignment as { expiresAt?: Date | string }).expiresAt,
            entityId: (newRoleAssignment as { organizationId?: string }).organizationId
          });
          console.log('📡 Published role assignment event successfully');
        } catch (err: unknown) {
          const streamError = err as Error;
          console.error('❌ [EVENT-DROPPED] Failed to publish role_assigned event:', streamError.message);
        }

        return {
          success: true,
          message: 'User role updated successfully',
          data: newRoleAssignment
        };
      }
    } catch (error) {
      console.error('Error updating user role:', error);
      throw error;
    }
  }

  // Check subdomain availability
  static async checkSubdomainAvailability(subdomain: string): Promise<boolean> {
    const existing = await this.getBySubdomain(subdomain);
    return !existing;
  }

  // Get user by email in tenant - includes both active and invited users
  static async getUserByEmailInTenant(tenantId: string, email: string): Promise<typeof tenantUsers.$inferSelect | undefined> {
    const [user] = await db
      .select()
      .from(tenantUsers)
      .where(and(
        eq(tenantUsers.tenantId, tenantId),
        eq(tenantUsers.email, email)
      ))
      .limit(1);
    
    return user;
  }
}

export default TenantService; 