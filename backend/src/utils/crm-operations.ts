/**
 * 🛠️ CRM OPERATIONS UTILITY
 * Provides user-context-aware CRUD operations for all CRM modules
 * Integrates automatic audit logging and permission validation
 */

import Logger from './logger.js';

// Stub when crm-auth-middleware does not export CRMAuditLogger
const CRMAuditLogger = {
  async logOperation(_req: unknown, _op: unknown, _entityType: string, _id: unknown, _details?: unknown): Promise<void> {}
};

export interface CRMOptions {
  module?: string;
  entityType?: string;
  skipAudit?: boolean;
  populate?: string[];
  softDelete?: boolean;
}

export interface CRMRequest {
  userContext?: {
    tenantId: string;
    userId: string;
    email?: string;
    isTenantAdmin?: boolean;
    hasPermission: (p: string) => boolean;
  };
}

export class CRMOperations {
  
  /**
   * 📝 CREATE OPERATION
   * Creates a new record with user context and audit logging
   */
  static async create(req: CRMRequest, model: { create: (data: Record<string, unknown>) => Promise<Record<string, unknown>> }, data: Record<string, unknown>, options: CRMOptions = {}): Promise<Record<string, unknown>> {
    const { module = 'unknown', entityType = 'unknown', skipAudit = false } = options;
    
    if (!req.userContext) {
      throw new Error('User context required for CRM operations');
    }

    try {
      // Ensure tenant isolation
      const recordData = {
        ...data,
        tenantId: req.userContext.tenantId,
        createdBy: req.userContext.userId,
        updatedBy: req.userContext.userId
      };

      // Create the record
      const record = await model.create(recordData);

      // Log the operation
      if (!skipAudit) {
        await CRMAuditLogger.logOperation(req, {
          action: 'create',
          module,
          description: `Created new ${entityType}`
        }, entityType, record._id || record.id, {
          newValues: recordData,
          name: data.name || data.companyName || data.title || data.subject
        });
      }

      Logger.log('info', 'crm', 'create', `CRM: Created ${entityType} by ${req.userContext.email}`, {
        entityType,
        id: record._id || record.id,
        tenant: req.userContext.tenantId,
        email: req.userContext.email
      });

      return record;
    } catch (error) {
      const err = error as Error;
      Logger.log('error', 'crm', 'create', `CRM: Failed to create ${entityType}`, { entityType, error: err.message, stack: err.stack });
      throw error;
    }
  }

  /**
   * 📖 READ OPERATION
   * Retrieves records with proper tenant isolation and user permissions
   */
  static async read(req: CRMRequest, model: { find: (q: Record<string, unknown>) => { populate: (f: string) => unknown; exec: () => Promise<unknown[]> } }, filters: Record<string, unknown> = {}, options: CRMOptions = {}): Promise<unknown[]> {
    const { module = 'unknown', entityType = 'unknown', skipAudit = false, populate = [] } = options;
    
    if (!req.userContext) {
      throw new Error('User context required for CRM operations');
    }

    try {
      // Apply tenant isolation
      const query: Record<string, unknown> = {
        ...filters,
        tenantId: req.userContext.tenantId
      };

      // Apply user-based filtering if not admin
      if (!req.userContext.isTenantAdmin) {
        // Check if user has read_all permission for this module
        const hasReadAll = req.userContext.hasPermission(`crm.${module}.read_all`);
        
        if (!hasReadAll) {
          // Restrict to records owned/assigned to user
          (query as Record<string, unknown[]>).$or = [
            { createdBy: req.userContext.userId },
            { assignedTo: req.userContext.userId },
            { ownerId: req.userContext.userId }
          ];
        }
      }

      let queryBuilder = model.find(query) as { populate: (f: string) => typeof queryBuilder; exec: () => Promise<unknown[]> };
      
      // Apply population if specified
      for (const field of populate) {
        queryBuilder = queryBuilder.populate(field) as typeof queryBuilder;
      }

      const records = await queryBuilder.exec();

      // Log the operation (optional for read operations)
      if (!skipAudit && records.length > 0) {
        await CRMAuditLogger.logOperation(req, {
          action: 'read',
          module,
          description: `Retrieved ${records.length} ${entityType} records`
        }, entityType, 'multiple', {
          recordCount: records.length
        });
      }

      return records;
    } catch (error) {
      const err = error as Error;
      Logger.log('error', 'crm', 'read', `CRM: Failed to read ${entityType}`, { entityType, error: err.message, stack: err.stack });
      throw error;
    }
  }

