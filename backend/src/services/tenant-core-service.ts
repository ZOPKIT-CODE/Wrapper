/**
 * Tenant Core Service — Tenant CRUD, settings, profile, onboarding status.
 *
 * Extracted from tenant-service.ts (god-object split).
 * The original TenantService facade re-exports these methods for backward compat.
 */

import { eq, and, count } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  tenants,
  tenantUsers,
  customRoles,
  userRoleAssignments,
  tenantBankingDetails,
} from '../db/schema/index.js';
import { v4 as uuidv4 } from 'uuid';
import { SubscriptionService } from '../features/subscriptions/index.js';
import { TenantRepository } from './tenant-repository.js';
import Logger from '../utils/logger.js';

export type CreateTenantData = {
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

export class TenantCoreService {
  static async createTenant(data: CreateTenantData): Promise<{ tenant: typeof tenants.$inferSelect; adminRole: typeof customRoles.$inferSelect; adminUser: typeof tenantUsers.$inferSelect }> {
    const tenantId = uuidv4();
    const adminUserId = uuidv4();

    try {
      const result = await db.transaction(async (tx) => {
        const [tenant] = await tx.insert(tenants).values({
          tenantId,
          companyName: data.companyName,
          subdomain: data.subdomain,
          kindeOrgId: data.kindeOrgId,
          adminEmail: data.adminEmail,
          organizationSize: data.organizationSize ?? data.companySize ?? undefined,
          industry: data.industry,
          defaultTimeZone: data.timezone || 'Asia/Kolkata',
          onboardedAt: new Date(),
        }).returning();

        if (!data.kindeUserId) {
          throw new Error('kindeUserId is required for tenant creation');
        }

        const [adminUser] = await tx.insert(tenantUsers).values({
          userId: adminUserId,
          tenantId,
          kindeUserId: data.kindeUserId,
          email: data.adminEmail,
          firstName: data.adminFirstName || null,
          lastName: data.adminLastName || null,
          isVerified: true,
          isActive: true,
          isTenantAdmin: true,
          onboardingCompleted: false,
        }).returning();

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

        await tx.insert(userRoleAssignments).values({
          userId: adminUserId,
          roleId: adminRole.roleId,
          assignedBy: adminUserId,
        });

        return { tenant, adminRole, adminUser };
      });

      await SubscriptionService.createTrialSubscription(tenantId);
      return result;
    } catch (error) {
      const err = error as Error;
      Logger.log('error', 'tenant', 'create-tenant', 'Failed to create tenant', { error: err.message, stack: err.stack });
      throw new Error('Tenant creation failed');
    }
  }

  static async getBySubdomain(subdomain: string): Promise<Record<string, unknown> | null> {
    return TenantRepository.getBySubdomain(subdomain);
  }

  static async getByKindeOrgId(kindeOrgId: string): Promise<Record<string, unknown> | null> {
    return TenantRepository.getByKindeOrgId(kindeOrgId);
  }

  static async getTenantDetails(tenantId: string): Promise<Record<string, unknown>> {
    try {
      const [row] = await db
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
          legalCompanyName: tenants.legalCompanyName,
          logoUrl: tenants.logoUrl,
          companyType: tenants.companyType,
          industry: tenants.industry,
          website: tenants.website,
          organizationSize: tenants.organizationSize,
          billingEmail: tenants.billingEmail,
          supportEmail: tenants.supportEmail,
          contactJobTitle: tenants.contactJobTitle,
          preferredContactMethod: tenants.preferredContactMethod,
          phone: tenants.phone,
          mailingAddressSameAsRegistered: tenants.mailingAddressSameAsRegistered,
          mailingStreet: tenants.mailingStreet,
          mailingCity: tenants.mailingCity,
          mailingState: tenants.mailingState,
          mailingZip: tenants.mailingZip,
          mailingCountry: tenants.mailingCountry,
          billingStreet: tenants.billingStreet,
          billingCity: tenants.billingCity,
          billingState: tenants.billingState,
          billingZip: tenants.billingZip,
          billingCountry: tenants.billingCountry,
          taxRegistered: tenants.taxRegistered,
          vatGstRegistered: tenants.vatGstRegistered,
          gstin: tenants.gstin,
          taxRegistrationDetails: tenants.taxRegistrationDetails,
          defaultLanguage: tenants.defaultLanguage,
          defaultLocale: tenants.defaultLocale,
          defaultCurrency: tenants.defaultCurrency,
          defaultTimeZone: tenants.defaultTimeZone,
          primaryColor: tenants.primaryColor,
          customDomain: tenants.customDomain,
          brandingConfig: tenants.brandingConfig,
          settings: tenants.settings,
          onboardedAt: tenants.onboardedAt,
          bankName: tenantBankingDetails.bankName,
          bankBranch: tenantBankingDetails.bankBranch,
          accountHolderName: tenantBankingDetails.accountHolderName,
          accountNumber: tenantBankingDetails.accountNumber,
          accountType: tenantBankingDetails.accountType,
          bankAccountCurrency: tenantBankingDetails.bankAccountCurrency,
          swiftBicCode: tenantBankingDetails.swiftBicCode,
          iban: tenantBankingDetails.iban,
          routingNumberUs: tenantBankingDetails.routingNumberUs,
          sortCodeUk: tenantBankingDetails.sortCodeUk,
          ifscCodeIndia: tenantBankingDetails.ifscCodeIndia,
          bsbNumberAustralia: tenantBankingDetails.bsbNumberAustralia,
          paymentTerms: tenantBankingDetails.paymentTerms,
          preferredPaymentMethod: tenantBankingDetails.preferredPaymentMethod,
          creditLimit: tenantBankingDetails.creditLimit,
        })
        .from(tenants)
        .leftJoin(tenantBankingDetails, eq(tenantBankingDetails.tenantId, tenants.tenantId))
        .where(eq(tenants.tenantId, tenantId))
        .limit(1);

      if (!row) throw new Error('Tenant not found');

      // parallelized — subscription, user count, and admin user are independent of each other
      const [subscriptionResult, userCount, [adminUser]] = await Promise.all([
        SubscriptionService.getCurrentSubscription(tenantId).catch(() => null),
        db
          .select({ count: count() })
          .from(tenantUsers)
          .where(eq(tenantUsers.tenantId, tenantId)),
        db
          .select()
          .from(tenantUsers)
          .where(and(eq(tenantUsers.tenantId, tenantId), eq(tenantUsers.isTenantAdmin, true)))
          .limit(1),
      ]);

      const subscription = subscriptionResult;
      const sub = subscription as { status?: string; plan?: string } | null;
      return {
        ...(row as Record<string, unknown>),
        subscription,
        userCount: userCount[0]?.count || 0,
        adminUser: adminUser || null,
        isFullyOnboarded: Boolean(row.onboardedAt && adminUser?.onboardingCompleted),
        subscriptionStatus: sub?.status ?? 'none',
      };
    } catch (error) {
      const err = error as Error;
      Logger.log('error', 'tenant', 'get-tenant-details', 'Error getting tenant details', { error: err.message, stack: err.stack });
      throw error;
    }
  }

  static async upsertBankingDetails(tenantId: string, data: Record<string, unknown>): Promise<void> {
    const bankingFields = [
      'bankName', 'bankBranch', 'accountHolderName', 'accountNumber', 'accountType',
      'bankAccountCurrency', 'swiftBicCode', 'iban', 'routingNumberUs', 'sortCodeUk',
      'ifscCodeIndia', 'bsbNumberAustralia', 'paymentTerms', 'preferredPaymentMethod', 'creditLimit',
    ] as const;
    const values: Record<string, unknown> = { tenantId, updatedAt: new Date() };
    for (const field of bankingFields) {
      if (data[field] !== undefined) values[field] = data[field];
    }
    await db
      .insert(tenantBankingDetails)
      .values(values as typeof tenantBankingDetails.$inferInsert)
      .onConflictDoUpdate({ target: tenantBankingDetails.tenantId, set: { ...values, updatedAt: new Date() } });
  }

  static async getOnboardingStatus(tenantId: string): Promise<Record<string, unknown>> {
    try {
      const tenant = await this.getTenantDetails(tenantId);
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
        adminUser: tenant.adminUser,
      };
    } catch (error) {
      const err = error as Error;
      Logger.log('error', 'tenant', 'get-onboarding-status', 'Error getting onboarding status', { error: err.message, stack: err.stack });
      throw error;
    }
  }

  static async markOnboardingComplete(tenantId: string, userId: string): Promise<{ success: boolean; completedAt: Date; message: string }> {
    try {
      await db.update(tenants).set({ onboardedAt: new Date(), updatedAt: new Date() }).where(eq(tenants.tenantId, tenantId));
      await db.update(tenantUsers).set({ onboardingCompleted: true, updatedAt: new Date() }).where(eq(tenantUsers.userId, userId));
      return { success: true, completedAt: new Date(), message: 'Onboarding completed successfully' };
    } catch (error) {
      const err = error as Error;
      Logger.log('error', 'tenant', 'mark-onboarding-complete', 'Error marking onboarding complete', { error: err.message, stack: err.stack });
      throw error;
    }
  }

  static async updateTenant(tenantId: string, updates: Record<string, unknown>): Promise<typeof tenants.$inferSelect | undefined> {
    return TenantRepository.updateTenantById(tenantId, updates);
  }

  static async deactivateTenant(tenantId: string, reason: string): Promise<typeof tenants.$inferSelect | undefined> {
    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(tenants)
        .set({ isActive: false, updatedAt: new Date(), settings: { deactivationReason: reason } } as any)
        .where(eq(tenants.tenantId, tenantId))
        .returning();
      await tx.update(tenantUsers).set({ isActive: false }).where(eq(tenantUsers.tenantId, tenantId));
      return updated;
    });
  }

  static async reactivateTenant(tenantId: string): Promise<typeof tenants.$inferSelect | undefined> {
    return TenantRepository.reactivateTenant(tenantId);
  }

  static async checkSubdomainAvailability(subdomain: string): Promise<boolean> {
    const existing = await this.getBySubdomain(subdomain);
    return !existing;
  }

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
}
