/**
 * API Module — re-exports all API clients and types from their dedicated files.
 *
 * Import from '@/lib/api' as before:
 *   import { api, subscriptionAPI, Role } from '@/lib/api'
 *   import api from '@/lib/api'
 *
 * Or import from specific modules for narrower dependencies:
 *   import { subscriptionAPI } from '@/lib/api/subscription'
 */

// Core client & helpers
export { api, getIdpToken, setIdpTokenGetter, createCancelableRequest, NETWORK_QUALITY_EVENT } from './client'
export { default } from './client'

// Shared types
export type {
  User,
  UnifiedUser,
  ApiResponse,
  Tenant,
  Subscription,
  UsageMetrics,
  Plan,
  Permission,
  Role,
  RoleTemplate,
  RoleAssignment,
  AuditLogEntry,
} from './types'

// API modules
export { authAPI } from './auth'
export { tenantAPI } from './tenant'
export { subscriptionAPI } from './subscription'
export { analyticsAPI } from './analytics'
export { usageAPI } from './usage'
export { permissionsAPI } from './permissions'
export { onboardingAPI } from './onboarding'
export { creditAPI } from './credits'
export { applicationAssignmentAPI } from './application-assignments'
export { operationCostAPI, smartOperationCostAPI } from './operation-costs'
export { creditConfigurationAPI, applicationCreditAPI } from './credit-configuration'
export { invitationAPI } from './invitations'
export { seasonalCreditsAPI, seasonalCreditBatchesAPI } from './seasonal-credits'