  /**
   * 📝 UPDATE OPERATION
   * Updates a record with user context and change tracking
   */
  static async update(req: CRMRequest, model: { findOne: (q: Record<string, unknown>) => Promise<Record<string, unknown> | null>; findByIdAndUpdate: (id: unknown, data: Record<string, unknown>, opts: { new: boolean; runValidators: boolean }) => Promise<Record<string, unknown>> }, id: unknown, updateData: Record<string, unknown>, options: CRMOptions = {}): Promise<Record<string, unknown>> {
    const { module = 'unknown', entityType = 'unknown', skipAudit = false } = options;
    
    if (!req.userContext) {
      throw new Error('User context required for CRM operations');
    }

    try {
      // Find the existing record first
      const existingRecord = await model.findOne({
        _id: id,
        tenantId: req.userContext.tenantId
      });

      if (!existingRecord) {
        throw new Error(`${entityType} not found or access denied`);
      }

      // Check if user can update this record
      if (!req.userContext.isTenantAdmin) {
        const hasUpdateAll = req.userContext.hasPermission(`crm.${module}.update_all`);
        
        if (!hasUpdateAll) {
          // Check if user owns or is assigned to this record
          const canUpdate = existingRecord.createdBy?.toString() === req.userContext.userId ||
                           existingRecord.assignedTo?.toString() === req.userContext.userId ||
                           existingRecord.ownerId?.toString() === req.userContext.userId;
          
          if (!canUpdate) {
            throw new Error('Permission denied: Cannot update this record');
          }
        }
      }

      // Prepare update data
      const finalUpdateData = {
        ...updateData,
        updatedBy: req.userContext.userId,
        updatedAt: new Date()
      };

      // Update the record
      const updatedRecord = await model.findByIdAndUpdate(
        id, 
        finalUpdateData, 
        { new: true, runValidators: true }
      );

      // Track changes for audit
      const changedFields = Object.keys(updateData);
      const oldValues: Record<string, unknown> = {};
      for (const field of changedFields) {
        oldValues[field] = (existingRecord as Record<string, unknown>)[field];
      }

      // Log the operation
      if (!skipAudit) {
        await CRMAuditLogger.logOperation(req, {
          action: 'update',
          module,
          description: `Updated ${entityType}`
        }, entityType, id, {
          oldValues,
          newValues: updateData,
          changedFields,
          name: updatedRecord.name || updatedRecord.companyName || updatedRecord.title
        });
      }

      Logger.log('info', 'crm', 'update', `CRM: Updated ${entityType} by ${req.userContext.email}`, {
        entityType,
        id,
        changedFields,
        tenant: req.userContext.tenantId,
        email: req.userContext.email
      });

      return updatedRecord;
    } catch (error) {
      const err = error as Error;
      Logger.log('error', 'crm', 'update', `CRM: Failed to update ${entityType}`, { entityType, error: err.message, stack: err.stack });
      throw error;
    }
  }

