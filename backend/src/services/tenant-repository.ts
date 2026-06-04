import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { tenants } from '../db/schema/index.js';

export class TenantRepository {
  static async getBySubdomain(subdomain: string): Promise<Record<string, unknown> | null> {
    const [tenant] = await db
      .select({
        tenantId: tenants.tenantId,
        companyName: tenants.companyName,
        subdomain: tenants.subdomain,
        idpOrgId: tenants.idpOrgId,
        adminEmail: tenants.adminEmail,
        isActive: tenants.isActive,
        isVerified: tenants.isVerified,
        createdAt: tenants.createdAt,
        updatedAt: tenants.updatedAt,
      })
      .from(tenants)
      .where(eq(tenants.subdomain, subdomain))
      .limit(1);

    return tenant || null;
  }

  static async getByIdpOrgId(idpOrgId: string): Promise<Record<string, unknown> | null> {
    const [tenant] = await db
      .select({
        tenantId: tenants.tenantId,
        companyName: tenants.companyName,
        subdomain: tenants.subdomain,
        idpOrgId: tenants.idpOrgId,
        adminEmail: tenants.adminEmail,
        isActive: tenants.isActive,
        isVerified: tenants.isVerified,
        createdAt: tenants.createdAt,
        updatedAt: tenants.updatedAt,
      })
      .from(tenants)
      .where(eq(tenants.idpOrgId, idpOrgId))
      .limit(1);

    return tenant || null;
  }

  static async updateTenantById(
    tenantId: string,
    updates: Record<string, unknown>
  ): Promise<typeof tenants.$inferSelect | undefined> {
    const [updated] = await db
      .update(tenants)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tenants.tenantId, tenantId))
      .returning();

    return updated;
  }

  static async deactivateTenant(
    tenantId: string,
    reason: string
  ): Promise<typeof tenants.$inferSelect | undefined> {
    const [updated] = await db
      .update(tenants)
      .set({
        isActive: false,
        updatedAt: new Date(),
        settings: { deactivationReason: reason },
      })
      .where(eq(tenants.tenantId, tenantId))
      .returning();

    return updated;
  }

  static async reactivateTenant(tenantId: string): Promise<typeof tenants.$inferSelect | undefined> {
    const [updated] = await db
      .update(tenants)
      .set({
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(tenants.tenantId, tenantId))
      .returning();

    return updated;
  }
}
