// App constants
export const APP_NAME = "Wrapper Business Suite"
export const APP_VERSION = "1.0.0"

// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'
export const API_TIMEOUT = 30000 // 30 seconds

// Pagination
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

// Cache Configuration
export const CACHE_STALE_TIME = 5 * 60 * 1000 // 5 minutes
export const CACHE_GC_TIME = 10 * 60 * 1000 // 10 minutes

// Theme Configuration
export const THEME_STORAGE_KEY = 'wrapper-theme'
export const DEFAULT_THEME = 'system'

// Local Storage Keys
export const STORAGE_KEYS = {
  THEME: 'wrapper-theme',
  SIDEBAR_STATE: 'wrapper-sidebar-state',
  USER_PREFERENCES: 'wrapper-user-preferences',
  AUTH_TOKEN: 'wrapper-auth-token',
} as const

// Route Paths
export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  USERS: '/dashboard/users',
  ORGANIZATIONS: '/dashboard/organizations',
  APPLICATIONS: '/dashboard/applications',
  ANALYTICS: '/dashboard/analytics',
  BILLING: '/dashboard/billing',
  SETTINGS: '/dashboard/settings',
  LOGIN: '/login',
  LOGOUT: '/logout',
} as const

// Feature Flags
export const FEATURE_FLAGS = {
  ANALYTICS: true,
  BILLING: true,
  ORGANIZATIONS: true,
  USER_MANAGEMENT: true,
  APPLICATION_MANAGEMENT: true,
} as const

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  SERVER_ERROR: 'Server error. Please try again later.',
  UNAUTHORIZED: 'Please log in to continue.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  UNKNOWN_ERROR: 'An unexpected error occurred.',
} as const

// Success Messages
export const SUCCESS_MESSAGES = {
  USER_CREATED: 'User created successfully.',
  USER_UPDATED: 'User updated successfully.',
  USER_DELETED: 'User deleted successfully.',
  ORGANIZATION_CREATED: 'Organization created successfully.',
  ORGANIZATION_UPDATED: 'Organization updated successfully.',
  APPLICATION_CREATED: 'Application created successfully.',
  APPLICATION_UPDATED: 'Application updated successfully.',
} as const

// Validation Rules
export const VALIDATION_RULES = {
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 100,
  EMAIL_MAX_LENGTH: 255,
  DESCRIPTION_MAX_LENGTH: 500,
} as const

// Performance Thresholds
export const PERFORMANCE_THRESHOLDS = {
  SLOW_OPERATION_MS: 100,
  API_TIMEOUT_MS: 30000,
  DEBOUNCE_MS: 300,
} as const