  /**
   * 🗑️ DELETE OPERATION
   * Deletes a record with proper permissions and audit logging
   */
  static async delete(req: CRMRequest, model: { findOne: (q: Record<string, unknown>) => Promise<Record<string, unknown> | null>; findByIdAndUpdate: (id: unknown, data: Record<string, unknown>, opts: { new: boolean }) => Promise<unknown>; findByIdAndDelete: (id: unknown) => Promise<unknown> }, id: unknown, options: CRMOptions = {}): Promise<unknown> {
    const { module = 'unknown', entityType = 'unknown', skipAudit = false, softDelete = true } = options;
    
    if (!req.userContext) {
      throw new Error('User context required for CRM operations');
    }

    try {
      // Find the existing record first
      const existingRecord = await model.findOne({
        _id: id,
        tenantId: req.userContext.tenantId
      });

      if (!existingRecord) {
        throw new Error(`${entityType} not found or access denied`);
      }

      // Check if user can delete this record
      if (!req.userContext.isTenantAdmin) {
        const hasDeleteAll = req.userContext.hasPermission(`crm.${module}.delete_all`);
        
        if (!hasDeleteAll) {
          // Check if user owns this record
          const canDelete = existingRecord.createdBy?.toString() === req.userContext.userId;
          
          if (!canDelete) {
            throw new Error('Permission denied: Cannot delete this record');
          }
        }
      }

      let result;
      
      if (softDelete) {
        // Soft delete - mark as deleted
        result = await model.findByIdAndUpdate(id, {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: req.userContext.userId
        }, { new: true });
      } else {
        // Hard delete
        result = await model.findByIdAndDelete(id);
      }

      // Log the operation
      if (!skipAudit) {
        await CRMAuditLogger.logOperation(req, {
          action: softDelete ? 'soft_delete' : 'delete',
          module,
          description: `${softDelete ? 'Soft deleted' : 'Permanently deleted'} ${entityType}`
        }, entityType, id, {
          oldValues: typeof (existingRecord as { toObject?: () => Record<string, unknown> }).toObject === 'function' ? (existingRecord as { toObject: () => Record<string, unknown> }).toObject() : existingRecord,
          name: existingRecord.name || existingRecord.companyName || existingRecord.title
        });
      }

      Logger.log('info', 'crm', 'delete', `CRM: ${softDelete ? 'Soft deleted' : 'Deleted'} ${entityType} by ${req.userContext.email}`, {
        entityType,
        id,
        softDelete,
        tenant: req.userContext.tenantId,
        email: req.userContext.email
      });

      return result;
    } catch (error) {
      const err = error as Error;
      Logger.log('error', 'crm', 'delete', `CRM: Failed to delete ${entityType}`, { entityType, error: err.message, stack: err.stack });
      throw error;
    }
  }

  /**
   * 🔄 ASSIGN OPERATION
   * Assigns a record to a user with proper permissions
   */
  static async assign(req: CRMRequest, model: { findOne: (q: Record<string, unknown>) => Promise<Record<string, unknown> | null>; findByIdAndUpdate: (id: unknown, data: Record<string, unknown>, opts: { new: boolean }) => Promise<Record<string, unknown>> }, id: unknown, assignToUserId: string, options: CRMOptions = {}): Promise<Record<string, unknown>> {
    const { module = 'unknown', entityType = 'unknown', skipAudit = false } = options;
    
    if (!req.userContext) {
      throw new Error('User context required for CRM operations');
    }

    try {
      // Check assignment permission
      if (!req.userContext.hasPermission(`crm.${module}.assign`)) {
        throw new Error('Permission denied: Cannot assign records');
      }

      // Find the existing record
      const existingRecord = await model.findOne({
        _id: id,
        tenantId: req.userContext.tenantId
      });

      if (!existingRecord) {
        throw new Error(`${entityType} not found or access denied`);
      }

      const oldAssignee = existingRecord.assignedTo;

      // Update assignment
      const updatedRecord = await model.findByIdAndUpdate(id, {
        assignedTo: assignToUserId,
        updatedBy: req.userContext.userId,
        updatedAt: new Date()
      }, { new: true });

      // Log the operation
      if (!skipAudit) {
        await CRMAuditLogger.logOperation(req, {
          action: 'assign',
          module,
          description: `Assigned ${entityType} to user`
        }, entityType, id, {
          oldValues: { assignedTo: oldAssignee },
          newValues: { assignedTo: assignToUserId },
          changedFields: ['assignedTo'],
          name: updatedRecord.name || updatedRecord.companyName || updatedRecord.title
        });
      }

      Logger.log('info', 'crm', 'assign', `CRM: Assigned ${entityType} by ${req.userContext.email}`, {
        entityType,
        id,
        assignedTo: assignToUserId,
        tenant: req.userContext.tenantId,
        email: req.userContext.email
      });

      return updatedRecord;
    } catch (error) {
      const err = error as Error;
      Logger.log('error', 'crm', 'assign', `CRM: Failed to assign ${entityType}`, { entityType, error: err.message, stack: err.stack });
      throw error;
    }
  }

