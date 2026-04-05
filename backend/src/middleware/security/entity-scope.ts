import type { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../../db/index.js';
import { entities, responsiblePersons, tenantUsers } from '../../db/schema/index.js';
import { eq, and, sql, inArray } from 'drizzle-orm';

interface EntityCacheEntry {
  value: unknown;
  expiresAt?: number;
}

/**
 * In-memory entity cache (replaces Redis cache)
 */
class EntityCache {
  private cache = new Map<string, EntityCacheEntry>();

  constructor() {
    // Cleanup expired entries periodically
    setInterval(() => this._cleanupExpired(), 60000); // Every minute
  }

  _cleanupExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  async get(key: string): Promise<unknown> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }

  async set(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
    const expiresAt = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }
}

const entityCache = new EntityCache();

export interface EntityScopeResult {
  scope: string;
  entityIds: string[];
  isUnrestricted?: boolean;
  entities?: unknown[];
  userEmail?: string | null;
  responsibilities?: unknown[];
  [key: string]: unknown;
}

/**
 * Get user's accessible entity IDs based on their role
 * - Tenant Admin: ALL entities in tenant
 * - Entity Admin (Responsible Person): Their entity + all children
 * - Regular User: None (or only their assigned entity)
 * 
 * OPTIMIZED VERSION:
 * - Uses caching to avoid repeated queries
 * - Optimized recursive queries using CTE
 * - Batch queries instead of loops
 * 
 * @param {string} userId - Internal user ID
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Object>} Entity scope object
 */
export async function getUserAccessibleEntities(userId: string, tenantId: string): Promise<EntityScopeResult> {
  console.log('🔍 Getting accessible entities for user:', { userId, tenantId });

  const cacheKey = `entity-scope:${userId}:${tenantId}`;
  const cached = await entityCache.get(cacheKey);
  if (cached) {
    console.log('✅ Entity scope cache hit');
    return cached as EntityScopeResult;
  }

  // Check if user is tenant admin
  const [user] = await db
    .select({ 
      isTenantAdmin: tenantUsers.isTenantAdmin,
      email: tenantUsers.email 
    })
    .from(tenantUsers)
    .where(and(
      eq(tenantUsers.userId, userId),
      eq(tenantUsers.tenantId, tenantId)
    ))
    .limit(1);

  if (!user) {
    console.log('❌ User not found');
    return {
      scope: 'none',
      entities: [],
      entityIds: [], // Keep for backward compatibility
      isUnrestricted: false
    };
  }

  // Tenant Admin sees EVERYTHING
  if (user.isTenantAdmin) {
    console.log('👑 User is Tenant Admin - unrestricted access');
    // entity_code column was dropped (migration 0015); expose entityId as entityCode for API compatibility
    const allEntities = await db
      .select({
        entityId: entities.entityId,
        entityName: entities.entityName,
        entityType: entities.entityType,
        entityCode: sql<string>`cast(${entities.entityId} as varchar)`.as('entityCode'),
      })
      .from(entities)
      .where(and(
        eq(entities.tenantId, tenantId),
        eq(entities.isActive, true)
      ));

    const result = {
      scope: 'tenant',
      entities: allEntities,
      entityIds: allEntities.map(e => e.entityId), // Keep for backward compatibility
      isUnrestricted: true,
      userEmail: user.email
    };

    // Cache for 5 minutes
    await entityCache.set(cacheKey, result, 300);
    return result;
  }

  // Get entities where user is responsible person
  const responsibilities = await db
    .select({
      entityId: responsiblePersons.entityId,
      entityType: responsiblePersons.entityType,
      scope: responsiblePersons.scope,
      responsibilityLevel: responsiblePersons.responsibilityLevel
    })
    .from(responsiblePersons)
    .where(and(
      eq(responsiblePersons.userId, userId),
      eq(responsiblePersons.tenantId, tenantId),
      eq(responsiblePersons.isActive, true)
    ));

  if (responsibilities.length === 0) {
    console.log('⚠️ User has no entity responsibilities');
    const result = {
      scope: 'none',
      entities: [],
      entityIds: [], // Keep for backward compatibility
      isUnrestricted: false,
      userEmail: user.email
    };
    // Cache empty result for 1 minute
    await entityCache.set(cacheKey, result, 60);
    return result;
  }

  console.log('📋 User has', responsibilities.length, 'entity responsibilities');

  // OPTIMIZED: Get all responsible entity IDs at once
  const responsibleEntityIds = responsibilities.map(r => r.entityId).filter((id): id is string => id != null);

  // OPTIMIZED: Use recursive CTE to get all descendants in a single query
  const allAccessibleEntityIds = await getAllDescendantEntityIds(responsibleEntityIds, tenantId);

  // OPTIMIZED: Get all entity details in a single batch query
  const accessibleEntities = await db
    .select({
      entityId: entities.entityId,
      entityName: entities.entityName,
      entityType: entities.entityType,
      entityCode: sql<string>`cast(${entities.entityId} as varchar)`.as('entityCode'),
    })
    .from(entities)
    .where(and(
      eq(entities.tenantId, tenantId),
      eq(entities.isActive, true),
      inArray(entities.entityId, allAccessibleEntityIds as string[])
    ));

  console.log('✅ Total accessible entities:', accessibleEntities.length);

  const result = {
    scope: 'entity',
    entities: accessibleEntities,
    entityIds: allAccessibleEntityIds, // Keep for backward compatibility
    isUnrestricted: false,
    responsibilities,
    userEmail: user.email
  };

  // Cache for 5 minutes
  await entityCache.set(cacheKey, result, 300);
  return result;
}

