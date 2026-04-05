import { PermissionItem, User, Role } from './mockPermissions'

// Kinde Layer - Basic Tool Access
export interface KindePermission {
  id: string
  name: string
  description: string
  tool: string
  type: 'tool_access' | 'feature_flag'
  subscriptionLevel: 'trial' | 'starter' | 'professional' | 'enterprise'
  isEnabled: boolean
}

// Enhanced Permission with Granular Controls
export interface GranularPermission extends PermissionItem {
  kindePermissionId?: string
  restrictions: GranularRestriction[]
  contexts: PermissionContext[]
  valueConstraints: ValueConstraint[]
  timeConstraints: TimeConstraint[]
  dataAccessRules: DataAccessRule[]
}

// Granular Restriction System
export interface GranularRestriction {
  id: string
  name: string
  type: 'value_limit' | 'time_based' | 'location_based' | 'data_scope' | 'action_frequency' | 'approval_required'
  category: 'financial' | 'temporal' | 'geographical' | 'data_privacy' | 'workflow' | 'security'
  icon: string
  color: string
  configurable: boolean
  defaultValue: any
  validation: {
    min?: number
    max?: number
    pattern?: string
    required: boolean
  }
  affectedActions: string[]
  description: string
}

export interface ValueConstraint {
  field: string
  operator: '>' | '<' | '=' | '>=' | '<=' | 'between' | 'in' | 'not_in'
  value: any
  currency?: string
  unit?: string
}

export interface TimeConstraint {
  type: 'business_hours' | 'specific_days' | 'time_range' | 'duration_limit'
  value: any
  timezone: string
}

export interface DataAccessRule {
  scope: 'own_records' | 'team_records' | 'department_records' | 'all_records'
  filters: Record<string, any>
  fieldRestrictions: string[]
  exportLimits: {
    daily: number
    weekly: number
    monthly: number
  }
}

export interface PermissionContext {
  id: string
  name: string
  trigger: 'record_value' | 'user_role' | 'time_period' | 'approval_status' | 'record_age'
  conditions: any
  effects: {
    enableActions?: string[]
    disableActions?: string[]
    addRestrictions?: string[]
    removeRestrictions?: string[]
  }
}

// Custom Role with Inheritance
export interface CustomRole extends Role {
  parentRoles: string[]
  childRoles: string[]
  isTemplate: boolean
  templateCategory: string
  customPermissions: GranularPermission[]
  inheritanceRules: {
    inheritAll: boolean
    excludePermissions: string[]
    additionalPermissions: string[]
    overrideRestrictions: Record<string, any>
  }
  autoAssignmentRules: {
    department?: string[]
    jobTitle?: string[]
    seniority?: string
    conditions?: any[]
  }
  approvalWorkflow: {
    required: boolean
    approvers: string[]
    escalation: any[]
  }
}