  /**
   * 📊 BULK OPERATIONS
   * Performs bulk operations with proper permissions and audit logging
   */
  static async bulkOperation(req: CRMRequest, model: { updateMany: (q: Record<string, unknown>, data: Record<string, unknown>) => Promise<{ modifiedCount?: number; deletedCount?: number }>; deleteMany: (q: Record<string, unknown>) => Promise<{ deletedCount?: number }> }, operation: string, filters: Record<string, unknown>, updateData: Record<string, unknown> = {}, options: CRMOptions = {}): Promise<{ modifiedCount?: number; deletedCount?: number }> {
    const { module = 'unknown', entityType = 'unknown', skipAudit = false } = options;
    
    if (!req.userContext) {
      throw new Error('User context required for CRM operations');
    }

    try {
      // Check bulk operation permission
      if (!req.userContext.hasPermission('crm.bulk_operations')) {
        throw new Error('Permission denied: Cannot perform bulk operations');
      }

      // Apply tenant isolation to filters
      const query = {
        ...filters,
        tenantId: req.userContext.tenantId
      };

      let result: { modifiedCount?: number; deletedCount?: number };
      
      switch (operation) {
        case 'update': {
          const finalUpdateData = {
            ...updateData,
            updatedBy: req.userContext.userId,
            updatedAt: new Date()
          };
          result = await model.updateMany(query, finalUpdateData);
          break;
        }
        case 'delete':
          if (options.softDelete !== false) {
            result = await model.updateMany(query, {
              isDeleted: true,
              deletedAt: new Date(),
              deletedBy: req.userContext.userId
            });
          } else {
            result = await model.deleteMany(query);
          }
          break;
          
        default:
          throw new Error(`Unsupported bulk operation: ${operation}`);
      }

      // Log the operation
      if (!skipAudit) {
        await CRMAuditLogger.logOperation(req, {
          action: `bulk_${operation}`,
          module,
          description: `Bulk ${operation} operation on ${entityType}`
        }, entityType, 'multiple', {
          affectedCount: result.modifiedCount || result.deletedCount,
          filters
        });
      }

      Logger.log('info', 'crm', `bulk-${operation}`, `CRM: Bulk ${operation} ${entityType} by ${req.userContext.email}`, {
        entityType,
        operation,
        affected: result.modifiedCount || result.deletedCount,
        tenant: req.userContext.tenantId,
        email: req.userContext.email
      });

      return result;
    } catch (error) {
      const err = error as Error;
      Logger.log('error', 'crm', `bulk-${operation}`, `CRM: Failed bulk ${operation} ${entityType}`, { entityType, operation, error: err.message, stack: err.stack });
      throw error;
    }
  }

