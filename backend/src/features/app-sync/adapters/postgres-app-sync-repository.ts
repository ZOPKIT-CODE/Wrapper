import { db } from '../../../db/index.js';
import { tenants } from '../../../db/schema/index.js';
import { eq } from 'drizzle-orm';
import type { AppSyncRepository, BasicTenantRecord } from '../repositories/app-sync-repository.js';

class PostgresAppSyncRepository implements AppSyncRepository {
  async resolveTenantId(tenantIdParam: string | undefined): Promise<string | null> {
    if (!tenantIdParam) return null;

    let [row] = await db
      .select({ tenantId: tenants.tenantId })
      .from(tenants)
      .where(eq(tenants.tenantId, tenantIdParam))
      .limit(1) as { tenantId: string }[];

    if (row) return row.tenantId;

    [row] = await db
      .select({ tenantId: tenants.tenantId })
      .from(tenants)
      .where(eq(tenants.idpOrgId, tenantIdParam))
      .limit(1) as { tenantId: string }[];

    return row ? row.tenantId : null;
  }

  async getBasicTenantById(tenantId: string): Promise<BasicTenantRecord | null> {
    const [tenant] = await db
      .select({
        tenantId: tenants.tenantId,
        companyName: tenants.companyName,
        isActive: tenants.isActive
      })
      .from(tenants)
      .where(eq(tenants.tenantId, tenantId))
      .limit(1) as BasicTenantRecord[];

    return tenant ?? null;
  }
}

let appSyncRepository: AppSyncRepository | null = null;

export function getAppSyncRepository(): AppSyncRepository {
  if (!appSyncRepository) {
    appSyncRepository = new PostgresAppSyncRepository();
  }
  return appSyncRepository;
}

export function setAppSyncRepository(repository: AppSyncRepository): void {
  appSyncRepository = repository;
}

export function resetAppSyncRepository(): void {
  appSyncRepository = null;
}
