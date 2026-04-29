/**
 * 🚀 **ADMIN FEATURE**
 * Centralized admin feature module
 * Exports all admin routes and services
 */

// Routes
export { default as adminRoutes } from './routes/admin.js';
export { default as adminDashboardRoutes } from './routes/dashboard.js';
export { default as adminTenantManagementRoutes } from './routes/tenant-management.js';
export { default as adminEntityManagementRoutes } from './routes/entity-management.js';
export { default as adminCreditOverviewRoutes } from './routes/credit-overview.js';
export { default as adminCreditConfigurationRoutes } from './routes/credit-configuration.js';
export { default as adminApplicationAssignmentRoutes } from './routes/application-assignment.js';
export { default as adminOperationCostRoutes } from './routes/operation-costs.js';
export { default as seasonalCreditsRoutes } from './routes/seasonal-credits.js';
export { default as seasonalCreditBatchesRoutes } from './routes/seasonal-credit-batches.js';
export { default as adminNotificationRoutes } from './routes/admin-notifications.js';
export { default as tenantRoutes } from './routes/tenants.js';
export { default as adminPromotionRoutes } from './routes/admin-promotion.js';

// Services
export { DashboardService } from './services/DashboardService.js';
export { TenantAdminService } from './services/TenantAdminService.js';
export { EntityAdminService } from './services/EntityAdminService.js';
export { CreditAdminService } from './services/CreditAdminService.js';
export { AdminPromotionService } from './services/admin-promotion-service.js';