  /**
   * 🔍 SEARCH OPERATION
   * Performs search with proper tenant isolation and permissions
   */
  static async search(req: CRMRequest, model: { find: (q: Record<string, unknown>) => { limit: (n: number) => { skip: (n: number) => { sort: (s: Record<string, number>) => Promise<unknown[]> } } } }, searchQuery: string, searchFields: string[] = [], options: CRMOptions & { limit?: number; skip?: number } = {}): Promise<unknown[]> {
    const { module = 'unknown', entityType = 'unknown', limit = 50, skip = 0 } = options;
    
    if (!req.userContext) {
      throw new Error('User context required for CRM operations');
    }

    try {
      // Build search filters
      const searchFilters: Record<string, unknown> = {
        tenantId: req.userContext.tenantId
      };

      if (searchQuery && searchFields.length > 0) {
        (searchFilters as Record<string, unknown[]>).$or = searchFields.map(field => ({
          [field]: { $regex: searchQuery, $options: 'i' }
        }));
      }

      // Apply user-based filtering if not admin
      if (!req.userContext.isTenantAdmin) {
        const hasReadAll = req.userContext.hasPermission(`crm.${module}.read_all`);
        
        if (!hasReadAll) {
          const orClause = (searchFilters as Record<string, unknown>).$or;
          if (orClause) {
            (searchFilters as Record<string, unknown[]>).$and = [
              { $or: orClause },
              {
                $or: [
                  { createdBy: req.userContext.userId },
                  { assignedTo: req.userContext.userId },
                  { ownerId: req.userContext.userId }
                ]
              }
            ];
            delete (searchFilters as Record<string, unknown>).$or;
          } else {
            (searchFilters as Record<string, unknown[]>).$or = [
              { createdBy: req.userContext.userId },
              { assignedTo: req.userContext.userId },
              { ownerId: req.userContext.userId }
            ];
          }
        }
      }

      const results = await model.find(searchFilters)
        .limit(limit)
        .skip(skip)
        .sort({ updatedAt: -1 });

      Logger.log('info', 'crm', 'search', `CRM: Search ${entityType} by ${req.userContext.email}`, {
        entityType,
        query: searchQuery,
        results: results.length,
        tenant: req.userContext.tenantId,
        email: req.userContext.email
      });

      return results;
    } catch (error) {
      const err = error as Error;
      Logger.log('error', 'crm', 'search', `CRM: Failed to search ${entityType}`, { entityType, error: err.message, stack: err.stack });
      throw error;
    }
  }
}

/**
 * 🔧 CRM RESPONSE HELPERS
 * Standard response formatting for CRM operations
 */
export class CRMResponse {
  
  static success(res: { status: (code: number) => { json: (body: unknown) => unknown } }, data: unknown, message = 'Operation successful', metadata: Record<string, unknown> = {}): unknown {
    return res.status(200).json({
      success: true,
      message,
      data,
      metadata: {
        timestamp: new Date().toISOString(),
        ...metadata
      }
    });
  }

  static created(res: { status: (code: number) => { json: (body: unknown) => unknown } }, data: unknown, message = 'Resource created successfully'): unknown {
    return res.status(201).json({
      success: true,
      message,
      data,
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  }

  static error(res: { status: (code: number) => { json: (body: unknown) => unknown } }, message: string, statusCode = 400, details: Record<string, unknown> = {}): unknown {
    return res.status(statusCode).json({
      success: false,
      error: message,
      details,
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  }

  static unauthorized(res: { status: (code: number) => { json: (body: unknown) => unknown } }, message = 'Authentication required'): unknown {
    return res.status(401).json({
      success: false,
      error: message,
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  }

  static forbidden(res: { status: (code: number) => { json: (body: unknown) => unknown } }, message = 'Insufficient permissions'): unknown {
    return res.status(403).json({
      success: false,
      error: message,
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  }

  static notFound(res: { status: (code: number) => { json: (body: unknown) => unknown } }, message = 'Resource not found'): unknown {
    return res.status(404).json({
      success: false,
      error: message,
      metadata: {
        timestamp: new Date().toISOString()
      }
    });
  }
}

export default CRMOperations; 