/**
 * Admin feature — pages and components (avoid barrel-importing this file from routes;
 * import page files directly in lazy routes).
 */

export { default as AdminDashboardPage } from './pages/AdminDashboardPage'

export { default as AdminDashboardComponent } from './components/AdminDashboard'
export { TenantManagement } from './components/TenantManagement'
export { EntityManagement } from './components/EntityManagement'
export { CreditManagement } from './components/CreditManagement'
export { default as ApplicationAssignmentManager } from './components/ApplicationAssignmentManager'
export { default as ExpiryManagementPanel } from './components/ExpiryManagementPanel'
export { default as SeasonalCreditsManagement } from './components/SeasonalCreditsManagement'

export * from './components/credit-configuration'
