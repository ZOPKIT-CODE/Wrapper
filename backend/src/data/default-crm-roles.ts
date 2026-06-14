export interface DefaultRoleDefinition {
  key: string;
  roleName: string;
  description: string;
  color: string;
  priority: number;
  permissions: Record<string, Record<string, string[]>>;
}

/**
 * Core 4 CRM roles seeded at tenant onboarding.
 * All are isSystemRole=true so tenant admins cannot delete them.
 * Permissions use the hierarchical format: { app: { module: [operations] } }
 * The CRM's loadPermissions() flattens these to dotted codes: "crm.leads.read".
 *
 * Module codes here MUST match the MODULE_MAP keys in server/src/lib/auto-module-permission.ts.
 * The correct module name for the activity feed is "activity" (singular), not "activities".
 * Admin modules (users, roles, pipelines, etc.) are in MODULE_MAP but gated by requirePermission
 * inside their route handlers; they are used for frontend nav visibility as well.
 */
export const DEFAULT_CRM_ROLES: DefaultRoleDefinition[] = [
  // ── 1. CRM Admin ─────────────────────────────────────────────────────────
  // Full access to every module including system settings, user/role management,
  // and audit logs. Assigned to the tenant owner on first login.
  {
    key: 'crm_admin',
    roleName: 'CRM Admin',
    description: 'Full CRM access including system settings, user management, and all data',
    color: '#dc2626',
    priority: 100,
    permissions: {
      crm: {
        // ── Core CRM ──────────────────────────────────────────────────────
        leads:               ['read', 'create', 'update', 'delete'],
        accounts:            ['read', 'create', 'update', 'delete'],
        contacts:            ['read', 'create', 'update', 'delete'],
        opportunities:       ['read', 'create', 'update', 'delete'],
        tickets:             ['read', 'create', 'update', 'delete'],
        // ── Finance / Orders ─────────────────────────────────────────────
        invoices:            ['read', 'create', 'update', 'delete'],
        quotations:          ['read', 'create', 'update', 'delete'],
        'sales-orders':      ['read', 'create', 'update', 'delete'],
        inventory:           ['read', 'create', 'update', 'delete'],
        // ── Activities ───────────────────────────────────────────────────
        tasks:               ['read', 'create', 'update', 'delete'],
        meetings:            ['read', 'create', 'update', 'delete'],
        calls:               ['read', 'create', 'update', 'delete'],
        communications:      ['read', 'create', 'update', 'delete'],
        documents:           ['read', 'create', 'delete'],
        attachments:         ['read', 'create', 'delete'],
        notes:               ['read', 'create', 'update', 'delete'],
        activity:            ['read'],
        notifications:       ['read', 'update'],
        calendar:            ['read'],
        // ── Analytics / BI ───────────────────────────────────────────────
        reports:             ['read', 'create', 'update', 'delete'],
        dashboards:          ['read', 'create', 'update', 'delete'],
        search:              ['read'],
        workqueue:           ['read'],
        // ── Marketing / Outreach ─────────────────────────────────────────
        email_templates:     ['read', 'create', 'update', 'delete'],
        cadences:            ['read', 'create', 'update', 'delete'],
        marketing_campaigns: ['read', 'create', 'update', 'delete'],
        marketing_lists:     ['read', 'create', 'update', 'delete'],
        marketing_email_sends: ['read', 'create', 'update', 'delete'],
        marketing_sms_sends: ['read', 'create', 'update', 'delete'],
        whatsapp_templates:  ['read', 'create', 'update', 'delete'],
        email_sender:        ['read', 'create', 'update', 'delete'],
        email_ai:            ['read', 'create', 'update', 'delete'],
        email_suppression:   ['read', 'create', 'update', 'delete'],
        // ── Lead Capture / Ops ───────────────────────────────────────────
        bulk_upload:         ['read', 'create', 'delete'],
        inbox_sync:          ['read', 'create', 'update', 'delete'],
        approval_processes:  ['read', 'create', 'update', 'delete', 'approve'],
        // ── Admin / Config ────────────────────────────────────────────────
        pipelines:           ['read', 'create', 'update', 'delete'],
        blueprints:          ['read', 'create', 'update', 'delete'],
        assignment_rules:    ['read', 'create', 'update', 'delete'],
        scoring_rules:       ['read', 'create', 'update', 'delete'],
        workflow_rules:      ['read', 'create', 'update', 'delete'],
        validation_rules:    ['read', 'create', 'update', 'delete'],
        layouts:             ['read', 'manage', 'fields_read', 'fields_manage', 'sysconfig_read', 'sysconfig_create', 'sysconfig_update', 'sysconfig_delete'],
        custom_fields:       ['read', 'manage'],
        custom_buttons:      ['read', 'manage', 'execute'],
        custom_functions:    ['read', 'manage', 'execute'],
        custom_modules:      ['read', 'create', 'update', 'delete'],
        client_scripts:      ['read', 'manage', 'execute'],
        dropdowns:           ['read', 'create', 'update', 'delete'],
        related_lists:       ['read', 'create', 'update', 'delete'],
        lead_conversion_mappings: ['read', 'create', 'update', 'delete'],
        tags:                ['read', 'create', 'update', 'delete'],
        recycle_bin:         ['read', 'update', 'delete'],
        audit:               ['read'],
        webhooks:            ['read', 'create', 'update', 'delete'],
        vertical_packs:      ['read', 'create', 'update', 'delete'],
        // ── User / Role Management ────────────────────────────────────────
        users:               ['read', 'create', 'update', 'delete'],
        roles:               ['read', 'create', 'update', 'delete'],
        // Tenant admin namespace — flattens to crm.admin.* which the admin-write
        // routes enumerate via requirePermission (territories, settings, AI, …).
        // Org Admin gets these by matrix expansion; CRM Admin needs them listed
        // here (QA 2026-06-14: every crm.admin.* code was held by NO role → 403).
        admin:               ['layouts', 'modules', 'users', 'settings', 'territories', 'roles', 'ai'],
      },
    },
  },

  // ── 2. Sales Rep ─────────────────────────────────────────────────────────
  // Owns the full sales pipeline: lead → opportunity → quote → order.
  // No access to admin settings, financial deletion, or inventory management.
  {
    key: 'crm_sales_rep',
    roleName: 'Sales Rep',
    description: 'Manages own pipeline: leads, contacts, accounts, opportunities, and quotes',
    color: '#059669',
    priority: 50,
    permissions: {
      crm: {
        leads:             ['read', 'create', 'update'],
        accounts:          ['read', 'create', 'update'],
        contacts:          ['read', 'create', 'update'],
        opportunities:     ['read', 'create', 'update'],
        quotations:        ['read', 'create', 'update'],
        invoices:          ['read'],
        'sales-orders':    ['read', 'create', 'update'],
        tickets:           ['read', 'create', 'update'],
        tasks:             ['read', 'create', 'update', 'delete'],
        meetings:          ['read', 'create', 'update', 'delete'],
        calls:             ['read', 'create', 'update'],
        communications:    ['read', 'create'],
        documents:         ['read', 'create'],
        attachments:       ['read', 'create'],
        notes:             ['read', 'create', 'update'],
        activity:          ['read'],
        notifications:     ['read', 'update'],
        calendar:          ['read'],
        dashboards:        ['read'],
        search:            ['read'],
        workqueue:         ['read'],
        email_templates:   ['read'],
        cadences:          ['read'],
        approval_processes: ['read'],
        // Rendering infrastructure — needed to load form layouts, pipeline stages,
        // dropdown options, and field definitions on every page. Read-only.
        layouts:           ['read'],
        pipelines:         ['read'],
        dropdowns:         ['read'],
        custom_fields:     ['read'],
        custom_modules:    ['read'],
      },
    },
  },

  // ── 3. Support Agent ─────────────────────────────────────────────────────
  // Customer support desk. Full ownership of tickets, communications, and tasks.
  // Read-only on accounts; no access to sales pipeline or financials.
  {
    key: 'crm_support_agent',
    roleName: 'Support Agent',
    description: 'Handles assigned and queued support tickets with read-only access to related records',
    color: '#ca8a04',
    priority: 40,
    permissions: {
      crm: {
        tickets:        ['read', 'create', 'update', 'delete'],
        contacts:       ['read', 'create', 'update'],
        accounts:       ['read'],
        leads:          ['read'],
        tasks:          ['read', 'create', 'update', 'delete'],
        meetings:       ['read', 'create', 'update'],
        calls:          ['read', 'create', 'update'],
        communications: ['read', 'create', 'update', 'delete'],
        documents:      ['read', 'create'],
        attachments:    ['read', 'create'],
        notes:          ['read', 'create', 'update'],
        activity:       ['read'],
        notifications:  ['read', 'update'],
        calendar:       ['read'],
        dashboards:     ['read'],
        search:         ['read'],
        workqueue:      ['read'],
        email_templates: ['read'],
        // Rendering infrastructure — needed to load form layouts, pipeline stages,
        // dropdown options, and field definitions on every page. Read-only.
        layouts:         ['read'],
        pipelines:       ['read'],
        dropdowns:       ['read'],
        custom_fields:   ['read'],
        custom_modules:  ['read'],
      },
    },
  },

  // ── 4. Viewer ─────────────────────────────────────────────────────────────
  // Read-only across every module. For observers, auditors, and executives.
  {
    key: 'crm_viewer',
    roleName: 'Viewer',
    description: 'Read-only access across all CRM modules. Suitable for executives and external stakeholders',
    color: '#6b7280',
    priority: 10,
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
        attachments:    ['read'],
        notes:          ['read'],
        activity:       ['read'],
        notifications:  ['read', 'update'],
        calendar:       ['read'],
        dashboards:     ['read'],
        search:         ['read'],
        workqueue:      ['read'],
        reports:        ['read'],
        // Rendering infrastructure — needed to load form layouts, pipeline stages,
        // dropdown options, and field definitions on every page. Read-only.
        layouts:        ['read'],
        pipelines:      ['read'],
        dropdowns:      ['read'],
        custom_fields:  ['read'],
        custom_modules: ['read'],
      },
    },
  },
];
