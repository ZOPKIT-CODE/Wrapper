export interface CrmRoleTemplate {
  key: string;
  roleName: string;
  description: string;
  color: string;
  permissions: Record<string, Record<string, string[]>>;
}

export const CRM_ROLE_TEMPLATES: CrmRoleTemplate[] = [
  {
    key: 'crm_admin',
    roleName: 'CRM Admin',
    description: 'Full CRM access including system settings, user management, and all data',
    color: '#dc2626',
    permissions: {
      crm: {
        leads:               ['read', 'create', 'update', 'delete'],
        accounts:            ['read', 'create', 'update', 'delete'],
        contacts:            ['read', 'create', 'update', 'delete'],
        opportunities:       ['read', 'create', 'update', 'delete'],
        tickets:             ['read', 'create', 'update', 'delete'],
        invoices:            ['read', 'create', 'update', 'delete'],
        quotations:          ['read', 'create', 'update', 'delete'],
        'sales-orders':      ['read', 'create', 'update', 'delete'],
        inventory:           ['read', 'create', 'update', 'delete'],
        tasks:               ['read', 'create', 'update', 'delete'],
        meetings:            ['read', 'create', 'update', 'delete'],
        calls:               ['read', 'create', 'update', 'delete'],
        events:              ['read', 'create', 'update', 'delete'],
        communications:      ['read', 'create', 'update', 'delete'],
        documents:           ['read', 'create', 'delete'],
        notes:               ['read', 'create', 'update', 'delete'],
        activities:          ['read'],
        notifications:       ['read', 'update'],
        calendar:            ['read'],
        bulk_upload:         ['read', 'create', 'delete'],
        webforms:            ['read', 'create', 'update', 'delete'],
        email_templates:     ['read', 'create', 'update', 'delete'],
        cadences:            ['read', 'create', 'update', 'delete'],
        marketing_campaigns: ['read', 'create', 'update', 'delete'],
        approval_processes:  ['read', 'create', 'update', 'delete', 'approve'],
        custom_fields:       ['read', 'manage'],
        layouts:             ['read', 'manage'],
        custom_buttons:      ['read', 'manage', 'execute'],
        custom_functions:    ['read', 'manage', 'execute'],
        webhooks:            ['read', 'create', 'update', 'delete'],
        system: [
          'settings_read', 'settings_update',
          'configurations_read', 'configurations_create', 'configurations_update', 'configurations_delete',
          'users_read', 'users_read_all', 'users_create', 'users_update', 'users_delete', 'users_activate',
          'roles_read', 'roles_read_all', 'roles_create', 'roles_update', 'roles_delete', 'roles_assign',
          'audit_read', 'audit_read_all', 'audit_export', 'audit_view_details', 'audit_filter',
          'activity_logs_read', 'activity_logs_read_all', 'activity_logs_export',
          'reports_read', 'reports_read_all', 'reports_create', 'reports_update', 'reports_delete', 'reports_export', 'reports_schedule',
        ],
      },
    },
  },
  {
    key: 'crm_sales_rep',
    roleName: 'Sales Rep',
    description: 'Manages own pipeline: leads, contacts, accounts, opportunities, and quotes',
    color: '#059669',
    permissions: {
      crm: {
        leads:              ['read', 'create', 'update'],
        accounts:           ['read', 'create', 'update'],
        contacts:           ['read', 'create', 'update'],
        opportunities:      ['read', 'create', 'update'],
        quotations:         ['read', 'create', 'update'],
        invoices:           ['read'],
        'sales-orders':     ['read', 'create', 'update'],
        tickets:            ['read', 'create', 'update'],
        tasks:              ['read', 'create', 'update', 'delete'],
        meetings:           ['read', 'create', 'update', 'delete'],
        calls:              ['read', 'create', 'update'],
        events:             ['read', 'create', 'update'],
        communications:     ['read', 'create'],
        documents:          ['read', 'create'],
        notes:              ['read', 'create', 'update'],
        activities:         ['read'],
        notifications:      ['read', 'update'],
        calendar:           ['read'],
        email_templates:    ['read'],
        cadences:           ['read'],
        approval_processes: ['read'],
      },
    },
  },
  {
    key: 'crm_support_agent',
    roleName: 'Support Agent',
    description: 'Handles support tickets with read-only access to related records',
    color: '#ca8a04',
    permissions: {
      crm: {
        tickets:         ['read', 'create', 'update', 'delete'],
        contacts:        ['read', 'create', 'update'],
        accounts:        ['read'],
        tasks:           ['read', 'create', 'update', 'delete'],
        meetings:        ['read', 'create', 'update'],
        calls:           ['read', 'create', 'update'],
        events:          ['read', 'create'],
        communications:  ['read', 'create', 'update', 'delete'],
        documents:       ['read', 'create'],
        notes:           ['read', 'create', 'update'],
        activities:      ['read'],
        notifications:   ['read', 'update'],
        calendar:        ['read'],
        email_templates: ['read'],
      },
    },
  },
  {
    key: 'crm_viewer',
    roleName: 'Viewer',
    description: 'Read-only access across all CRM modules for executives and auditors',
    color: '#6b7280',
    permissions: {
      crm: {
        leads:          ['read'],
        accounts:       ['read'],
        contacts:       ['read'],
        opportunities:  ['read'],
        tickets:        ['read'],
        quotations:     ['read'],
        invoices:       ['read'],
        'sales-orders': ['read'],
        inventory:      ['read'],
        tasks:          ['read'],
        meetings:       ['read'],
        calls:          ['read'],
        communications: ['read'],
        documents:      ['read'],
        notes:          ['read'],
        activities:     ['read'],
        notifications:  ['read', 'update'],
        calendar:       ['read'],
      },
    },
  },
];

export function getCrmRoleTemplate(key: string): CrmRoleTemplate | undefined {
  return CRM_ROLE_TEMPLATES.find((t) => t.key === key);
}

export function countTemplatePermissions(template: CrmRoleTemplate): { total: number; modules: number } {
  let total = 0;
  let modules = 0;
  for (const app of Object.values(template.permissions)) {
    for (const actions of Object.values(app)) {
      total += actions.length;
      modules++;
    }
  }
  return { total, modules };
}
