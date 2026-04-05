/**
 * Hierarchy Manager - Application-level hierarchy path management
 * Since we can't create database triggers, this module handles hierarchy operations
 */

import { db } from '../db/index.js';
import { entities, credits } from '../db/schema/index.js';
import { eq, and, sql } from 'drizzle-orm';

export class HierarchyManager {

  /**
   * Build hierarchy path from entity ID chain
   */
  static async buildHierarchyPath(entityId: string): Promise<string> {
    const pathParts: string[] = [];
    let currentId: string | null = entityId;
    let maxDepth = 0;

    // Prevent infinite loops
    while (currentId && maxDepth < 50) {
      // Get current entity
      const result = await db
        .select({
          entityId: entities.entityId,
          parentEntityId: entities.parentEntityId,
          entityName: entities.entityName
        })
        .from(entities)
        .where(eq(entities.entityId, currentId))
        .limit(1) as Array<{ entityId: string; parentEntityId: string | null; entityName: string }>;

      if (result.length === 0) break;

      const currentEntity = result[0];

      // Prepend entity ID to path
      pathParts.unshift(currentEntity.entityId ?? '');

      // Move to parent
      currentId = currentEntity.parentEntityId;
      maxDepth++;
    }

    // Join path parts with dots
    return pathParts.join('.');
  }

  /**
   * Build full hierarchy path (with names) from entity ID chain
   */
  static async buildFullHierarchyPath(entityId: string): Promise<string> {
    const nameParts: string[] = [];
    let currentId: string | null = entityId;
    let maxDepth = 0;

    while (currentId && maxDepth < 50) {
      const result = await db
        .select({
          entityId: entities.entityId,
          parentEntityId: entities.parentEntityId,
          entityName: entities.entityName
        })
        .from(entities)
        .where(eq(entities.entityId, currentId))
        .limit(1) as Array<{ entityId: string; parentEntityId: string | null; entityName: string }>;

      if (result.length === 0) break;

      const currentEntity = result[0];
      nameParts.unshift(currentEntity.entityName ?? '');

      currentId = currentEntity.parentEntityId;
      maxDepth++;
    }

    return nameParts.join(' > ');
  }

  /**
   * Calculate entity level from hierarchy path
   */
  static calculateEntityLevel(hierarchyPath: string): number {
    if (!hierarchyPath) return 1;
    return hierarchyPath.split('.').length;
  }