// Restriction Templates
export const granularRestrictions: GranularRestriction[] = [
  {
    id: 'financial_deal_limit',
    name: 'Deal Value Limit',
    type: 'value_limit',
    category: 'financial',
    icon: '💰',
    color: '#059669',
    configurable: true,
    defaultValue: 50000,
    validation: {
      min: 1000,
      max: 10000000,
      required: true
    },
    affectedActions: ['crm.deals.create', 'crm.deals.edit', 'crm.deals.approve'],
    description: 'Maximum deal value that can be created or edited'
  },
  {
    id: 'time_business_hours',
    name: 'Business Hours Only',
    type: 'time_based',
    category: 'temporal',
    icon: '🕒',
    color: '#3B82F6',
    configurable: true,
    defaultValue: { start: '09:00', end: '17:00', timezone: 'UTC', weekdays: true },
    validation: { required: false },
    affectedActions: ['hr.payroll.process', 'accounting.invoices.approve'],
    description: 'Restrict access to business hours only'
  },
  {
    id: 'approval_high_value',
    name: 'Approval Required',
    type: 'approval_required',
    category: 'workflow',
    icon: '✋',
    color: '#F59E0B',
    configurable: true,
    defaultValue: { threshold: 25000, approvers: ['manager'], escalation: true },
    validation: { required: true },
    affectedActions: ['crm.deals.approve', 'accounting.expenses.approve'],
    description: 'Requires approval for high-value transactions'
  },
  {
    id: 'data_own_records',
    name: 'Own Records Only',
    type: 'data_scope',
    category: 'data_privacy',
    icon: '🔒',
    color: '#8B5CF6',
    configurable: false,
    defaultValue: true,
    validation: { required: false },
    affectedActions: ['crm.contacts.view', 'crm.deals.view', 'hr.employees.view'],
    description: 'User can only access their own records'
  },
  {
    id: 'location_office_only',
    name: 'Office Location Only',
    type: 'location_based',
    category: 'geographical',
    icon: '📍',
    color: '#EF4444',
    configurable: true,
    defaultValue: { allowedIPs: ['192.168.1.0/24'], geoRestriction: true },
    validation: { required: false },
    affectedActions: ['hr.payroll.view', 'accounting.reports.export'],
    description: 'Access restricted to office locations'
  },
  {
    id: 'frequency_daily_limit',
    name: 'Daily Action Limit',
    type: 'action_frequency',
    category: 'security',
    icon: '📊',
    color: '#06B6D4',
    configurable: true,
    defaultValue: { daily: 100, hourly: 10 },
    validation: { min: 1, max: 1000, required: true },
    affectedActions: ['crm.contacts.export', 'hr.employees.export'],
    description: 'Limit number of actions per time period'
  }
]

// Kinde Permissions (Tool-level access)
export const kindePermissions: KindePermission[] = [
  {
    id: 'kinde_crm_access',
    name: 'CRM Tool Access',
    description: 'Basic access to CRM functionality',
    tool: 'crm',
    type: 'tool_access',
    subscriptionLevel: 'starter',
    isEnabled: true
  },
  {
    id: 'kinde_hr_access',
    name: 'HR Tool Access',
    description: 'Basic access to HR functionality',
    tool: 'hr',
    type: 'tool_access',
    subscriptionLevel: 'professional',
    isEnabled: true
  },
  {
    id: 'kinde_advanced_analytics',
    name: 'Advanced Analytics',
    description: 'Feature flag for advanced analytics',
    tool: 'all',
    type: 'feature_flag',
    subscriptionLevel: 'enterprise',
    isEnabled: false
  },
  {
    id: 'kinde_api_access',
    name: 'API Access',
    description: 'Access to REST API endpoints',
    tool: 'all',
    type: 'feature_flag',
    subscriptionLevel: 'professional',
    isEnabled: true
  }
]