// UUID v4 format guard — used to validate IDs before injecting via sql.raw()
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Get all descendant entity IDs (including the parents themselves) using a
 * single recursive CTE — replaces the old depth-loop that issued one query per
 * level (up to 20 round-trips for a deep hierarchy).
 *
 * Security note: `parentIds` and `tenantId` are UUID strings sourced from the
 * JWT / DB, never from raw user input.  We still validate UUID format before
 * interpolating via `sql.raw()` so a malformed value throws early rather than
 * reaching the database.
 *
 * @param parentIds - Array of root entity IDs whose subtree we want
 * @param tenantId  - Tenant ID (UUID) used to scope every row touched
 * @returns Flat array of all entity IDs reachable from the given roots
 */
async function getAllDescendantEntityIds(parentIds: string[], tenantId: string): Promise<string[]> {
  if (!parentIds || parentIds.length === 0) {
    return [];
  }

  // Validate every ID is a well-formed UUID before using sql.raw()
  const invalidId = parentIds.find(id => !UUID_RE.test(id));
  if (invalidId) {
    throw new Error(`getAllDescendantEntityIds: invalid UUID in parentIds: ${invalidId}`);
  }
  if (!UUID_RE.test(tenantId)) {
    throw new Error(`getAllDescendantEntityIds: invalid tenantId UUID: ${tenantId}`);
  }

  // Build the ARRAY[...] literal — safe because every element passed the UUID regex above
  const anchorValues = parentIds.map(id => `'${id}'::uuid`).join(', ');

  const result = await db.execute(sql`
    WITH RECURSIVE entity_tree AS (
      -- Anchor: start from the given parent IDs
      SELECT entity_id
      FROM entities
      WHERE entity_id = ANY(ARRAY[${sql.raw(anchorValues)}]::uuid[])
        AND tenant_id = ${tenantId}::uuid
        AND is_active = true

      UNION ALL

      -- Recursive: find children one level at a time
      SELECT e.entity_id
      FROM entities e
      INNER JOIN entity_tree et ON e.parent_entity_id = et.entity_id
      WHERE e.tenant_id = ${tenantId}::uuid
        AND e.is_active = true
    )
    SELECT entity_id FROM entity_tree
  `);

  // Drizzle db.execute() returns an array-like iterable of row objects.
  // Cast through unknown first — RowList<Record<string, unknown>> doesn't
  // structurally overlap with a typed interface, so the double cast is required.
  return Array.from(result as unknown as { entity_id: string }[]).map(r => r.entity_id);
}

/**
 * Middleware: Add entity scope to request context
 * Use this middleware after authenticateToken
 */
export async function entityScopeMiddleware(request: FastifyRequest, reply: FastifyReply) {
  if (!request.userContext) {
    return reply.code(401).send({ error: 'Authentication required' });
  }

  const { internalUserId, tenantId } = request.userContext;
  if (!internalUserId || !tenantId) {
    return reply.code(401).send({ error: 'Authentication required' });
  }
  
  try {
    const entityScope = await getUserAccessibleEntities(internalUserId, tenantId);
    request.entityScope = entityScope;
    const entityIds = entityScope.entityIds ?? [];
    console.log('🔐 Entity Scope Set:', {
      userId: internalUserId,
      scope: entityScope.scope,
      entityCount: entityIds.length,
      isUnrestricted: entityScope.isUnrestricted ?? false
    });
  } catch (error) {
    console.error('❌ Failed to get entity scope:', error);
    const fallback: { scope: string; entityIds: string[]; isUnrestricted: boolean } = {
      scope: 'none',
      entityIds: [],
      isUnrestricted: false
    };
    request.entityScope = fallback;
  }
}

/**
 * Helper: Check if user can access an entity
 * @param {Object} entityScope - Entity scope from request
 * @param {string} entityId - Entity ID to check
 * @returns {boolean}
 */
export function canAccessEntity(entityScope: { isUnrestricted?: boolean; entityIds?: string[] } | null, entityId: string) {
  if (!entityScope) return false;
  if (entityScope.isUnrestricted) return true;
  return (entityScope.entityIds ?? []).includes(entityId);
}

/**
 * Helper: Filter entities array to only accessible ones
 * @param {Array} entities - Array of entities
 * @param {Object} entityScope - Entity scope from request
 * @param {string} idField - Field name for entity ID (default: 'entityId')
 * @returns {Array}
 */
export function filterEntitiesByScope<T extends Record<string, unknown>>(entities: T[], entityScope: { isUnrestricted?: boolean; entityIds?: string[] } | null, idField = 'entityId'): T[] {
  if (!entityScope) return [];
  if (entityScope.isUnrestricted) return entities;
  const ids = entityScope.entityIds ?? [];
  return entities.filter(entity => ids.includes(String(entity[idField])));
}

/**
 * Helper: Build SQL WHERE clause for entity filtering
 * @param {Object} entityScope - Entity scope from request
 * @param {string} columnName - Column name for entity ID
 * @returns {SQL|null} SQL condition or null if unrestricted
 */
export function buildEntityScopeCondition(entityScope: { isUnrestricted?: boolean; entityIds?: string[] } | null, columnName = 'entity_id') {
  if (!entityScope) {
    return sql`1 = 0`; // No access
  }
  
  if (entityScope.isUnrestricted) {
    return null; // No filter needed
  }
  
  const ids = entityScope.entityIds ?? [];
  if (ids.length === 0) {
    return sql`1 = 0`; // No access
  }
  const idList: string[] = ids;
  return idList.length === 1
    ? sql.raw(`${columnName} = '${idList[0]}'`)
    : sql.raw(`${columnName} = ANY(ARRAY[${idList.map(id => `'${id}'`).join(',')}]::uuid[])`);
}

export default {
  getUserAccessibleEntities,
  entityScopeMiddleware,
  canAccessEntity,
  filterEntitiesByScope,
  buildEntityScopeCondition
};