  /**
   * Update hierarchy paths for an entity and all its descendants
   */
  static async updateEntityHierarchyPaths(entityId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔄 Updating hierarchy paths for entity:', entityId);

      // Update the entity itself
      const hierarchyPath = await this.buildHierarchyPath(entityId);
      const fullHierarchyPath = await this.buildFullHierarchyPath(entityId);
      const entityLevel = this.calculateEntityLevel(hierarchyPath);

      await db
        .update(entities)
        .set({
          hierarchyPath,
          fullHierarchyPath,
          entityLevel,
          updatedAt: new Date()
        })
        .where(eq(entities.entityId, entityId));

      // Update all descendants
      await this.updateDescendantHierarchyPaths(entityId);

      console.log('✅ Hierarchy paths updated successfully');
      return { success: true };

    } catch (error: unknown) {
      console.error('❌ Error updating hierarchy paths:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Update hierarchy paths for all descendants of a given entity
   */
  static async updateDescendantHierarchyPaths(parentEntityId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Find all descendants
      const allEntities = await db
        .select({
          entityId: entities.entityId,
          hierarchyPath: entities.hierarchyPath
        })
        .from(entities)
        .where(sql`${entities.hierarchyPath} LIKE ${`%${parentEntityId}%`}`);

      const descendants = allEntities.filter((entity: { entityId: string; hierarchyPath: string | null }) =>
        entity.hierarchyPath &&
        entity.hierarchyPath.includes(`${parentEntityId}.`) &&
        entity.entityId !== parentEntityId
      );

      console.log(`📊 Found ${descendants.length} descendants to update`);

      // Update each descendant's hierarchy path and level
      for (const descendant of descendants) {
        const hierarchyPath = await this.buildHierarchyPath(descendant.entityId);
        const fullHierarchyPath = await this.buildFullHierarchyPath(descendant.entityId);
        const entityLevel = this.calculateEntityLevel(hierarchyPath);

        console.log(`🔄 Updating ${descendant.entityId}: ${descendant.hierarchyPath} → ${hierarchyPath}`);

        await db
          .update(entities)
          .set({
            hierarchyPath,
            fullHierarchyPath,
            entityLevel,
            updatedAt: new Date()
          })
          .where(eq(entities.entityId, descendant.entityId));
      }

      console.log('✅ Descendant hierarchy paths updated successfully');
      return { success: true };

    } catch (error: unknown) {
      console.error('❌ Error updating descendant hierarchy paths:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Validate hierarchy integrity (prevent circular references)
   */
  static async validateHierarchyIntegrity(childEntityId: string, newParentId: string | null): Promise<{ valid: boolean; message?: string }> {
    if (!newParentId) return { valid: true };

    try {
      // Get the hierarchy path of the proposed parent
      const parentResult = await db
        .select({ hierarchyPath: entities.hierarchyPath })
        .from(entities)
        .where(eq(entities.entityId, newParentId))
        .limit(1);

      if (parentResult.length === 0) {
        return { valid: false, message: 'Parent entity not found' };
      }

      const parentPath = parentResult[0].hierarchyPath;

      // Check if the child is already in the parent's hierarchy
      if (parentPath && parentPath.includes(childEntityId)) {
        return {
          valid: false,
          message: 'Cannot set parent to a descendant (circular reference)'
        };
      }

      return { valid: true };
    } catch (error: unknown) {
      return { valid: false, message: `Validation error: ${(error as Error).message}` };
    }
  }

  /**
   * Get complete entity hierarchy tree for a tenant
   */
  static async getEntityHierarchyTree(tenantId: string): Promise<{ success: boolean; hierarchy: unknown[]; totalEntities: number; message: string }> {
    try {
      // Get all entities for the tenant with credit information
      const allEntities = await db
        .select({
          entityId: entities.entityId,
          tenantId: entities.tenantId,
          entityName: entities.entityName,
          entityType: entities.entityType,
          entityLevel: entities.entityLevel,
          hierarchyPath: entities.hierarchyPath,
          fullHierarchyPath: entities.fullHierarchyPath,
          parentEntityId: entities.parentEntityId,
          organizationType: entities.organizationType,
          locationType: entities.locationType,
          address: entities.address,
          description: entities.description,
          isActive: entities.isActive,
          createdAt: entities.createdAt,
          updatedAt: entities.updatedAt,
          // Credit information (credits table has availableCredits only)
          availableCredits: sql`coalesce(${credits.availableCredits}, 0)`,
          reservedCredits: sql`0`
        })
        .from(entities)
        .leftJoin(credits, and(
          eq(credits.entityId, entities.entityId),
          eq(credits.isActive, true)
        ))
        .where(and(
          eq(entities.tenantId, tenantId),
          eq(entities.isActive, true)
        ))
        .orderBy(entities.entityLevel, entities.createdAt);

      // Build hierarchy tree
      interface HierarchyNode {
        entityId: string;
        children: HierarchyNode[];
        availableCredits: number;
        reservedCredits: number;
        [key: string]: unknown;
      }
      const entityMap = new Map<string, HierarchyNode>();
      const rootEntities: HierarchyNode[] = [];

      // First pass: create all nodes
      allEntities.forEach((entity: { entityId: string; availableCredits?: unknown; reservedCredits?: unknown; [key: string]: unknown }) => {
        const node: HierarchyNode = {
          ...entity,
          children: [],
          availableCredits: Number(entity.availableCredits ?? 0),
          reservedCredits: Number(entity.reservedCredits ?? 0)
        };
        entityMap.set(entity.entityId, node);
      });

      // Second pass: build tree structure
      allEntities.forEach((entity: { entityId: string; parentEntityId: string | null }) => {
        const node = entityMap.get(entity.entityId)!;

        if (entity.parentEntityId && entityMap.has(entity.parentEntityId)) {
          // Add as child to parent
          const parent = entityMap.get(entity.parentEntityId)!;
          parent.children.push(node);
        } else {
          // Add as root entity
          rootEntities.push(node);
        }
      });

      return {
        success: true,
        hierarchy: rootEntities,
        totalEntities: allEntities.length,
        message: 'Entity hierarchy retrieved successfully'
      };

    } catch (error: unknown) {
      console.error('Error getting entity hierarchy:', error);
      return {
        success: false,
        hierarchy: [],
        totalEntities: 0,
        message: `Failed to get hierarchy: ${(error as Error).message}`
      };
    }
  }

  /**
   * Rebuild all hierarchy paths for a tenant (useful for data migration)
   */
  static async rebuildAllHierarchyPaths(tenantId: string): Promise<{ success: boolean; updatedCount?: number; error?: string }> {
    try {
      console.log('🔄 Rebuilding all hierarchy paths for tenant:', tenantId);

      // Get all entities for the tenant
      const allEntities = await db
        .select({
          entityId: entities.entityId,
          entityName: entities.entityName
        })
        .from(entities)
        .where(eq(entities.tenantId, tenantId))
        .orderBy(entities.entityLevel);

      let updatedCount = 0;

      // Update each entity
      for (const entity of allEntities) {
        const hierarchyPath = await this.buildHierarchyPath(entity.entityId);
        const fullHierarchyPath = await this.buildFullHierarchyPath(entity.entityId);
        const entityLevel = this.calculateEntityLevel(hierarchyPath);

        await db
          .update(entities)
          .set({
            hierarchyPath,
            fullHierarchyPath,
            entityLevel,
            updatedAt: new Date()
          })
          .where(eq(entities.entityId, entity.entityId));

        updatedCount++;
      }

      console.log(`✅ Rebuilt hierarchy paths for ${updatedCount} entities`);
      return { success: true, updatedCount };

    } catch (error: unknown) {
      console.error('❌ Error rebuilding hierarchy paths:', error);
      return { success: false, error: (error as Error).message };
    }
  }
}

export default HierarchyManager;