// Enhanced Granular Permissions
export const granularPermissions: GranularPermission[] = [
  {
    id: 'crm.contacts.view',
    name: 'View Contacts',
    description: 'View and browse contact information with customizable restrictions',
    category: 'CRM - Contacts',
    tool: 'crm',
    resource: 'contacts',
    action: 'view',
    icon: '👁️',
    color: '#3B82F6',
    level: 'basic',
    kindePermissionId: 'kinde_crm_access',
    restrictions: ['data_own_records', 'location_office_only'],
    contexts: [
      {
        id: 'high_value_contact',
        name: 'High-Value Contact Access',
        trigger: 'record_value',
        conditions: { contact_value: { $gte: 100000 } },
        effects: {
          enableActions: ['crm.contacts.priority_support'],
          addRestrictions: ['approval_high_value']
        }
      }
    ],
    valueConstraints: [
      {
        field: 'contact_value',
        operator: '<=',
        value: 500000,
        currency: 'USD'
      }
    ],
    timeConstraints: [
      {
        type: 'business_hours',
        value: { start: '09:00', end: '17:00' },
        timezone: 'UTC'
      }
    ],
    dataAccessRules: [
      {
        scope: 'team_records',
        filters: { department: 'sales' },
        fieldRestrictions: ['ssn', 'personal_notes'],
        exportLimits: { daily: 100, weekly: 500, monthly: 2000 }
      }
    ]
  },
  {
    id: 'crm.deals.approve',
    name: 'Approve Deals',
    description: 'Approve deals with dynamic value-based restrictions',
    category: 'CRM - Deals',
    tool: 'crm',
    resource: 'deals',
    action: 'approve',
    icon: '✅',
    color: '#059669',
    level: 'admin',
    kindePermissionId: 'kinde_crm_access',
    restrictions: ['financial_deal_limit', 'approval_high_value', 'time_business_hours'],
    contexts: [
      {
        id: 'weekend_approval',
        name: 'Weekend High-Value Approval',
        trigger: 'time_period',
        conditions: { isWeekend: true, dealValue: { $gte: 50000 } },
        effects: {
          disableActions: ['crm.deals.approve'],
          addRestrictions: ['approval_high_value']
        }
      }
    ],
    valueConstraints: [
      {
        field: 'deal_value',
        operator: '<=',
        value: 1000000,
        currency: 'USD'
      }
    ],
    timeConstraints: [
      {
        type: 'business_hours',
        value: { start: '08:00', end: '18:00' },
        timezone: 'UTC'
      }
    ],
    dataAccessRules: [
      {
        scope: 'department_records',
        filters: { status: 'pending_approval' },
        fieldRestrictions: [],
        exportLimits: { daily: 50, weekly: 200, monthly: 800 }
      }
    ]
  }
]

// Custom Role Templates
export const customRoleTemplates: CustomRole[] = [
  {
    id: 'template_senior_sales',
    name: 'Senior Sales Executive',
    description: 'High-performing sales professional with extended deal limits',
    color: '#059669',
    icon: '🏆',
    type: 'custom',
    userCount: 0,
    permissions: ['crm.contacts.view', 'crm.contacts.create', 'crm.deals.view', 'crm.deals.create'],
    restrictions: {
      'crm.deals.value_limit': 500000,
      'crm.contacts.bulk_actions': true
    },
    createdAt: new Date().toISOString(),
    isDefault: false,
    parentRoles: ['template_sales_rep'],
    childRoles: [],
    isTemplate: true,
    templateCategory: 'sales',
    customPermissions: [],
    inheritanceRules: {
      inheritAll: true,
      excludePermissions: [],
      additionalPermissions: ['crm.deals.approve'],
      overrideRestrictions: {
        'financial_deal_limit': 500000
      }
    },
    autoAssignmentRules: {
      department: ['sales'],
      seniority: 'senior',
      conditions: [
        { field: 'sales_performance', operator: '>=', value: 90 },
        { field: 'tenure_months', operator: '>=', value: 12 }
      ]
    },
    approvalWorkflow: {
      required: true,
      approvers: ['sales_director'],
      escalation: []
    }
  },
  {
    id: 'template_financial_controller',
    name: 'Financial Controller',
    description: 'Complete financial oversight with all accounting permissions',
    color: '#8B5CF6',
    icon: '💼',
    type: 'custom',
    userCount: 0,
    permissions: ['accounting.invoices.view', 'accounting.invoices.create', 'accounting.reports.view'],
    restrictions: {},
    createdAt: new Date().toISOString(),
    isDefault: false,
    parentRoles: ['template_accountant'],
    childRoles: ['template_junior_accountant'],
    isTemplate: true,
    templateCategory: 'finance',
    customPermissions: [],
    inheritanceRules: {
      inheritAll: true,
      excludePermissions: [],
      additionalPermissions: ['accounting.reports.export', 'accounting.budgets.approve'],
      overrideRestrictions: {}
    },
    autoAssignmentRules: {
      department: ['finance', 'accounting'],
      jobTitle: ['controller', 'financial controller', 'finance director']
    },
    approvalWorkflow: {
      required: true,
      approvers: ['cfo', 'ceo'],
      escalation: []
    }
  }
]
