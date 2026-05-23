// 🎯 **BUSINESS SUITE PERMISSION MATRIX**
// This file defines all applications, their modules, and permissions
// Run `npm run sync-permissions` to update the database

import Logger from '../utils/logger.js';

export const BUSINESS_SUITE_MATRIX = {
  // 🎯 **CRM APPLICATION**
  crm: {
    appInfo: {
      appCode: 'crm',
      appName: 'CRM',
      description: 'Sales, contacts, support, and account management',
      icon: '🎯',
      baseUrl: 'https://crm.zopkit.com',
      version: '1.0.0',
      isCore: true,
      sortOrder: 1
    },
    modules: {
      // Sales group
      leads: {
        moduleCode: 'leads',
        moduleName: 'Leads',
        description: 'Manage sales leads and prospects',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Leads', description: 'View lead records' },
          { code: 'create', name: 'Create Leads', description: 'Add new leads' },
          { code: 'update', name: 'Edit Leads', description: 'Modify existing lead records' },
          { code: 'delete', name: 'Delete Leads', description: 'Remove lead records' },
        ]
      },
      
      accounts: {
        moduleCode: 'accounts',
        moduleName: 'Accounts',
        description: 'Manage customer accounts and companies',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Accounts', description: 'View account records' },
          { code: 'create', name: 'Create Accounts', description: 'Add new accounts' },
          { code: 'update', name: 'Edit Accounts', description: 'Modify existing account records' },
          { code: 'delete', name: 'Delete Accounts', description: 'Remove account records' },
        ]
      },

      contacts: {
        moduleCode: 'contacts',
        moduleName: 'Contacts',
        description: 'Manage individual contacts and relationships',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Contacts', description: 'View contact records' },
          { code: 'create', name: 'Create Contacts', description: 'Add new contacts' },
          { code: 'update', name: 'Edit Contacts', description: 'Modify existing contact records' },
          { code: 'delete', name: 'Delete Contacts', description: 'Remove contact records' },
        ]
      },

      opportunities: {
        moduleCode: 'opportunities',
        moduleName: 'Opportunities',
        description: 'Track and manage sales opportunities and deals',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Opportunities', description: 'View opportunity records' },
          { code: 'create', name: 'Create Opportunities', description: 'Add new opportunities' },
          { code: 'update', name: 'Edit Opportunities', description: 'Modify existing opportunity records' },
          { code: 'delete', name: 'Delete Opportunities', description: 'Remove opportunity records' },
        ]
      },

      tickets: {
        moduleCode: 'tickets',
        moduleName: 'Tickets',
        description: 'Manage customer support tickets',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Tickets', description: 'View support ticket records' },
          { code: 'create', name: 'Create Tickets', description: 'Raise new support tickets' },
          { code: 'update', name: 'Edit Tickets', description: 'Modify existing ticket records' },
          { code: 'delete', name: 'Delete Tickets', description: 'Remove support ticket records' },
        ]
      },

      inventory: {
        moduleCode: 'inventory',
        moduleName: 'Inventory',
        description: 'Manage product catalogue and stock levels',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Inventory', description: 'View inventory records' },
          { code: 'create', name: 'Create Inventory', description: 'Add new inventory items' },
          { code: 'update', name: 'Edit Inventory', description: 'Modify existing inventory records' },
          { code: 'delete', name: 'Delete Inventory', description: 'Remove inventory records' },
        ]
      },

      invoices: {
        moduleCode: 'invoices',
        moduleName: 'Invoices',
        description: 'Create and manage customer invoices',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Invoices', description: 'View invoice records' },
          { code: 'create', name: 'Create Invoices', description: 'Raise new invoices' },
          { code: 'update', name: 'Edit Invoices', description: 'Modify existing invoice records' },
          { code: 'delete', name: 'Delete Invoices', description: 'Remove invoice records' },
        ]
      },

      quotations: {
        moduleCode: 'quotations',
        moduleName: 'Quotations',
        description: 'Create and send sales quotations',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Quotations', description: 'View quotation records' },
          { code: 'create', name: 'Create Quotations', description: 'Prepare new quotations' },
          { code: 'update', name: 'Edit Quotations', description: 'Modify existing quotation records' },
          { code: 'delete', name: 'Delete Quotations', description: 'Remove quotation records' },
        ]
      },

      // kebab-case key preserved to match crm.<module>.<action> route convention
      'sales-orders': {
        moduleCode: 'sales-orders',
        moduleName: 'Sales Orders',
        description: 'Manage confirmed sales orders',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Sales Orders', description: 'View sales order records' },
          { code: 'create', name: 'Create Sales Orders', description: 'Raise new sales orders' },
          { code: 'update', name: 'Edit Sales Orders', description: 'Modify existing sales order records' },
          { code: 'delete', name: 'Delete Sales Orders', description: 'Remove sales order records' },
        ]
      },

      // Activity group
      tasks: {
        moduleCode: 'tasks',
        moduleName: 'Tasks',
        description: 'Create and track work items and follow-ups',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Tasks', description: 'View task records' },
          { code: 'create', name: 'Create Tasks', description: 'Add new tasks' },
          { code: 'update', name: 'Edit Tasks', description: 'Modify existing task records' },
          { code: 'delete', name: 'Delete Tasks', description: 'Remove task records' },
        ]
      },

      meetings: {
        moduleCode: 'meetings',
        moduleName: 'Meetings',
        description: 'Schedule and log customer meetings',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Meetings', description: 'View meeting records' },
          { code: 'create', name: 'Create Meetings', description: 'Schedule new meetings' },
          { code: 'update', name: 'Edit Meetings', description: 'Modify existing meeting records' },
          { code: 'delete', name: 'Delete Meetings', description: 'Remove meeting records' },
        ]
      },

      calls: {
        moduleCode: 'calls',
        moduleName: 'Calls',
        description: 'Log and manage customer calls',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Calls', description: 'View call log records' },
          { code: 'create', name: 'Log Calls', description: 'Add new call log entries' },
          { code: 'update', name: 'Edit Calls', description: 'Modify existing call log records' },
          { code: 'delete', name: 'Delete Calls', description: 'Remove call log records' },
        ]
      },

      events: {
        moduleCode: 'events',
        moduleName: 'Events',
        description: 'Manage customer-facing events and activities',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Events', description: 'View event records' },
          { code: 'create', name: 'Create Events', description: 'Schedule new events' },
          { code: 'update', name: 'Edit Events', description: 'Modify existing event records' },
          { code: 'delete', name: 'Delete Events', description: 'Remove event records' },
        ]
      },

      communications: {
        moduleCode: 'communications',
        moduleName: 'Communications',
        description: 'Log emails, chats, and other customer communications',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Communications', description: 'View communication history' },
          { code: 'create', name: 'Log Communications', description: 'Add new communication records' },
          { code: 'update', name: 'Edit Communications', description: 'Modify existing communication records' },
          { code: 'delete', name: 'Delete Communications', description: 'Remove communication records' },
        ]
      },

      // Support / Reference group
      documents: {
        moduleCode: 'documents',
        moduleName: 'Documents',
        description: 'Attach and manage files linked to CRM records',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Documents', description: 'View and download attached documents' },
          { code: 'create', name: 'Upload Documents', description: 'Attach new documents to records' },
          // no update — documents module has no PUT route
          { code: 'delete', name: 'Delete Documents', description: 'Remove attached documents' },
        ]
      },

      notifications: {
        moduleCode: 'notifications',
        moduleName: 'Notifications',
        description: 'Manage in-app CRM notifications and alerts',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Notifications', description: 'Read CRM notifications' },
          // no create/delete — user only reads and marks-read
          { code: 'update', name: 'Manage Notifications', description: 'Mark notifications read and manage preferences' },
        ]
      },

      calendar: {
        moduleCode: 'calendar',
        moduleName: 'Calendar',
        description: 'Read-only activity calendar feed',
        isCore: false,
        permissions: [
          // read-only feed — no write routes on the calendar module
          { code: 'read', name: 'View Calendar', description: 'View activity calendar' },
        ]
      },

      notes: {
        moduleCode: 'notes',
        moduleName: 'Notes',
        description: 'Add and view notes on CRM records',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Notes', description: 'View notes attached to records' },
          { code: 'create', name: 'Add Notes', description: 'Add notes to records' },
          { code: 'update', name: 'Edit Notes', description: 'Edit existing notes' },
          { code: 'delete', name: 'Delete Notes', description: 'Remove notes' },
        ]
      },

      activities: {
        moduleCode: 'activities',
        moduleName: 'Activity Feed',
        description: 'View activity timeline on CRM records',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Activity Feed', description: 'View activity timeline and history' },
        ]
      },

      products: {
        moduleCode: 'products',
        moduleName: 'Products',
        description: 'Manage product catalogue used in quotes and orders',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Products', description: 'View product records' },
          { code: 'create', name: 'Create Products', description: 'Add new products' },
          { code: 'update', name: 'Edit Products', description: 'Modify existing product records' },
          { code: 'delete', name: 'Delete Products', description: 'Remove product records' },
        ]
      },

      bulk_upload: {
        moduleCode: 'bulk_upload',
        moduleName: 'Bulk Import',
        description: 'Import records in bulk via CSV upload',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Import History', description: 'View bulk import history and results' },
          { code: 'create', name: 'Run Bulk Import', description: 'Upload CSV files to import records' },
          { code: 'delete', name: 'Delete Import Records', description: 'Remove bulk import records' },
        ]
      },

      webforms: {
        moduleCode: 'webforms',
        moduleName: 'Web Forms',
        description: 'Create and manage lead capture web forms',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Web Forms', description: 'View web form definitions' },
          { code: 'create', name: 'Create Web Forms', description: 'Create new web forms' },
          { code: 'update', name: 'Edit Web Forms', description: 'Modify existing web forms' },
          { code: 'delete', name: 'Delete Web Forms', description: 'Remove web forms' },
        ]
      },

      email_templates: {
        moduleCode: 'email_templates',
        moduleName: 'Email Templates',
        description: 'Create and manage CRM email templates',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Email Templates', description: 'View email template definitions' },
          { code: 'create', name: 'Create Email Templates', description: 'Create new email templates' },
          { code: 'update', name: 'Edit Email Templates', description: 'Modify existing email templates' },
          { code: 'delete', name: 'Delete Email Templates', description: 'Remove email templates' },
        ]
      },

      cadences: {
        moduleCode: 'cadences',
        moduleName: 'Cadences',
        description: 'Automated multi-step sales and communication sequences',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Cadences', description: 'View cadence definitions' },
          { code: 'create', name: 'Create Cadences', description: 'Create new cadences' },
          { code: 'update', name: 'Edit Cadences', description: 'Modify existing cadences' },
          { code: 'delete', name: 'Delete Cadences', description: 'Remove cadences' },
        ]
      },

      marketing_campaigns: {
        moduleCode: 'marketing_campaigns',
        moduleName: 'Marketing Campaigns',
        description: 'Manage email and marketing campaigns',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Campaigns', description: 'View marketing campaign records' },
          { code: 'create', name: 'Create Campaigns', description: 'Create new campaigns' },
          { code: 'update', name: 'Edit Campaigns', description: 'Modify existing campaigns' },
          { code: 'delete', name: 'Delete Campaigns', description: 'Remove campaigns' },
        ]
      },

      approval_processes: {
        moduleCode: 'approval_processes',
        moduleName: 'Approval Workflows',
        description: 'Define and manage approval workflows for CRM records',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Approval Processes', description: 'View approval workflow definitions' },
          { code: 'create', name: 'Create Approval Processes', description: 'Create new approval workflows' },
          { code: 'update', name: 'Edit Approval Processes', description: 'Modify existing approval workflows' },
          { code: 'delete', name: 'Delete Approval Processes', description: 'Remove approval workflows' },
          { code: 'approve', name: 'Approve Records', description: 'Approve or reject records in approval workflows' },
        ]
      },

      custom_fields: {
        moduleCode: 'custom_fields',
        moduleName: 'Custom Fields',
        description: 'Admin: configure custom fields on CRM entity types',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Custom Fields', description: 'View custom field definitions' },
          { code: 'manage', name: 'Manage Custom Fields', description: 'Create, edit, and delete custom field definitions (admin only)' },
        ]
      },

      layouts: {
        moduleCode: 'layouts',
        moduleName: 'Layouts',
        description: 'Admin: configure record view layouts per role',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Layouts', description: 'View layout definitions' },
          { code: 'manage', name: 'Manage Layouts', description: 'Create, edit, and assign layouts (admin only)' },
        ]
      },

      custom_buttons: {
        moduleCode: 'custom_buttons',
        moduleName: 'Custom Buttons',
        description: 'Admin: configure custom action buttons on CRM records',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Custom Buttons', description: 'View custom button definitions' },
          { code: 'manage', name: 'Manage Custom Buttons', description: 'Create, edit, and delete custom buttons (admin only)' },
          { code: 'execute', name: 'Execute Custom Buttons', description: 'Trigger custom button actions on records' },
        ]
      },

      custom_functions: {
        moduleCode: 'custom_functions',
        moduleName: 'Custom Functions',
        description: 'Admin: write and deploy serverless automation functions',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Custom Functions', description: 'View custom function definitions' },
          { code: 'manage', name: 'Manage Custom Functions', description: 'Create, edit, and deploy custom functions (admin only)' },
          { code: 'execute', name: 'Execute Custom Functions', description: 'Trigger custom function execution' },
        ]
      },

      webhooks: {
        moduleCode: 'webhooks',
        moduleName: 'Webhooks',
        description: 'Configure outbound webhooks for CRM events',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Webhooks', description: 'View webhook configurations' },
          { code: 'create', name: 'Create Webhooks', description: 'Add new webhook endpoints' },
          { code: 'update', name: 'Edit Webhooks', description: 'Modify existing webhook configurations' },
          { code: 'delete', name: 'Delete Webhooks', description: 'Remove webhook configurations' },
        ]
      },

      // ⚙️ SYSTEM MODULE (kept for admin role-builder parity with other apps)
      system: {
        moduleCode: 'system',
        moduleName: 'System Configuration',
        description: 'System administration and configuration management',
        isCore: true,
        permissions: [
          // Settings Permissions
          { code: 'settings_read', name: 'View Settings', description: 'View system settings and configurations' },
          { code: 'settings_update', name: 'Update Settings', description: 'Update system settings' },

          // Configuration Permissions
          { code: 'configurations_read', name: 'View Configurations', description: 'View system configurations' },
          { code: 'configurations_create', name: 'Create Configurations', description: 'Create new system configurations' },
          { code: 'configurations_update', name: 'Update Configurations', description: 'Update existing configurations' },
          { code: 'configurations_delete', name: 'Delete Configurations', description: 'Delete system configurations' },

          // Tenant Configuration Permissions
          { code: 'tenant_config_read', name: 'View Tenant Config', description: 'View tenant-specific configurations' },
          { code: 'tenant_config_update', name: 'Update Tenant Config', description: 'Update tenant configurations' },
          { code: 'admin.tenants.read', name: 'View All Tenants', description: 'View and list all tenants in the system' },

          // Credit Configuration Permissions
          { code: 'credit_config.view', name: 'View Credit Configurations', description: 'View tenant credit configuration settings' },
          { code: 'credit_config.edit', name: 'Edit Credit Configurations', description: 'Edit tenant credit configuration settings' },
          { code: 'credit_config.reset', name: 'Reset Credit Configurations', description: 'Reset tenant configurations to global defaults' },
          { code: 'credit_config.bulk_update', name: 'Bulk Update Credit Configurations', description: 'Bulk update multiple credit configuration settings' },

          // System Configuration Permissions
          { code: 'system_config_read', name: 'View System Config', description: 'View system-level configurations' },
          { code: 'system_config_update', name: 'Update System Config', description: 'Update system-level configurations' },

          // Dropdown Permissions
          { code: 'dropdowns_read', name: 'View Dropdowns', description: 'View system dropdown values' },
          { code: 'dropdowns_create', name: 'Create Dropdowns', description: 'Create new dropdown values' },
          { code: 'dropdowns_update', name: 'Update Dropdowns', description: 'Update dropdown values' },
          { code: 'dropdowns_delete', name: 'Delete Dropdowns', description: 'Delete dropdown values' },

          // Integration Permissions
          { code: 'integrations_read', name: 'View Integrations', description: 'View system integrations' },
          { code: 'integrations_create', name: 'Create Integrations', description: 'Create new integrations' },
          { code: 'integrations_update', name: 'Update Integrations', description: 'Update existing integrations' },
          { code: 'integrations_delete', name: 'Delete Integrations', description: 'Delete integrations' },

          // Backup Permissions
          { code: 'backup_read', name: 'View Backups', description: 'View backup information and history' },
          { code: 'backup_create', name: 'Create Backups', description: 'Create system backups' },
          { code: 'backup_restore', name: 'Restore Backups', description: 'Restore system from backups' },

          // Maintenance Permissions
          { code: 'maintenance_read', name: 'View Maintenance', description: 'View maintenance schedules and status' },
          { code: 'maintenance_perform', name: 'Perform Maintenance', description: 'Execute maintenance operations' },
          { code: 'maintenance_schedule', name: 'Schedule Maintenance', description: 'Schedule maintenance operations' },

          // User Management Permissions
          { code: 'users_read', name: 'View Users', description: 'View user information' },
          { code: 'users_read_all', name: 'View All Users', description: 'View all users in organization' },
          { code: 'users_create', name: 'Create Users', description: 'Create new user accounts' },
          { code: 'users_update', name: 'Edit Users', description: 'Modify user information' },
          { code: 'users_delete', name: 'Delete Users', description: 'Remove user accounts' },
          { code: 'users_activate', name: 'Activate Users', description: 'Activate/deactivate users' },
          { code: 'users_reset_password', name: 'Reset Passwords', description: 'Reset user passwords' },
          { code: 'users_export', name: 'Export Users', description: 'Export user data' },
          { code: 'users_import', name: 'Import Users', description: 'Import users from files' },

          // Role Management Permissions
          { code: 'roles_read', name: 'View Roles', description: 'View role information' },
          { code: 'roles_read_all', name: 'View All Roles', description: 'View all roles in organization' },
          { code: 'roles_create', name: 'Create Roles', description: 'Create new roles' },
          { code: 'roles_update', name: 'Edit Roles', description: 'Modify role information' },
          { code: 'roles_delete', name: 'Delete Roles', description: 'Remove roles' },
          { code: 'roles_assign', name: 'Assign Roles', description: 'Assign roles to users' },
          { code: 'roles_export', name: 'Export Roles', description: 'Export role data' },

          // Reports Permissions
          { code: 'reports_read', name: 'View Reports', description: 'View report information' },
          { code: 'reports_read_all', name: 'View All Reports', description: 'View all reports' },
          { code: 'reports_create', name: 'Create Reports', description: 'Create new reports' },
          { code: 'reports_update', name: 'Edit Reports', description: 'Modify existing reports' },
          { code: 'reports_delete', name: 'Delete Reports', description: 'Remove reports' },
          { code: 'reports_export', name: 'Export Reports', description: 'Export report data' },
          { code: 'reports_schedule', name: 'Schedule Reports', description: 'Schedule automated reports' },

          // Audit Logs Permissions
          { code: 'audit_read', name: 'View Audit Logs', description: 'View basic audit log information' },
          { code: 'audit_read_all', name: 'View All Audit Logs', description: 'View all audit logs in organization' },
          { code: 'audit_export', name: 'Export Audit Logs', description: 'Export audit log data to various formats' },
          { code: 'audit_view_details', name: 'View Audit Details', description: 'View detailed audit log information' },
          { code: 'audit_filter', name: 'Filter Audit Logs', description: 'Filter audit logs by various criteria' },
          { code: 'audit_generate_reports', name: 'Generate Reports', description: 'Generate audit reports' },
          { code: 'audit_archive', name: 'Archive Logs', description: 'Archive old audit logs' },
          { code: 'audit_purge', name: 'Purge Old Logs', description: 'Purge old audit logs' },

          // Activity Logs Permissions
          { code: 'activity_logs_read', name: 'View Activity Logs', description: 'View activity log information' },
          { code: 'activity_logs_read_all', name: 'View All Activity Logs', description: 'View all activity logs in organization' },
          { code: 'activity_logs_export', name: 'Export Activity Logs', description: 'Export activity log data' },
          { code: 'activity_logs_view_details', name: 'View Activity Details', description: 'View detailed activity information' },
          { code: 'activity_logs_filter', name: 'Filter Activity Logs', description: 'Filter activity logs by various criteria' },
          { code: 'activity_logs_generate_reports', name: 'Generate Reports', description: 'Generate activity log reports' },
          { code: 'activity_logs_archive', name: 'Archive Logs', description: 'Archive old activity logs' },
          { code: 'activity_logs_purge', name: 'Purge Old Logs', description: 'Purge old activity logs' }
        ]
      },
      
    }
  },
  
  // 👥 **HR APPLICATION**
  hr: {
    appInfo: {
      appCode: 'hr',
      appName: 'Human Resources Management',
      description: 'Complete HR solution for employee management and payroll',
      icon: '👥',
      baseUrl: 'http://localhost:3003',
      version: '1.5.0',
      isCore: true,
      sortOrder: 2
    },
    modules: {
      // 👤 EMPLOYEES MODULE
      employees: {
        moduleCode: 'employees',
        moduleName: 'Employee Management',
        description: 'Manage employee records and information',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Employees', description: 'View employee information' },
          { code: 'read_all', name: 'View All Employees', description: 'View all employees in organization' },
          { code: 'create', name: 'Add Employees', description: 'Add new employees to the system' },
          { code: 'update', name: 'Edit Employees', description: 'Modify employee information' },
          { code: 'delete', name: 'Remove Employees', description: 'Remove employees from system' },
          { code: 'view_salary', name: 'View Salary Information', description: 'Access employee salary details' },
          { code: 'export', name: 'Export Employee Data', description: 'Export employee data' }
        ]
      },
      
      // 💰 PAYROLL MODULE
      payroll: {
        moduleCode: 'payroll',
        moduleName: 'Payroll Management',
        description: 'Process payroll and manage compensation',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Payroll', description: 'View payroll information' },
          { code: 'process', name: 'Process Payroll', description: 'Run payroll calculations' },
          { code: 'approve', name: 'Approve Payroll', description: 'Approve payroll for processing' },
          { code: 'export', name: 'Export Payroll', description: 'Export payroll reports' },
          { code: 'generate_reports', name: 'Generate Reports', description: 'Generate payroll reports' }
        ]
      },
      
      // 📅 LEAVE MODULE
      leave: {
        moduleCode: 'leave',
        moduleName: 'Leave Management',
        description: 'Manage employee leave requests and approvals',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Leave Requests', description: 'View leave request information' },
          { code: 'create', name: 'Create Leave Requests', description: 'Submit leave requests' },
          { code: 'approve', name: 'Approve Leave', description: 'Approve leave requests' },
          { code: 'reject', name: 'Reject Leave', description: 'Reject leave requests' },
          { code: 'cancel', name: 'Cancel Leave', description: 'Cancel leave requests' },
          { code: 'export', name: 'Export Leave Data', description: 'Export leave reports' }
        ]
      },
      
      // 📊 HR DASHBOARD MODULE
      dashboard: {
        moduleCode: 'dashboard',
        moduleName: 'HR Dashboard',
        description: 'HR analytics and reporting dashboard',
        isCore: true,
        permissions: [
          { code: 'view', name: 'View Dashboard', description: 'Access HR dashboard' },
          { code: 'customize', name: 'Customize Dashboard', description: 'Customize dashboard layout' },
          { code: 'export', name: 'Export Reports', description: 'Export HR reports' }
        ]
      }
    }
  },
  
  // 🤝 **AFFILIATE CONNECT APPLICATION**
  affiliateConnect: {
    appInfo: {
      appCode: 'affiliate_connect',
      appName: 'Affiliate Connect Platform',
      description: 'Comprehensive multi-tenant SaaS platform for affiliate and influencer marketing management',
      icon: '🤝',
      baseUrl: 'https://affiliate-connect.railway.app',
      version: '1.0.0',
      isCore: true,
      sortOrder: 3
    },
    modules: {


      // 📊 DASHBOARD MODULE
      dashboard: {
        moduleCode: 'dashboard',
        moduleName: 'Dashboard & Analytics',
        description: 'Main dashboard with analytics and performance metrics',
        isCore: true,
        permissions: [
          { code: 'view_dashboard', name: 'View Dashboard', description: 'Access main dashboard interface' },
          { code: 'view_analytics', name: 'View Analytics', description: 'View performance analytics and metrics' },
          { code: 'view_reports', name: 'View Reports', description: 'Access reporting and insights' },
          { code: 'export_data', name: 'Export Data', description: 'Export dashboard data to various formats' },
          { code: 'view_all_tenants', name: 'View All Tenants', description: 'View analytics across all tenants (Super Admin)' },
          { code: 'view_tenant_analytics', name: 'View Tenant Analytics', description: 'View analytics for specific tenant' },
          { code: 'view_affiliate_analytics', name: 'View Affiliate Analytics', description: 'View affiliate-specific analytics' },
          { code: 'view_influencer_analytics', name: 'View Influencer Analytics', description: 'View influencer-specific analytics' }
        ]
      },

      // 🛍️ PRODUCTS MODULE
      products: {
        moduleCode: 'products',
        moduleName: 'Product Management',
        description: 'Product catalog management with commission settings',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Products', description: 'View and browse product information' },
          { code: 'read_all', name: 'View All Products', description: 'View all products in organization' },
          { code: 'create', name: 'Create Products', description: 'Add new products to the catalog' },
          { code: 'update', name: 'Edit Products', description: 'Modify existing product information' },
          { code: 'delete', name: 'Delete Products', description: 'Remove products from the catalog' },
          { code: 'update_commission', name: 'Update Commission', description: 'Update product commission rates' },
          { code: 'upload_images', name: 'Upload Images', description: 'Upload product images' },
          { code: 'export', name: 'Export Products', description: 'Export product data' },
          { code: 'import', name: 'Import Products', description: 'Import products from external files' },
          { code: 'manage_categories', name: 'Manage Categories', description: 'Manage product categories' }
        ]
      },

      // 👥 AFFILIATES MODULE
      affiliates: {
        moduleCode: 'affiliates',
        moduleName: 'Affiliate Management',
        description: 'Affiliate onboarding, management, and tier assignment',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Affiliates', description: 'View and browse affiliate information' },
          { code: 'read_all', name: 'View All Affiliates', description: 'View all affiliates in organization' },
          { code: 'create', name: 'Create Affiliates', description: 'Add new affiliates to the system' },
          { code: 'update', name: 'Edit Affiliates', description: 'Modify existing affiliate information' },
          { code: 'delete', name: 'Delete Affiliates', description: 'Remove affiliates from the system' },
          { code: 'invite', name: 'Invite Affiliates', description: 'Send affiliate invitations via email' },
          { code: 'approve', name: 'Approve Affiliates', description: 'Approve affiliate applications' },
          { code: 'reject', name: 'Reject Affiliates', description: 'Reject affiliate applications' },
          { code: 'assign_tier', name: 'Assign Tier', description: 'Assign commission tiers to affiliates' },
          { code: 'view_pending', name: 'View Pending', description: 'View pending affiliate applications' },
          { code: 'view_details', name: 'View Details', description: 'View detailed affiliate information' },
          { code: 'update_details', name: 'Update Details', description: 'Update affiliate profile details' },
          { code: 'view_commissions', name: 'View Commissions', description: 'View affiliate commission data' },
          { code: 'update_commissions', name: 'Update Commissions', description: 'Update affiliate commission settings' }
        ]
      },

      // 🔗 TRACKING MODULE
      tracking: {
        moduleCode: 'tracking',
        moduleName: 'Link Tracking & Analytics',
        description: 'Affiliate link generation, tracking, and conversion analytics',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Tracking Links', description: 'View and browse tracking links' },
          { code: 'read_all', name: 'View All Tracking Links', description: 'View all tracking links in organization' },
          { code: 'create', name: 'Create Tracking Links', description: 'Generate new tracking links' },
          { code: 'update', name: 'Edit Tracking Links', description: 'Modify existing tracking links' },
          { code: 'delete', name: 'Delete Tracking Links', description: 'Remove tracking links' },
          { code: 'track_clicks', name: 'Track Clicks', description: 'Track link click events' },
          { code: 'track_conversions', name: 'Track Conversions', description: 'Track conversion events' },
          { code: 'view_analytics', name: 'View Analytics', description: 'View tracking analytics and reports' },
          { code: 'export_analytics', name: 'Export Analytics', description: 'Export tracking analytics data' },
          { code: 'manage_utm', name: 'Manage UTM', description: 'Manage UTM parameters for links' }
        ]
      },
      
      // 💰 COMMISSIONS MODULE
      commissions: {
        moduleCode: 'commissions',
        moduleName: 'Commission Management',
        description: 'Commission structure, tiers, and rule management',
        isCore: true,
        permissions: [
          { code: 'read_tiers', name: 'View Commission Tiers', description: 'View commission tier information' },
          { code: 'create_tiers', name: 'Create Commission Tiers', description: 'Create new commission tiers' },
          { code: 'update_tiers', name: 'Edit Commission Tiers', description: 'Modify commission tier settings' },
          { code: 'delete_tiers', name: 'Delete Commission Tiers', description: 'Remove commission tiers' },
          { code: 'read_rules', name: 'View Commission Rules', description: 'View commission rule configurations' },
          { code: 'create_rules', name: 'Create Commission Rules', description: 'Create new commission rules' },
          { code: 'update_rules', name: 'Edit Commission Rules', description: 'Modify commission rules' },
          { code: 'delete_rules', name: 'Delete Commission Rules', description: 'Remove commission rules' },
          { code: 'view_products', name: 'View Product Commissions', description: 'View product-specific commission rates' },
          { code: 'update_products', name: 'Update Product Commissions', description: 'Update product commission rates' },
          { code: 'calculate_commissions', name: 'Calculate Commissions', description: 'Calculate commission amounts' },
          { code: 'view_affiliate_commissions', name: 'View Affiliate Commissions', description: 'View affiliate commission data' }
        ]
      },

      // 🎯 CAMPAIGNS MODULE
      campaigns: {
        moduleCode: 'campaigns',
        moduleName: 'Campaign Management',
        description: 'Marketing campaign creation, management, and influencer participation',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Campaigns', description: 'View and browse campaign information' },
          { code: 'read_all', name: 'View All Campaigns', description: 'View all campaigns in organization' },
          { code: 'create', name: 'Create Campaigns', description: 'Create new marketing campaigns' },
          { code: 'update', name: 'Edit Campaigns', description: 'Modify existing campaign information' },
          { code: 'delete', name: 'Delete Campaigns', description: 'Remove campaigns from the system' },
          { code: 'join_campaign', name: 'Join Campaign', description: 'Join campaigns as influencer' },
          { code: 'view_participants', name: 'View Participants', description: 'View campaign participants' },
          { code: 'manage_participants', name: 'Manage Participants', description: 'Manage campaign participants' },
          { code: 'view_progress', name: 'View Progress', description: 'View campaign progress and metrics' },
          { code: 'submit_content', name: 'Submit Content', description: 'Submit campaign content' },
          { code: 'approve_content', name: 'Approve Content', description: 'Approve submitted content' },
          { code: 'view_contract', name: 'View Contract', description: 'View campaign contracts' },
          { code: 'accept_contract', name: 'Accept Contract', description: 'Accept campaign contracts' },
          { code: 'manage_versions', name: 'Manage Versions', description: 'Manage campaign versions' },
          { code: 'view_analytics', name: 'View Campaign Analytics', description: 'View campaign performance analytics' }
        ]
      },

      // 🌟 INFLUENCERS MODULE
      influencers: {
        moduleCode: 'influencers',
        moduleName: 'Influencer Management',
        description: 'Influencer profiles, social media integration, and analytics',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Influencers', description: 'View and browse influencer information' },
          { code: 'read_all', name: 'View All Influencers', description: 'View all influencers in organization' },
          { code: 'create', name: 'Create Influencers', description: 'Add new influencers to the system' },
          { code: 'update', name: 'Edit Influencers', description: 'Modify existing influencer information' },
          { code: 'delete', name: 'Delete Influencers', description: 'Remove influencers from the system' },
          { code: 'connect_instagram', name: 'Connect Instagram', description: 'Connect Instagram accounts for analytics' },
          { code: 'connect_youtube', name: 'Connect YouTube', description: 'Connect YouTube accounts for analytics' },
          { code: 'connect_twitter', name: 'Connect Twitter', description: 'Connect Twitter accounts for analytics' },
          { code: 'view_analytics', name: 'View Analytics', description: 'View social media analytics' },
          { code: 'view_media_kit', name: 'View Media Kit', description: 'View influencer media kits' },
          { code: 'update_media_kit', name: 'Update Media Kit', description: 'Update media kit information' },
          { code: 'view_ratings', name: 'View Ratings', description: 'View influencer ratings and reviews' },
          { code: 'manage_ratings', name: 'Manage Ratings', description: 'Manage rating and review system' }
        ]
      },

      // 💳 PAYMENTS MODULE
      payments: {
        moduleCode: 'payments',
        moduleName: 'Payment Processing',
        description: 'Payment processing, payouts, and transaction management',
        isCore: true,
        permissions: [
          { code: 'read_payouts', name: 'View Payouts', description: 'View payout information and history' },
          { code: 'create_payouts', name: 'Create Payouts', description: 'Create new payout transactions' },
          { code: 'update_payouts', name: 'Update Payouts', description: 'Update payout status and information' },
          { code: 'view_methods', name: 'View Payment Methods', description: 'View payment method information' },
          { code: 'add_methods', name: 'Add Payment Methods', description: 'Add new payment methods' },
          { code: 'update_methods', name: 'Update Payment Methods', description: 'Update payment method details' },
          { code: 'delete_methods', name: 'Delete Payment Methods', description: 'Remove payment methods' },
          { code: 'view_history', name: 'View Payment History', description: 'View payment transaction history' },
          { code: 'process_payments', name: 'Process Payments', description: 'Process payment transactions' },
          { code: 'view_affiliate_payments', name: 'View Affiliate Payments', description: 'View affiliate payment information' }
        ]
      },

      // 📈 ANALYTICS MODULE
      analytics: {
        moduleCode: 'analytics',
        moduleName: 'Analytics & Reporting',
        description: 'Performance analytics, custom reports, and data visualization',
        isCore: true,
        permissions: [
          { code: 'view_dashboard', name: 'View Dashboard Analytics', description: 'View dashboard analytics and metrics' },
          { code: 'view_campaign_analytics', name: 'View Campaign Analytics', description: 'View campaign performance analytics' },
          { code: 'view_affiliate_analytics', name: 'View Affiliate Analytics', description: 'View affiliate performance analytics' },
          { code: 'view_revenue_analytics', name: 'View Revenue Analytics', description: 'View revenue and financial analytics' },
          { code: 'create_reports', name: 'Create Custom Reports', description: 'Create custom analytics reports' },
          { code: 'view_reports', name: 'View Reports', description: 'View existing analytics reports' },
          { code: 'export_analytics', name: 'Export Analytics', description: 'Export analytics data' },
          { code: 'view_all_tenants', name: 'View All Tenants Analytics', description: 'View analytics across all tenants' },
          { code: 'view_tenant_analytics', name: 'View Tenant Analytics', description: 'View tenant-specific analytics' }
        ]
      },

      // 🛡️ FRAUD PREVENTION MODULE
      fraud: {
        moduleCode: 'fraud',
        moduleName: 'Fraud Prevention',
        description: 'Fraud detection, monitoring, and prevention systems',
        isCore: false,
        permissions: [
          { code: 'read_rules', name: 'View Fraud Rules', description: 'View fraud detection rules' },
          { code: 'create_rules', name: 'Create Fraud Rules', description: 'Create new fraud detection rules' },
          { code: 'update_rules', name: 'Edit Fraud Rules', description: 'Modify fraud detection rules' },
          { code: 'delete_rules', name: 'Delete Fraud Rules', description: 'Remove fraud detection rules' },
          { code: 'view_alerts', name: 'View Fraud Alerts', description: 'View fraud detection alerts' },
          { code: 'update_alerts', name: 'Update Alert Status', description: 'Update fraud alert status' },
          { code: 'view_monitoring', name: 'View Fraud Monitoring', description: 'View fraud monitoring dashboard' },
          { code: 'manage_detection', name: 'Manage Detection', description: 'Manage fraud detection settings' }
        ]
      },

      // 📧 COMMUNICATIONS MODULE
      communications: {
        moduleCode: 'communications',
        moduleName: 'Communications & Notifications',
        description: 'Email templates, notifications, and messaging system',
        isCore: false,
        permissions: [
          { code: 'read_templates', name: 'View Templates', description: 'View notification templates' },
          { code: 'create_templates', name: 'Create Templates', description: 'Create new notification templates' },
          { code: 'update_templates', name: 'Edit Templates', description: 'Modify notification templates' },
          { code: 'delete_templates', name: 'Delete Templates', description: 'Remove notification templates' },
          { code: 'send_notifications', name: 'Send Notifications', description: 'Send notifications to users' },
          { code: 'view_notifications', name: 'View Notifications', description: 'View notification history' },
          { code: 'update_notification_status', name: 'Update Notification Status', description: 'Update notification status' },
          { code: 'manage_messaging', name: 'Manage Messaging', description: 'Manage messaging system settings' }
        ]
      },

      // 🔌 INTEGRATIONS MODULE
      integrations: {
        moduleCode: 'integrations',
        moduleName: 'Third-party Integrations',
        description: 'API keys, webhooks, and external service integrations',
        isCore: false,
        permissions: [
          { code: 'read_api_keys', name: 'View API Keys', description: 'View API key information' },
          { code: 'create_api_keys', name: 'Create API Keys', description: 'Create new API keys' },
          { code: 'update_api_keys', name: 'Update API Keys', description: 'Update API key settings' },
          { code: 'delete_api_keys', name: 'Delete API Keys', description: 'Remove API keys' },
          { code: 'read_webhooks', name: 'View Webhooks', description: 'View webhook configurations' },
          { code: 'create_webhooks', name: 'Create Webhooks', description: 'Create new webhook endpoints' },
          { code: 'update_webhooks', name: 'Update Webhooks', description: 'Update webhook settings' },
          { code: 'delete_webhooks', name: 'Delete Webhooks', description: 'Remove webhook endpoints' },
          { code: 'manage_integrations', name: 'Manage Integrations', description: 'Manage third-party integrations' }
        ]
      },

      // ⚙️ SETTINGS MODULE
      settings: {
        moduleCode: 'settings',
        moduleName: 'System Settings',
        description: 'Tenant settings, user management, and system configuration',
        isCore: true,
        permissions: [
          { code: 'read_tenant_settings', name: 'View Tenant Settings', description: 'View tenant configuration settings' },
          { code: 'update_tenant_settings', name: 'Update Tenant Settings', description: 'Update tenant configuration' },
          { code: 'read_users', name: 'View Users', description: 'View user information' },
          { code: 'create_users', name: 'Create Users', description: 'Create new user accounts' },
          { code: 'update_users', name: 'Update Users', description: 'Update user information' },
          { code: 'delete_users', name: 'Delete Users', description: 'Remove user accounts' },
          { code: 'read_roles', name: 'View Roles', description: 'View role information' },
          { code: 'create_roles', name: 'Create Roles', description: 'Create new user roles' },
          { code: 'update_roles', name: 'Update Roles', description: 'Update role permissions' },
          { code: 'delete_roles', name: 'Delete Roles', description: 'Remove user roles' },
          { code: 'manage_permissions', name: 'Manage Permissions', description: 'Manage role-based permissions' }
        ]
      },

      // 🎫 SUPPORT MODULE
      support: {
        moduleCode: 'support',
        moduleName: 'Customer Support',
        description: 'Support ticket management and knowledge base',
        isCore: false,
        permissions: [
          { code: 'read_tickets', name: 'View Support Tickets', description: 'View support ticket information' },
          { code: 'create_tickets', name: 'Create Support Tickets', description: 'Create new support tickets' },
          { code: 'update_tickets', name: 'Update Support Tickets', description: 'Update support ticket status' },
          { code: 'view_knowledge_base', name: 'View Knowledge Base', description: 'Access knowledge base articles' },
          { code: 'search_knowledge_base', name: 'Search Knowledge Base', description: 'Search knowledge base content' },
          { code: 'manage_tickets', name: 'Manage Tickets', description: 'Manage support ticket workflow' },
          { code: 'view_all_tickets', name: 'View All Tickets', description: 'View all support tickets (Admin)' }
        ]
      },

    }
  },

  // 📋 **PROJECT MANAGEMENT APPLICATION**
  project_management: {
    appInfo: {
      appCode: 'project_management',
      appName: 'Project Management',
      description: 'Complete project management solution for managing projects, tasks, teams, and workflows',
      icon: '📋',
      baseUrl: 'https://prm.zopkit.com',
      version: '1.0.0',
      isCore: true,
      sortOrder: 2
    },
    modules: {
      // 📁 PROJECTS MODULE
      projects: {
        moduleCode: 'projects',
        moduleName: 'Project Management',
        description: 'Manage projects, timelines, and budgets',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Projects', description: 'View and browse project information' },
          { code: 'read_all', name: 'View All Projects', description: 'View all projects in organization' },
          { code: 'create', name: 'Create Projects', description: 'Create new projects' },
          { code: 'update', name: 'Edit Projects', description: 'Modify existing project information' },
          { code: 'delete', name: 'Delete Projects', description: 'Remove projects from the system' },
          { code: 'export', name: 'Export Projects', description: 'Export project data to various formats' },
          { code: 'import', name: 'Import Projects', description: 'Import projects from external files' },
          { code: 'assign', name: 'Assign Projects', description: 'Assign projects to team members' },
          { code: 'archive', name: 'Archive Projects', description: 'Archive completed or inactive projects' },
          { code: 'restore', name: 'Restore Projects', description: 'Restore archived projects' },
          { code: 'manage_budget', name: 'Manage Budget', description: 'Manage project budgets and financials' },
          { code: 'manage_timeline', name: 'Manage Timeline', description: 'Manage project timelines and milestones' },
          { code: 'manage_settings', name: 'Manage Settings', description: 'Manage project settings and configurations' }
        ]
      },

      // ✅ TASKS MODULE
      tasks: {
        moduleCode: 'tasks',
        moduleName: 'Task Management',
        description: 'Manage tasks, subtasks, and assignments',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Tasks', description: 'View and browse task information' },
          { code: 'read_all', name: 'View All Tasks', description: 'View all tasks in organization' },
          { code: 'create', name: 'Create Tasks', description: 'Create new tasks' },
          { code: 'update', name: 'Edit Tasks', description: 'Modify existing task information' },
          { code: 'delete', name: 'Delete Tasks', description: 'Remove tasks from the system' },
          { code: 'export', name: 'Export Tasks', description: 'Export task data to various formats' },
          { code: 'import', name: 'Import Tasks', description: 'Import tasks from external files' },
          { code: 'assign', name: 'Assign Tasks', description: 'Assign tasks to team members' },
          { code: 'reassign', name: 'Reassign Tasks', description: 'Reassign tasks to different team members' },
          { code: 'change_status', name: 'Change Status', description: 'Change task status (todo, in progress, done, etc.)' },
          { code: 'change_priority', name: 'Change Priority', description: 'Change task priority levels' },
          { code: 'add_subtasks', name: 'Add Subtasks', description: 'Add subtasks to existing tasks' },
          { code: 'manage_dependencies', name: 'Manage Dependencies', description: 'Manage task dependencies and relationships' },
          { code: 'add_attachments', name: 'Add Attachments', description: 'Add attachments to tasks' },
          { code: 'add_comments', name: 'Add Comments', description: 'Add comments to tasks' },
          { code: 'time_track', name: 'Track Time', description: 'Track time spent on tasks' }
        ]
      },

      // 🏃 SPRINTS MODULE
      sprints: {
        moduleCode: 'sprints',
        moduleName: 'Sprint Management',
        description: 'Manage agile sprints and iterations',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Sprints', description: 'View and browse sprint information' },
          { code: 'read_all', name: 'View All Sprints', description: 'View all sprints in organization' },
          { code: 'create', name: 'Create Sprints', description: 'Create new sprints' },
          { code: 'update', name: 'Edit Sprints', description: 'Modify existing sprint information' },
          { code: 'delete', name: 'Delete Sprints', description: 'Remove sprints from the system' },
          { code: 'export', name: 'Export Sprints', description: 'Export sprint data' },
          { code: 'start', name: 'Start Sprints', description: 'Start sprint execution' },
          { code: 'complete', name: 'Complete Sprints', description: 'Mark sprints as completed' },
          { code: 'cancel', name: 'Cancel Sprints', description: 'Cancel active sprints' },
          { code: 'manage_capacity', name: 'Manage Capacity', description: 'Manage sprint capacity and velocity' },
          { code: 'assign_tasks', name: 'Assign Tasks', description: 'Assign tasks to sprints' },
          { code: 'view_burndown', name: 'View Burndown', description: 'View sprint burndown charts' }
        ]
      },

      // ⏱️ TIME TRACKING MODULE
      time_tracking: {
        moduleCode: 'time_tracking',
        moduleName: 'Time Tracking',
        description: 'Track time spent on projects and tasks',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Time Entries', description: 'View time entry information' },
          { code: 'read_all', name: 'View All Time Entries', description: 'View all time entries in organization' },
          { code: 'create', name: 'Create Time Entries', description: 'Create new time entries' },
          { code: 'update', name: 'Edit Time Entries', description: 'Modify existing time entries' },
          { code: 'delete', name: 'Delete Time Entries', description: 'Remove time entries' },
          { code: 'export', name: 'Export Time Entries', description: 'Export time tracking data' },
          { code: 'import', name: 'Import Time Entries', description: 'Import time entries from files' },
          { code: 'approve', name: 'Approve Time Entries', description: 'Approve time entries for billing' },
          { code: 'reject', name: 'Reject Time Entries', description: 'Reject time entries' },
          { code: 'view_reports', name: 'View Reports', description: 'View time tracking reports and analytics' },
          { code: 'manage_billable', name: 'Manage Billable Hours', description: 'Mark time entries as billable/non-billable' },
          { code: 'bulk_approve', name: 'Bulk Approve', description: 'Approve multiple time entries at once' }
        ]
      },

      // 👥 TEAM MODULE
      team: {
        moduleCode: 'team',
        moduleName: 'Team Management',
        description: 'Manage team members and assignments',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Team Members', description: 'View team member information' },
          { code: 'read_all', name: 'View All Team Members', description: 'View all team members in organization' },
          { code: 'create', name: 'Add Team Members', description: 'Add new team members to projects' },
          { code: 'update', name: 'Edit Team Members', description: 'Modify team member information' },
          { code: 'delete', name: 'Remove Team Members', description: 'Remove team members from projects' },
          { code: 'export', name: 'Export Team Data', description: 'Export team member data' },
          { code: 'import', name: 'Import Team Members', description: 'Import team members from files' },
          { code: 'assign_roles', name: 'Assign Roles', description: 'Assign roles to team members' },
          { code: 'manage_permissions', name: 'Manage Permissions', description: 'Manage team member permissions' },
          { code: 'view_performance', name: 'View Performance', description: 'View team member performance metrics' },
          { code: 'manage_availability', name: 'Manage Availability', description: 'Manage team member availability and capacity' }
        ]
      },

      // 📊 BACKLOG MODULE
      backlog: {
        moduleCode: 'backlog',
        moduleName: 'Backlog Management',
        description: 'Manage product backlog and user stories',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Backlog', description: 'View backlog items and user stories' },
          { code: 'read_all', name: 'View All Backlog', description: 'View all backlog items in organization' },
          { code: 'create', name: 'Create Backlog Items', description: 'Create new backlog items and stories' },
          { code: 'update', name: 'Edit Backlog Items', description: 'Modify existing backlog items' },
          { code: 'delete', name: 'Delete Backlog Items', description: 'Remove backlog items' },
          { code: 'export', name: 'Export Backlog', description: 'Export backlog data' },
          { code: 'import', name: 'Import Backlog', description: 'Import backlog items from files' },
          { code: 'prioritize', name: 'Prioritize Items', description: 'Prioritize backlog items' },
          { code: 'estimate', name: 'Estimate Items', description: 'Add story points and estimates' },
          { code: 'move_to_sprint', name: 'Move to Sprint', description: 'Move backlog items to sprints' },
          { code: 'manage_epics', name: 'Manage Epics', description: 'Manage epics and feature groups' }
        ]
      },

      // 📄 DOCUMENTS MODULE
      documents: {
        moduleCode: 'documents',
        moduleName: 'Document Management',
        description: 'Manage project documents and files',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Documents', description: 'View document information' },
          { code: 'read_all', name: 'View All Documents', description: 'View all documents in organization' },
          { code: 'create', name: 'Upload Documents', description: 'Upload new documents' },
          { code: 'update', name: 'Edit Documents', description: 'Modify document information and metadata' },
          { code: 'delete', name: 'Delete Documents', description: 'Remove documents from the system' },
          { code: 'export', name: 'Export Documents', description: 'Export document data' },
          { code: 'download', name: 'Download Documents', description: 'Download document files' },
          { code: 'share', name: 'Share Documents', description: 'Share documents with team members' },
          { code: 'version_control', name: 'Manage Versions', description: 'Manage document versions' },
          { code: 'add_comments', name: 'Add Comments', description: 'Add comments to documents' },
          { code: 'approve', name: 'Approve Documents', description: 'Approve documents for use' },
          { code: 'manage_permissions', name: 'Manage Permissions', description: 'Manage document access permissions' }
        ]
      },

      // 📈 ANALYTICS MODULE
      analytics: {
        moduleCode: 'analytics',
        moduleName: 'Analytics & Reporting',
        description: 'View project analytics and generate reports',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Analytics', description: 'View analytics and metrics' },
          { code: 'read_all', name: 'View All Analytics', description: 'View all analytics in organization' },
          { code: 'create', name: 'Create Reports', description: 'Create custom reports' },
          { code: 'update', name: 'Edit Reports', description: 'Modify existing reports' },
          { code: 'delete', name: 'Delete Reports', description: 'Remove reports' },
          { code: 'export', name: 'Export Reports', description: 'Export report data' },
          { code: 'schedule', name: 'Schedule Reports', description: 'Schedule automated reports' },
          { code: 'view_dashboards', name: 'View Dashboards', description: 'View analytics dashboards' },
          { code: 'customize_dashboards', name: 'Customize Dashboards', description: 'Customize dashboard layouts' },
          { code: 'view_project_health', name: 'View Project Health', description: 'View project health scores and metrics' },
          { code: 'view_team_performance', name: 'View Team Performance', description: 'View team performance analytics' },
          { code: 'view_burndown', name: 'View Burndown Charts', description: 'View sprint and project burndown charts' },
          { code: 'view_velocity', name: 'View Velocity', description: 'View team velocity metrics' }
        ]
      },

      // 📋 REPORTS MODULE
      reports: {
        moduleCode: 'reports',
        moduleName: 'Report Management',
        description: 'Create and manage project reports',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Reports', description: 'View report information' },
          { code: 'read_all', name: 'View All Reports', description: 'View all reports in organization' },
          { code: 'create', name: 'Create Reports', description: 'Create new reports' },
          { code: 'update', name: 'Edit Reports', description: 'Modify existing reports' },
          { code: 'delete', name: 'Delete Reports', description: 'Remove reports' },
          { code: 'export', name: 'Export Reports', description: 'Export report data to various formats' },
          { code: 'schedule', name: 'Schedule Reports', description: 'Schedule automated report generation' },
          { code: 'share', name: 'Share Reports', description: 'Share reports with team members' },
          { code: 'generate_pdf', name: 'Generate PDF', description: 'Generate PDF versions of reports' },
          { code: 'customize', name: 'Customize Reports', description: 'Customize report templates and layouts' }
        ]
      },

      // 💬 CHAT MODULE
      chat: {
        moduleCode: 'chat',
        moduleName: 'Project Chat',
        description: 'Team communication and collaboration',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Messages', description: 'View chat messages and conversations' },
          { code: 'read_all', name: 'View All Messages', description: 'View all messages in organization' },
          { code: 'create', name: 'Send Messages', description: 'Send messages in project chats' },
          { code: 'update', name: 'Edit Messages', description: 'Edit own messages' },
          { code: 'delete', name: 'Delete Messages', description: 'Delete own messages' },
          { code: 'create_channels', name: 'Create Channels', description: 'Create new chat channels' },
          { code: 'manage_channels', name: 'Manage Channels', description: 'Manage channel settings and members' },
          { code: 'delete_channels', name: 'Delete Channels', description: 'Delete chat channels' },
          { code: 'mention_users', name: 'Mention Users', description: 'Mention users in messages' },
          { code: 'share_files', name: 'Share Files', description: 'Share files in chat' },
          { code: 'pin_messages', name: 'Pin Messages', description: 'Pin important messages' }
        ]
      },

      // 📅 CALENDAR MODULE
      calendar: {
        moduleCode: 'calendar',
        moduleName: 'Calendar Management',
        description: 'Manage project events, meetings, and schedules',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Calendar', description: 'View calendar events' },
          { code: 'read_all', name: 'View All Events', description: 'View all calendar events in organization' },
          { code: 'create', name: 'Create Events', description: 'Create new calendar events' },
          { code: 'update', name: 'Edit Events', description: 'Modify event information' },
          { code: 'delete', name: 'Delete Events', description: 'Remove calendar events' },
          { code: 'export', name: 'Export Calendar', description: 'Export calendar data' },
          { code: 'import', name: 'Import Events', description: 'Import events from files' },
          { code: 'share', name: 'Share Events', description: 'Share events with team members' },
          { code: 'manage_recurring', name: 'Manage Recurring Events', description: 'Create and manage recurring events' }
        ]
      },

      // 🎯 KANBAN MODULE
      kanban: {
        moduleCode: 'kanban',
        moduleName: 'Kanban Board',
        description: 'Manage tasks using Kanban boards',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Kanban Boards', description: 'View Kanban board information' },
          { code: 'read_all', name: 'View All Boards', description: 'View all Kanban boards in organization' },
          { code: 'create', name: 'Create Boards', description: 'Create new Kanban boards' },
          { code: 'update', name: 'Edit Boards', description: 'Modify board settings and columns' },
          { code: 'delete', name: 'Delete Boards', description: 'Remove Kanban boards' },
          { code: 'move_cards', name: 'Move Cards', description: 'Move task cards between columns' },
          { code: 'manage_columns', name: 'Manage Columns', description: 'Add, edit, and remove board columns' },
          { code: 'manage_filters', name: 'Manage Filters', description: 'Create and manage board filters' },
          { code: 'export', name: 'Export Boards', description: 'Export board data' }
        ]
      },

      // 📊 DASHBOARD MODULE
      dashboard: {
        moduleCode: 'dashboard',
        moduleName: 'Project Dashboard',
        description: 'Project overview and analytics dashboard',
        isCore: true,
        permissions: [
          { code: 'view', name: 'View Dashboard', description: 'Access project dashboard' },
          { code: 'customize', name: 'Customize Dashboard', description: 'Customize dashboard layout and widgets' },
          { code: 'export', name: 'Export Dashboard', description: 'Export dashboard data and reports' },
          { code: 'share', name: 'Share Dashboard', description: 'Share dashboard views with others' },
          { code: 'create_widgets', name: 'Create Widgets', description: 'Create custom dashboard widgets' },
          { code: 'manage_widgets', name: 'Manage Widgets', description: 'Manage dashboard widget settings' }
        ]
      },

      // 🔔 NOTIFICATIONS MODULE
      notifications: {
        moduleCode: 'notifications',
        moduleName: 'Notification Management',
        description: 'Manage notifications and alerts',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Notifications', description: 'View notification information' },
          { code: 'read_all', name: 'View All Notifications', description: 'View all notifications in organization' },
          { code: 'create', name: 'Create Notifications', description: 'Create custom notifications' },
          { code: 'update', name: 'Edit Notifications', description: 'Modify notification settings' },
          { code: 'delete', name: 'Delete Notifications', description: 'Remove notifications' },
          { code: 'manage_preferences', name: 'Manage Preferences', description: 'Manage notification preferences' },
          { code: 'mark_read', name: 'Mark as Read', description: 'Mark notifications as read' },
          { code: 'bulk_actions', name: 'Bulk Actions', description: 'Perform bulk actions on notifications' }
        ]
      },

      // ⚙️ WORKSPACE MODULE
      workspace: {
        moduleCode: 'workspace',
        moduleName: 'Workspace Management',
        description: 'Manage workspaces and team collaboration spaces',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Workspaces', description: 'View workspace information' },
          { code: 'read_all', name: 'View All Workspaces', description: 'View all workspaces in organization' },
          { code: 'create', name: 'Create Workspaces', description: 'Create new workspaces' },
          { code: 'update', name: 'Edit Workspaces', description: 'Modify workspace settings' },
          { code: 'delete', name: 'Delete Workspaces', description: 'Remove workspaces' },
          { code: 'manage_members', name: 'Manage Members', description: 'Add and remove workspace members' },
          { code: 'manage_roles', name: 'Manage Roles', description: 'Assign roles to workspace members' },
          { code: 'manage_settings', name: 'Manage Settings', description: 'Manage workspace settings and configurations' },
          { code: 'export', name: 'Export Workspace Data', description: 'Export workspace data' },
          { code: 'archive', name: 'Archive Workspaces', description: 'Archive inactive workspaces' },
          { code: 'restore', name: 'Restore Workspaces', description: 'Restore archived workspaces' }
        ]
      },

      // 🔄 WORKFLOW MODULE
      workflow: {
        moduleCode: 'workflow',
        moduleName: 'Workflow Management',
        description: 'Manage automated workflows and processes',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Workflows', description: 'View workflow information' },
          { code: 'read_all', name: 'View All Workflows', description: 'View all workflows in organization' },
          { code: 'create', name: 'Create Workflows', description: 'Create new workflows' },
          { code: 'update', name: 'Edit Workflows', description: 'Modify workflow definitions' },
          { code: 'delete', name: 'Delete Workflows', description: 'Remove workflows' },
          { code: 'activate', name: 'Activate Workflows', description: 'Activate workflows for execution' },
          { code: 'deactivate', name: 'Deactivate Workflows', description: 'Deactivate workflows' },
          { code: 'view_executions', name: 'View Executions', description: 'View workflow execution history' },
          { code: 'manage_rules', name: 'Manage Rules', description: 'Manage workflow rules and conditions' },
          { code: 'manage_actions', name: 'Manage Actions', description: 'Manage workflow actions and triggers' },
          { code: 'export', name: 'Export Workflows', description: 'Export workflow definitions' },
          { code: 'import', name: 'Import Workflows', description: 'Import workflows from files' }
        ]
      },

      // ⚙️ SYSTEM MODULE
      system: {
        moduleCode: 'system',
        moduleName: 'System Configuration',
        description: 'System administration and configuration management',
        isCore: true,
        permissions: [
          // Settings Permissions
          { code: 'settings_read', name: 'View Settings', description: 'View system settings and configurations' },
          { code: 'settings_update', name: 'Update Settings', description: 'Update system settings' },

          // User Management Permissions
          { code: 'users_read', name: 'View Users', description: 'View user information' },
          { code: 'users_read_all', name: 'View All Users', description: 'View all users in organization' },
          { code: 'users_create', name: 'Create Users', description: 'Create new user accounts' },
          { code: 'users_update', name: 'Edit Users', description: 'Modify user information' },
          { code: 'users_delete', name: 'Delete Users', description: 'Remove user accounts' },
          { code: 'users_activate', name: 'Activate Users', description: 'Activate/deactivate users' },
          { code: 'users_reset_password', name: 'Reset Passwords', description: 'Reset user passwords' },
          { code: 'users_export', name: 'Export Users', description: 'Export user data' },
          { code: 'users_import', name: 'Import Users', description: 'Import users from files' },

          // Role Management Permissions
          { code: 'roles_read', name: 'View Roles', description: 'View role information' },
          { code: 'roles_read_all', name: 'View All Roles', description: 'View all roles in organization' },
          { code: 'roles_create', name: 'Create Roles', description: 'Create new roles' },
          { code: 'roles_update', name: 'Edit Roles', description: 'Modify role information' },
          { code: 'roles_delete', name: 'Delete Roles', description: 'Remove roles' },
          { code: 'roles_assign', name: 'Assign Roles', description: 'Assign roles to users' },
          { code: 'roles_export', name: 'Export Roles', description: 'Export role data' },

          // Integration Permissions
          { code: 'integrations_read', name: 'View Integrations', description: 'View system integrations' },
          { code: 'integrations_create', name: 'Create Integrations', description: 'Create new integrations' },
          { code: 'integrations_update', name: 'Update Integrations', description: 'Update existing integrations' },
          { code: 'integrations_delete', name: 'Delete Integrations', description: 'Delete integrations' },

          // Audit Logs Permissions
          { code: 'audit_read', name: 'View Audit Logs', description: 'View basic audit log information' },
          { code: 'audit_read_all', name: 'View All Audit Logs', description: 'View all audit logs in organization' },
          { code: 'audit_export', name: 'Export Audit Logs', description: 'Export audit log data to various formats' },
          { code: 'audit_view_details', name: 'View Audit Details', description: 'View detailed audit log information' },
          { code: 'audit_filter', name: 'Filter Audit Logs', description: 'Filter audit logs by various criteria' },
          { code: 'audit_generate_reports', name: 'Generate Reports', description: 'Generate audit reports' },
          { code: 'audit_archive', name: 'Archive Logs', description: 'Archive old audit logs' },
          { code: 'audit_purge', name: 'Purge Old Logs', description: 'Purge old audit logs' },

          // Activity Logs Permissions
          { code: 'activity_logs_read', name: 'View Activity Logs', description: 'View activity log information' },
          { code: 'activity_logs_read_all', name: 'View All Activity Logs', description: 'View all activity logs in organization' },
          { code: 'activity_logs_export', name: 'Export Activity Logs', description: 'Export activity log data' },
          { code: 'activity_logs_view_details', name: 'View Activity Details', description: 'View detailed activity information' },
          { code: 'activity_logs_filter', name: 'Filter Activity Logs', description: 'Filter activity logs by various criteria' },
          { code: 'activity_logs_generate_reports', name: 'Generate Reports', description: 'Generate activity log reports' },
          { code: 'activity_logs_archive', name: 'Archive Logs', description: 'Archive old activity logs' },
          { code: 'activity_logs_purge', name: 'Purge Old Logs', description: 'Purge old activity logs' }
        ]
      }
    }
  },

  // 📦 **OPERATIONS MANAGEMENT APPLICATION**
  operations: {
    appInfo: {
      appCode: 'operations',
      appName: 'Operations Management',
      description: 'End-to-end operations: inventory, procurement, suppliers, logistics, orders, fulfillments, and analytics',
      icon: '📦',
      baseUrl: 'https://ops.zopkit.com',
      version: '1.0.0',
      isCore: true,
      sortOrder: 4
    },
    modules: {
      dashboard: {
        moduleCode: 'dashboard',
        moduleName: 'Operations Dashboard',
        description: 'Operations overview and analytics dashboard',
        isCore: true,
        permissions: [
          { code: 'view', name: 'View Dashboard', description: 'Access operations dashboard' },
          { code: 'customize', name: 'Customize Dashboard', description: 'Customize dashboard layout and widgets' },
          { code: 'export', name: 'Export Reports', description: 'Export dashboard reports' }
        ]
      },
      inventory: {
        moduleCode: 'inventory',
        moduleName: 'Inventory Management',
        description: 'Manage inventory, stock levels, and movements',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Inventory', description: 'View inventory information' },
          { code: 'read_all', name: 'View All Inventory', description: 'View all inventory items' },
          { code: 'create', name: 'Create Inventory Items', description: 'Add new inventory items' },
          { code: 'update', name: 'Edit Inventory', description: 'Modify inventory information' },
          { code: 'delete', name: 'Delete Inventory', description: 'Remove inventory items' },
          { code: 'export', name: 'Export Inventory', description: 'Export inventory data' },
          { code: 'import', name: 'Import Inventory', description: 'Import inventory from files' },
          { code: 'adjust', name: 'Adjust Stock Levels', description: 'Adjust inventory quantities' },
          { code: 'movement', name: 'Track Movements', description: 'Track inventory movements' }
        ]
      },
      warehouse: {
        moduleCode: 'warehouse',
        moduleName: 'Warehouse Management',
        description: 'Warehouse operations, cycle counts, and pick paths',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Warehouse', description: 'View warehouse and location information' },
          { code: 'read_all', name: 'View All Warehouses', description: 'View all warehouses' },
          { code: 'create', name: 'Create Warehouse', description: 'Add new warehouses or locations' },
          { code: 'update', name: 'Edit Warehouse', description: 'Modify warehouse information' },
          { code: 'delete', name: 'Delete Warehouse', description: 'Remove warehouses' },
          { code: 'cycle_count', name: 'Cycle Count', description: 'Perform cycle counts' },
          { code: 'pick_path', name: 'Manage Pick Paths', description: 'Manage pick paths and routing' }
        ]
      },
      procurement: {
        moduleCode: 'procurement',
        moduleName: 'Procurement Management',
        description: 'Requisitions, purchase orders, and procurement workflow',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Procurement', description: 'View requisitions and purchase orders' },
          { code: 'read_all', name: 'View All Procurement', description: 'View all procurement in organization' },
          { code: 'create', name: 'Create Requisition', description: 'Create new requisitions' },
          { code: 'update', name: 'Edit Procurement', description: 'Modify requisitions and POs' },
          { code: 'delete', name: 'Delete Procurement', description: 'Remove requisitions or POs' },
          { code: 'approve', name: 'Approve Requisition', description: 'Approve procurement requests' },
          { code: 'export', name: 'Export Procurement', description: 'Export procurement data' }
        ]
      },
      suppliers: {
        moduleCode: 'suppliers',
        moduleName: 'Supplier Management',
        description: 'Manage suppliers, performance, and risk assessments',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Suppliers', description: 'View supplier information' },
          { code: 'read_all', name: 'View All Suppliers', description: 'View all suppliers in organization' },
          { code: 'create', name: 'Create Suppliers', description: 'Add new suppliers' },
          { code: 'update', name: 'Edit Suppliers', description: 'Modify supplier information' },
          { code: 'delete', name: 'Delete Suppliers', description: 'Remove suppliers' },
          { code: 'view_performance', name: 'View Supplier Performance', description: 'View supplier performance metrics' },
          { code: 'view_risk', name: 'View Risk Assessments', description: 'View supplier risk assessments' },
          { code: 'export', name: 'Export Suppliers', description: 'Export supplier data' }
        ]
      },
      transportation: {
        moduleCode: 'transportation',
        moduleName: 'Transportation & Logistics',
        description: 'Transportation orders, logistics, and shipping',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Transportation', description: 'View transportation and logistics data' },
          { code: 'read_all', name: 'View All Transportation', description: 'View all transportation orders' },
          { code: 'create', name: 'Create Transportation Order', description: 'Create transportation orders' },
          { code: 'update', name: 'Edit Transportation', description: 'Modify transportation information' },
          { code: 'delete', name: 'Delete Transportation', description: 'Remove transportation orders' },
          { code: 'export', name: 'Export Transportation', description: 'Export transportation data' }
        ]
      },
      orders: {
        moduleCode: 'orders',
        moduleName: 'Order Management',
        description: 'Manage orders, fulfillment, and shipments',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Orders', description: 'View order information' },
          { code: 'read_all', name: 'View All Orders', description: 'View all orders in organization' },
          { code: 'create', name: 'Create Orders', description: 'Create new orders' },
          { code: 'update', name: 'Edit Orders', description: 'Modify order information' },
          { code: 'delete', name: 'Delete Orders', description: 'Remove orders' },
          { code: 'process', name: 'Process Orders', description: 'Process and fulfill orders' },
          { code: 'export', name: 'Export Orders', description: 'Export order data' }
        ]
      },
      fulfillments: {
        moduleCode: 'fulfillments',
        moduleName: 'Fulfillment Management',
        description: 'Order fulfillment and shipment tracking',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Fulfillments', description: 'View fulfillment information' },
          { code: 'read_all', name: 'View All Fulfillments', description: 'View all fulfillments' },
          { code: 'create', name: 'Create Fulfillment', description: 'Create fulfillments' },
          { code: 'update', name: 'Edit Fulfillment', description: 'Modify fulfillment status' },
          { code: 'delete', name: 'Delete Fulfillment', description: 'Remove fulfillments' },
          { code: 'export', name: 'Export Fulfillments', description: 'Export fulfillment data' }
        ]
      },
      shipments: {
        moduleCode: 'shipments',
        moduleName: 'Shipment Management',
        description: 'Shipment tracking and carrier management',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Shipments', description: 'View shipment information' },
          { code: 'read_all', name: 'View All Shipments', description: 'View all shipments' },
          { code: 'create', name: 'Create Shipment', description: 'Create new shipments' },
          { code: 'update', name: 'Edit Shipment', description: 'Modify shipment information' },
          { code: 'delete', name: 'Delete Shipment', description: 'Remove shipments' },
          { code: 'track', name: 'Track Shipments', description: 'Track shipment status' },
          { code: 'export', name: 'Export Shipments', description: 'Export shipment data' }
        ]
      },
      catalog: {
        moduleCode: 'catalog',
        moduleName: 'Product Catalog',
        description: 'Product catalog and categories',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Catalog', description: 'View product catalog' },
          { code: 'read_all', name: 'View All Catalog', description: 'View all catalog items' },
          { code: 'create', name: 'Create Catalog Items', description: 'Add catalog products' },
          { code: 'update', name: 'Edit Catalog', description: 'Modify catalog information' },
          { code: 'delete', name: 'Delete Catalog Items', description: 'Remove catalog items' },
          { code: 'export', name: 'Export Catalog', description: 'Export catalog data' }
        ]
      },
      quality: {
        moduleCode: 'quality',
        moduleName: 'Quality Management',
        description: 'Quality checks and compliance',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Quality', description: 'View quality data' },
          { code: 'read_all', name: 'View All Quality', description: 'View all quality records' },
          { code: 'create', name: 'Create Quality Record', description: 'Add quality records' },
          { code: 'update', name: 'Edit Quality', description: 'Modify quality information' },
          { code: 'delete', name: 'Delete Quality', description: 'Remove quality records' },
          { code: 'export', name: 'Export Quality', description: 'Export quality data' }
        ]
      },
      rfx: {
        moduleCode: 'rfx',
        moduleName: 'RFx & Sourcing',
        description: 'RFQ, RFP, and sourcing events',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View RFx', description: 'View RFx and sourcing events' },
          { code: 'read_all', name: 'View All RFx', description: 'View all RFx in organization' },
          { code: 'create', name: 'Create RFx', description: 'Create new RFx events' },
          { code: 'update', name: 'Edit RFx', description: 'Modify RFx information' },
          { code: 'delete', name: 'Delete RFx', description: 'Remove RFx events' },
          { code: 'submit_response', name: 'Submit Response', description: 'Submit vendor responses' },
          { code: 'evaluate', name: 'Evaluate Responses', description: 'Evaluate RFx responses' },
          { code: 'export', name: 'Export RFx', description: 'Export RFx data' }
        ]
      },
      finance: {
        moduleCode: 'finance',
        moduleName: 'Finance & Invoices',
        description: 'Invoices and financial operations',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Finance', description: 'View invoice and finance data' },
          { code: 'read_all', name: 'View All Finance', description: 'View all finance records' },
          { code: 'create', name: 'Create Invoice', description: 'Create invoices' },
          { code: 'update', name: 'Edit Finance', description: 'Modify finance records' },
          { code: 'delete', name: 'Delete Finance', description: 'Remove finance records' },
          { code: 'export', name: 'Export Finance', description: 'Export finance data' }
        ]
      },
      tax_compliance: {
        moduleCode: 'tax_compliance',
        moduleName: 'Tax Compliance',
        description: 'Tax compliance and reporting',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Tax Compliance', description: 'View tax compliance data' },
          { code: 'read_all', name: 'View All Tax', description: 'View all tax records' },
          { code: 'create', name: 'Create Tax Record', description: 'Create tax records' },
          { code: 'update', name: 'Edit Tax', description: 'Modify tax information' },
          { code: 'export', name: 'Export Tax', description: 'Export tax compliance data' }
        ]
      },
      supply_chain: {
        moduleCode: 'supply_chain',
        moduleName: 'Supply Chain',
        description: 'Supply chain planning and demand',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Supply Chain', description: 'View supply chain data' },
          { code: 'read_all', name: 'View All Supply Chain', description: 'View all supply chain data' },
          { code: 'create', name: 'Create Supply Chain', description: 'Create supply chain records' },
          { code: 'update', name: 'Edit Supply Chain', description: 'Modify supply chain information' },
          { code: 'export', name: 'Export Supply Chain', description: 'Export supply chain data' }
        ]
      },
      analytics: {
        moduleCode: 'analytics',
        moduleName: 'Analytics & Reporting',
        description: 'Operations analytics and reports',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Analytics', description: 'View analytics and reports' },
          { code: 'read_all', name: 'View All Analytics', description: 'View all analytics in organization' },
          { code: 'create', name: 'Create Reports', description: 'Create custom reports' },
          { code: 'export', name: 'Export Analytics', description: 'Export analytics data' },
          { code: 'schedule', name: 'Schedule Reports', description: 'Schedule automated reports' }
        ]
      },
      contracts: {
        moduleCode: 'contracts',
        moduleName: 'Contract Management',
        description: 'Vendor and service contracts',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Contracts', description: 'View contract information' },
          { code: 'read_all', name: 'View All Contracts', description: 'View all contracts' },
          { code: 'create', name: 'Create Contract', description: 'Create new contracts' },
          { code: 'update', name: 'Edit Contract', description: 'Modify contract information' },
          { code: 'delete', name: 'Delete Contract', description: 'Remove contracts' },
          { code: 'export', name: 'Export Contracts', description: 'Export contract data' }
        ]
      },
      service_appointments: {
        moduleCode: 'service_appointments',
        moduleName: 'Service Appointments',
        description: 'Service bookings and appointments',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Appointments', description: 'View service appointments' },
          { code: 'read_all', name: 'View All Appointments', description: 'View all appointments' },
          { code: 'create', name: 'Create Appointment', description: 'Create new appointments' },
          { code: 'update', name: 'Edit Appointment', description: 'Modify appointment information' },
          { code: 'delete', name: 'Delete Appointment', description: 'Remove appointments' },
          { code: 'export', name: 'Export Appointments', description: 'Export appointment data' }
        ]
      },
      notifications: {
        moduleCode: 'notifications',
        moduleName: 'Notifications',
        description: 'Notifications and alerts',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Notifications', description: 'View notifications' },
          { code: 'read_all', name: 'View All Notifications', description: 'View all notifications' },
          { code: 'create', name: 'Create Notification', description: 'Create notifications' },
          { code: 'update', name: 'Edit Notification', description: 'Modify notification settings' },
          { code: 'manage_preferences', name: 'Manage Preferences', description: 'Manage notification preferences' }
        ]
      },
      system: {
        moduleCode: 'system',
        moduleName: 'System Configuration',
        description: 'Operations system settings and user management',
        isCore: true,
        permissions: [
          { code: 'settings_read', name: 'View Settings', description: 'View system settings' },
          { code: 'settings_update', name: 'Update Settings', description: 'Update system settings' },
          { code: 'users_read', name: 'View Users', description: 'View user information' },
          { code: 'users_read_all', name: 'View All Users', description: 'View all users in organization' },
          { code: 'users_create', name: 'Create Users', description: 'Create new user accounts' },
          { code: 'users_update', name: 'Edit Users', description: 'Modify user information' },
          { code: 'users_delete', name: 'Delete Users', description: 'Remove user accounts' },
          { code: 'roles_read', name: 'View Roles', description: 'View role information' },
          { code: 'roles_read_all', name: 'View All Roles', description: 'View all roles in organization' },
          { code: 'roles_create', name: 'Create Roles', description: 'Create new roles' },
          { code: 'roles_update', name: 'Edit Roles', description: 'Modify role permissions' },
          { code: 'roles_delete', name: 'Delete Roles', description: 'Remove roles' },
          { code: 'wrapper_sync', name: 'Wrapper Sync', description: 'Trigger and view Wrapper tenant sync' }
        ]
      },
      // --- Additional modules for full Ops sidebar coverage ---
      marketing: {
        moduleCode: 'marketing',
        moduleName: 'Marketing',
        description: 'Marketing campaigns and cart recovery',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Marketing', description: 'View marketing campaigns and data' },
          { code: 'read_all', name: 'View All Marketing', description: 'View all marketing data' },
          { code: 'create', name: 'Create Campaigns', description: 'Create marketing campaigns' },
          { code: 'update', name: 'Edit Campaigns', description: 'Modify marketing campaigns' },
          { code: 'delete', name: 'Delete Campaigns', description: 'Remove marketing campaigns' },
          { code: 'export', name: 'Export Marketing', description: 'Export marketing data' }
        ]
      },
      customers: {
        moduleCode: 'customers',
        moduleName: 'Customer Management',
        description: 'Manage customers, profiles, and communication',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Customers', description: 'View customer information' },
          { code: 'read_all', name: 'View All Customers', description: 'View all customers' },
          { code: 'create', name: 'Create Customer', description: 'Add new customers' },
          { code: 'update', name: 'Edit Customer', description: 'Modify customer information' },
          { code: 'delete', name: 'Delete Customer', description: 'Remove customers' },
          { code: 'export', name: 'Export Customers', description: 'Export customer data' }
        ]
      },
      returns: {
        moduleCode: 'returns',
        moduleName: 'Returns Management',
        description: 'Process and track product returns',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Returns', description: 'View return requests' },
          { code: 'read_all', name: 'View All Returns', description: 'View all return requests' },
          { code: 'create', name: 'Create Return', description: 'Initiate a return' },
          { code: 'update', name: 'Edit Return', description: 'Modify return information' },
          { code: 'delete', name: 'Delete Return', description: 'Remove return records' },
          { code: 'approve', name: 'Approve Return', description: 'Approve return requests' },
          { code: 'export', name: 'Export Returns', description: 'Export return data' }
        ]
      },
      customer_portal: {
        moduleCode: 'customer_portal',
        moduleName: 'Customer Portal',
        description: 'Customer-facing portal: shop, services, bookings, payments, wishlist',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Customer Portal', description: 'Access customer portal' },
          { code: 'read_all', name: 'View All Portal Data', description: 'View all portal data' },
          { code: 'manage_shop', name: 'Manage Shop', description: 'Manage customer shop settings' },
          { code: 'manage_services', name: 'Manage Services', description: 'Manage customer service bookings' },
          { code: 'manage_orders', name: 'Manage Orders', description: 'Manage customer orders' },
          { code: 'manage_bookings', name: 'Manage Bookings', description: 'Manage customer bookings' },
          { code: 'manage_payments', name: 'Manage Payments', description: 'Manage customer payments' },
          { code: 'manage_wishlist', name: 'Manage Wishlist', description: 'Manage customer wishlists' },
          { code: 'manage_preferences', name: 'Manage Preferences', description: 'Manage customer preferences' },
          { code: 'export', name: 'Export Portal Data', description: 'Export customer portal data' }
        ]
      },
      vendor_management: {
        moduleCode: 'vendor_management',
        moduleName: 'Multi-Vendor Management',
        description: 'Vendor profiles, products, ratings, policies, and analytics',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Vendors', description: 'View vendor information' },
          { code: 'read_all', name: 'View All Vendors', description: 'View all vendors' },
          { code: 'create', name: 'Create Vendor', description: 'Add new vendors' },
          { code: 'update', name: 'Edit Vendor', description: 'Modify vendor information' },
          { code: 'delete', name: 'Delete Vendor', description: 'Remove vendors' },
          { code: 'manage_products', name: 'Manage Vendor Products', description: 'Manage vendor product listings' },
          { code: 'manage_ratings', name: 'Manage Ratings', description: 'Manage vendor ratings and reviews' },
          { code: 'manage_policies', name: 'Manage Policies', description: 'Manage vendor policies' },
          { code: 'manage_communication', name: 'Manage Communication', description: 'Manage vendor communication' },
          { code: 'view_analytics', name: 'View Analytics', description: 'View vendor analytics' },
          { code: 'manage_certifications', name: 'Manage Certifications', description: 'Manage vendor certifications' },
          { code: 'manage_portfolios', name: 'Manage Portfolios', description: 'Manage vendor portfolios' },
          { code: 'export', name: 'Export Vendors', description: 'Export vendor data' }
        ]
      },
      service_providers: {
        moduleCode: 'service_providers',
        moduleName: 'Service Provider Portal',
        description: 'Service provider catalog, pricing, promotions, and bundles',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Providers', description: 'View service providers' },
          { code: 'read_all', name: 'View All Providers', description: 'View all service providers' },
          { code: 'create', name: 'Create Provider', description: 'Add service providers' },
          { code: 'update', name: 'Edit Provider', description: 'Modify provider information' },
          { code: 'delete', name: 'Delete Provider', description: 'Remove service providers' },
          { code: 'manage_catalog', name: 'Manage Catalog', description: 'Manage service catalog' },
          { code: 'manage_pricing', name: 'Manage Pricing', description: 'Manage pricing rules' },
          { code: 'manage_promotions', name: 'Manage Promotions', description: 'Manage promotions and bundles' },
          { code: 'view_analytics', name: 'View Analytics', description: 'View pricing analytics' },
          { code: 'export', name: 'Export Providers', description: 'Export provider data' }
        ]
      }
    }
  },

  // 💰 **FINANCIAL ACCOUNTING APPLICATION**
  accounting: {
    appInfo: {
      appCode: 'accounting',
      appName: 'Financial Accounting',
      description: 'Complete financial accounting solution — GL, AR, AP, banking, tax, budgeting, payroll, inventory, fixed assets, compliance, and analytics',
      icon: '💰',
      baseUrl: 'https://accounting.zopkit.com',
      version: '2.0.0',
      isCore: true,
      sortOrder: 5
    },
    modules: {
      dashboard: {
        moduleCode: 'dashboard',
        moduleName: 'Accounting Dashboard',
        description: 'Main accounting dashboard with financial overview',
        isCore: true,
        permissions: [
          { code: 'view', name: 'View Dashboard', description: 'Access accounting dashboard' },
          { code: 'customize', name: 'Customize Dashboard', description: 'Customize dashboard layout and widgets' },
          { code: 'export', name: 'Export Dashboard', description: 'Export dashboard reports' }
        ]
      },
      general_ledger: {
        moduleCode: 'general_ledger',
        moduleName: 'General Ledger',
        description: 'Core general ledger, trial balance, closing and adjusting entries',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View General Ledger', description: 'View general ledger entries and balances' },
          { code: 'create', name: 'Create GL Entries', description: 'Create new general ledger entries' },
          { code: 'update', name: 'Edit GL Entries', description: 'Modify general ledger entries' },
          { code: 'delete', name: 'Delete GL Entries', description: 'Remove general ledger entries' },
          { code: 'post', name: 'Post GL Entries', description: 'Post entries to the ledger' },
          { code: 'approve', name: 'Approve GL Entries', description: 'Approve general ledger entries' },
          { code: 'close_period', name: 'Close Period', description: 'Close accounting periods' },
          { code: 'export', name: 'Export GL Data', description: 'Export general ledger data' }
        ]
      },
      chart_of_accounts: {
        moduleCode: 'chart_of_accounts',
        moduleName: 'Chart of Accounts',
        description: 'Manage the chart of accounts structure',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Chart of Accounts', description: 'View accounts in the chart' },
          { code: 'create', name: 'Create Accounts', description: 'Add new accounts to the chart' },
          { code: 'update', name: 'Edit Accounts', description: 'Modify account information' },
          { code: 'delete', name: 'Delete Accounts', description: 'Remove accounts from the chart' },
          { code: 'import', name: 'Import Accounts', description: 'Import chart of accounts from files' },
          { code: 'export', name: 'Export Accounts', description: 'Export chart of accounts' }
        ]
      },
      journal_entries: {
        moduleCode: 'journal_entries',
        moduleName: 'Journal Entries',
        description: 'Create and manage journal entries',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Journal Entries', description: 'View journal entry information' },
          { code: 'create', name: 'Create Journal Entries', description: 'Create new journal entries' },
          { code: 'update', name: 'Edit Journal Entries', description: 'Modify journal entries' },
          { code: 'delete', name: 'Delete Journal Entries', description: 'Remove journal entries' },
          { code: 'post', name: 'Post Journal Entries', description: 'Post journal entries to the ledger' },
          { code: 'approve', name: 'Approve Journal Entries', description: 'Approve journal entries for posting' },
          { code: 'reverse', name: 'Reverse Journal Entries', description: 'Create reversing journal entries' },
          { code: 'export', name: 'Export Journal Entries', description: 'Export journal entry data' }
        ]
      },
      invoices: {
        moduleCode: 'invoices',
        moduleName: 'Customer Invoices',
        description: 'Create and manage customer invoices',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Invoices', description: 'View invoice information' },
          { code: 'read_all', name: 'View All Invoices', description: 'View all invoices in organization' },
          { code: 'create', name: 'Create Invoices', description: 'Create new invoices' },
          { code: 'update', name: 'Edit Invoices', description: 'Modify invoice information' },
          { code: 'delete', name: 'Delete Invoices', description: 'Remove invoices' },
          { code: 'send', name: 'Send Invoices', description: 'Send invoices to customers' },
          { code: 'post', name: 'Post Invoices', description: 'Post invoices to the ledger' },
          { code: 'export', name: 'Export Invoices', description: 'Export invoice data' },
          { code: 'import', name: 'Import Invoices', description: 'Import invoices from files' },
          { code: 'generate_pdf', name: 'Generate PDF', description: 'Generate PDF versions of invoices' }
        ]
      },
      customers: {
        moduleCode: 'customers',
        moduleName: 'Customer Management',
        description: 'Manage customer accounts and contacts',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Customers', description: 'View customer information' },
          { code: 'read_all', name: 'View All Customers', description: 'View all customers in organization' },
          { code: 'create', name: 'Create Customers', description: 'Add new customers' },
          { code: 'update', name: 'Edit Customers', description: 'Modify customer information' },
          { code: 'delete', name: 'Delete Customers', description: 'Remove customers' },
          { code: 'export', name: 'Export Customers', description: 'Export customer data' },
          { code: 'import', name: 'Import Customers', description: 'Import customers from files' }
        ]
      },
      credit_notes: {
        moduleCode: 'credit_notes',
        moduleName: 'Credit Notes',
        description: 'Create and manage customer credit notes',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Credit Notes', description: 'View credit note information' },
          { code: 'create', name: 'Create Credit Notes', description: 'Create new credit notes' },
          { code: 'update', name: 'Edit Credit Notes', description: 'Modify credit note information' },
          { code: 'delete', name: 'Delete Credit Notes', description: 'Remove credit notes' },
          { code: 'apply', name: 'Apply Credit Notes', description: 'Apply credit notes to invoices' },
          { code: 'export', name: 'Export Credit Notes', description: 'Export credit note data' }
        ]
      },
      sales_orders: {
        moduleCode: 'sales_orders',
        moduleName: 'Sales Orders',
        description: 'Manage customer sales orders',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Sales Orders', description: 'View sales order information' },
          { code: 'read_all', name: 'View All Sales Orders', description: 'View all sales orders' },
          { code: 'create', name: 'Create Sales Orders', description: 'Create new sales orders' },
          { code: 'update', name: 'Edit Sales Orders', description: 'Modify sales order information' },
          { code: 'delete', name: 'Delete Sales Orders', description: 'Remove sales orders' },
          { code: 'approve', name: 'Approve Sales Orders', description: 'Approve sales orders' },
          { code: 'convert', name: 'Convert to Invoice', description: 'Convert sales orders to invoices' },
          { code: 'export', name: 'Export Sales Orders', description: 'Export sales order data' }
        ]
      },
      estimates: {
        moduleCode: 'estimates',
        moduleName: 'Estimates & Quotes',
        description: 'Create and manage estimates and quotations',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Estimates', description: 'View estimate information' },
          { code: 'create', name: 'Create Estimates', description: 'Create new estimates' },
          { code: 'update', name: 'Edit Estimates', description: 'Modify estimate information' },
          { code: 'delete', name: 'Delete Estimates', description: 'Remove estimates' },
          { code: 'send', name: 'Send Estimates', description: 'Send estimates to customers' },
          { code: 'convert', name: 'Convert to Invoice', description: 'Convert estimates to invoices' },
          { code: 'export', name: 'Export Estimates', description: 'Export estimate data' },
          { code: 'generate_pdf', name: 'Generate PDF', description: 'Generate PDF versions of estimates' }
        ]
      },
      recurring_invoices: {
        moduleCode: 'recurring_invoices',
        moduleName: 'Recurring Invoices',
        description: 'Manage recurring invoice templates and scheduled billing',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Recurring Invoices', description: 'View recurring invoice templates' },
          { code: 'read_all', name: 'View All Recurring Invoices', description: 'View all recurring invoice templates in organization' },
          { code: 'create', name: 'Create Recurring Invoices', description: 'Create recurring invoice templates' },
          { code: 'update', name: 'Edit Recurring Invoices', description: 'Modify recurring invoice templates' },
          { code: 'delete', name: 'Delete Recurring Invoices', description: 'Remove recurring invoice templates' },
          { code: 'send', name: 'Send Recurring Invoices', description: 'Trigger delivery of recurring invoices' },
          { code: 'post', name: 'Post Recurring Invoices', description: 'Post generated recurring invoices to ledger' },
          { code: 'export', name: 'Export Recurring Invoices', description: 'Export recurring invoice data' }
        ]
      },
      bills: {
        moduleCode: 'bills',
        moduleName: 'Vendor Bills',
        description: 'Manage vendor bills and payments',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Bills', description: 'View bill information' },
          { code: 'read_all', name: 'View All Bills', description: 'View all bills in organization' },
          { code: 'create', name: 'Create Bills', description: 'Create new vendor bills' },
          { code: 'update', name: 'Edit Bills', description: 'Modify bill information' },
          { code: 'delete', name: 'Delete Bills', description: 'Remove bills' },
          { code: 'pay', name: 'Pay Bills', description: 'Process bill payments' },
          { code: 'approve', name: 'Approve Bills', description: 'Approve vendor bills for payment' },
          { code: 'export', name: 'Export Bills', description: 'Export bill data' }
        ]
      },
      vendors: {
        moduleCode: 'vendors',
        moduleName: 'Vendor Management',
        description: 'Manage vendor accounts and information',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Vendors', description: 'View vendor information' },
          { code: 'read_all', name: 'View All Vendors', description: 'View all vendors in organization' },
          { code: 'create', name: 'Create Vendors', description: 'Add new vendors' },
          { code: 'update', name: 'Edit Vendors', description: 'Modify vendor information' },
          { code: 'delete', name: 'Delete Vendors', description: 'Remove vendors' },
          { code: 'export', name: 'Export Vendors', description: 'Export vendor data' },
          { code: 'import', name: 'Import Vendors', description: 'Import vendors from files' }
        ]
      },
      purchase_orders: {
        moduleCode: 'purchase_orders',
        moduleName: 'Purchase Orders',
        description: 'Create and manage purchase orders',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Purchase Orders', description: 'View purchase order information' },
          { code: 'read_all', name: 'View All Purchase Orders', description: 'View all purchase orders' },
          { code: 'create', name: 'Create Purchase Orders', description: 'Create new purchase orders' },
          { code: 'update', name: 'Edit Purchase Orders', description: 'Modify purchase order information' },
          { code: 'delete', name: 'Delete Purchase Orders', description: 'Remove purchase orders' },
          { code: 'approve', name: 'Approve Purchase Orders', description: 'Approve purchase orders' },
          { code: 'receive', name: 'Receive Goods', description: 'Record receipt of purchased goods' },
          { code: 'export', name: 'Export Purchase Orders', description: 'Export purchase order data' }
        ]
      },
      expense_reports: {
        moduleCode: 'expense_reports',
        moduleName: 'Expense Reports',
        description: 'Manage employee expense reports and reimbursements',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Expense Reports', description: 'View expense report information' },
          { code: 'read_all', name: 'View All Expense Reports', description: 'View all expense reports' },
          { code: 'create', name: 'Create Expense Reports', description: 'Submit expense reports' },
          { code: 'update', name: 'Edit Expense Reports', description: 'Modify expense report information' },
          { code: 'delete', name: 'Delete Expense Reports', description: 'Remove expense reports' },
          { code: 'approve', name: 'Approve Expense Reports', description: 'Approve expense reports for payment' },
          { code: 'reimburse', name: 'Process Reimbursement', description: 'Process expense reimbursements' },
          { code: 'export', name: 'Export Expense Reports', description: 'Export expense report data' }
        ]
      },
      vendor_credits: {
        moduleCode: 'vendor_credits',
        moduleName: 'Vendor Credits',
        description: 'Manage vendor credits and debit memos',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Vendor Credits', description: 'View vendor credit information' },
          { code: 'create', name: 'Create Vendor Credits', description: 'Create new vendor credits' },
          { code: 'update', name: 'Edit Vendor Credits', description: 'Modify vendor credit information' },
          { code: 'delete', name: 'Delete Vendor Credits', description: 'Remove vendor credits' },
          { code: 'apply', name: 'Apply Vendor Credits', description: 'Apply vendor credits to bills' },
          { code: 'export', name: 'Export Vendor Credits', description: 'Export vendor credit data' }
        ]
      },
      banking: {
        moduleCode: 'banking',
        moduleName: 'Banking & Reconciliation',
        description: 'Bank accounts, transactions, reconciliation, and cash flow management',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Banking', description: 'View bank account and transaction information' },
          { code: 'read_all', name: 'View All Banking', description: 'View all bank data in organization' },
          { code: 'create', name: 'Create Bank Entries', description: 'Create bank transactions and accounts' },
          { code: 'update', name: 'Edit Banking', description: 'Modify bank information' },
          { code: 'delete', name: 'Delete Banking', description: 'Remove bank records' },
          { code: 'reconcile', name: 'Reconcile Accounts', description: 'Perform bank reconciliation' },
          { code: 'import_feeds', name: 'Import Bank Feeds', description: 'Import bank feed data' },
          { code: 'transfer', name: 'Wire Transfers', description: 'Process wire transfers' },
          { code: 'export', name: 'Export Banking', description: 'Export bank data' }
        ]
      },
      tax: {
        moduleCode: 'tax',
        moduleName: 'Tax Management',
        description: 'Tax configuration, GST/TDS (India), VAT/Sales Tax, compliance',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Tax', description: 'View tax information and rates' },
          { code: 'read_all', name: 'View All Tax Data', description: 'View all tax records and summaries' },
          { code: 'create', name: 'Create Tax Records', description: 'Create new tax records' },
          { code: 'update', name: 'Edit Tax', description: 'Modify tax information' },
          { code: 'delete', name: 'Delete Tax Records', description: 'Remove tax records' },
          { code: 'configure', name: 'Configure Tax Rules', description: 'Configure tax rates and rules' },
          { code: 'file_returns', name: 'File Tax Returns', description: 'File GST/VAT returns' },
          { code: 'reconcile', name: 'Tax Reconciliation', description: 'Reconcile tax records' },
          { code: 'export', name: 'Export Tax Data', description: 'Export tax reports and data' }
        ]
      },
      reports: {
        moduleCode: 'reports',
        moduleName: 'Financial Reports',
        description: 'P&L, Balance Sheet, Cash Flow, Trial Balance, and other financial reports',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Reports', description: 'View financial reports' },
          { code: 'read_all', name: 'View All Reports', description: 'View all reports in organization' },
          { code: 'create', name: 'Create Reports', description: 'Create custom financial reports' },
          { code: 'update', name: 'Edit Reports', description: 'Modify report definitions and settings' },
          { code: 'delete', name: 'Delete Reports', description: 'Remove saved reports' },
          { code: 'export', name: 'Export Reports', description: 'Export report data to various formats' },
          { code: 'schedule', name: 'Schedule Reports', description: 'Schedule automated report generation' },
          { code: 'generate_pdf', name: 'Generate PDF', description: 'Generate PDF versions of reports' }
        ]
      },
      analytics: {
        moduleCode: 'analytics',
        moduleName: 'Analytics & Business Intelligence',
        description: 'Financial dashboards, KPI monitoring, trend analysis, data visualization',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Analytics', description: 'View analytics and metrics' },
          { code: 'read_all', name: 'View All Analytics', description: 'View all analytics data' },
          { code: 'create', name: 'Create Analytics', description: 'Create custom analytics views' },
          { code: 'export', name: 'Export Analytics', description: 'Export analytics data' },
          { code: 'schedule', name: 'Schedule Analytics', description: 'Schedule automated analytics' },
          { code: 'customize_dashboards', name: 'Customize Dashboards', description: 'Customize analytics dashboards' }
        ]
      },
      budgeting: {
        moduleCode: 'budgeting',
        moduleName: 'Budgeting & Financial Planning',
        description: 'Budgets, forecasting, variance analysis, and capital budgeting',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Budgets', description: 'View budget information' },
          { code: 'read_all', name: 'View All Budgets', description: 'View all budgets in organization' },
          { code: 'create', name: 'Create Budgets', description: 'Create new budgets' },
          { code: 'update', name: 'Edit Budgets', description: 'Modify budget information' },
          { code: 'delete', name: 'Delete Budgets', description: 'Remove budgets' },
          { code: 'approve', name: 'Approve Budgets', description: 'Approve budgets' },
          { code: 'forecast', name: 'Create Forecasts', description: 'Create financial forecasts' },
          { code: 'export', name: 'Export Budgets', description: 'Export budget data' }
        ]
      },
      cost_accounting: {
        moduleCode: 'cost_accounting',
        moduleName: 'Cost Accounting',
        description: 'Cost centers, job costing, and activity-based costing',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Cost Accounting', description: 'View cost accounting data' },
          { code: 'read_all', name: 'View All Cost Data', description: 'View all cost data in organization' },
          { code: 'create', name: 'Create Cost Entries', description: 'Create new cost entries' },
          { code: 'update', name: 'Edit Cost Entries', description: 'Modify cost entries' },
          { code: 'delete', name: 'Delete Cost Entries', description: 'Remove cost entries' },
          { code: 'allocate', name: 'Allocate Costs', description: 'Allocate costs to centers and jobs' },
          { code: 'export', name: 'Export Cost Data', description: 'Export cost accounting data' }
        ]
      },
      fixed_assets: {
        moduleCode: 'fixed_assets',
        moduleName: 'Fixed Asset Management',
        description: 'Asset register, depreciation, disposal, transfers, and maintenance',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Fixed Assets', description: 'View asset information' },
          { code: 'read_all', name: 'View All Assets', description: 'View all assets in organization' },
          { code: 'create', name: 'Create Assets', description: 'Register new assets' },
          { code: 'update', name: 'Edit Assets', description: 'Modify asset information' },
          { code: 'delete', name: 'Delete Assets', description: 'Remove assets' },
          { code: 'depreciate', name: 'Run Depreciation', description: 'Process depreciation calculations' },
          { code: 'dispose', name: 'Dispose Assets', description: 'Record asset disposals' },
          { code: 'transfer', name: 'Transfer Assets', description: 'Transfer assets between locations' },
          { code: 'export', name: 'Export Assets', description: 'Export asset data' }
        ]
      },
      payroll: {
        moduleCode: 'payroll',
        moduleName: 'Payroll Management',
        description: 'Employee payroll processing, tax management, benefits, and reports',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Payroll', description: 'View payroll information' },
          { code: 'read_all', name: 'View All Payroll', description: 'View all payroll data' },
          { code: 'create', name: 'Create Payroll', description: 'Create payroll records' },
          { code: 'update', name: 'Edit Payroll', description: 'Modify payroll information' },
          { code: 'delete', name: 'Delete Payroll', description: 'Remove payroll records' },
          { code: 'run', name: 'Run Payroll', description: 'Process payroll calculations' },
          { code: 'approve', name: 'Approve Payroll', description: 'Approve payroll for processing' },
          { code: 'view_salary', name: 'View Salary Details', description: 'View employee salary information' },
          { code: 'export', name: 'Export Payroll', description: 'Export payroll data and reports' }
        ]
      },
      projects: {
        moduleCode: 'projects',
        moduleName: 'Project Accounting',
        description: 'Project costing, billing, time tracking, resource allocation, profitability',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Projects', description: 'View project information' },
          { code: 'read_all', name: 'View All Projects', description: 'View all projects in organization' },
          { code: 'create', name: 'Create Projects', description: 'Create new projects' },
          { code: 'update', name: 'Edit Projects', description: 'Modify project information' },
          { code: 'delete', name: 'Delete Projects', description: 'Remove projects' },
          { code: 'track_time', name: 'Track Time', description: 'Record time against projects' },
          { code: 'bill', name: 'Bill Projects', description: 'Generate project invoices' },
          { code: 'allocate_resources', name: 'Allocate Resources', description: 'Allocate resources to projects' },
          { code: 'export', name: 'Export Projects', description: 'Export project data' }
        ]
      },
      inventory: {
        moduleCode: 'inventory',
        moduleName: 'Inventory Management',
        description: 'Items, stock levels, locations, transactions, and stock alerts',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Inventory', description: 'View inventory information' },
          { code: 'read_all', name: 'View All Inventory', description: 'View all inventory items' },
          { code: 'create', name: 'Create Inventory Items', description: 'Add new inventory items' },
          { code: 'update', name: 'Edit Inventory', description: 'Modify inventory information' },
          { code: 'delete', name: 'Delete Inventory', description: 'Remove inventory items' },
          { code: 'adjust', name: 'Adjust Stock', description: 'Adjust stock quantities' },
          { code: 'movement', name: 'Track Movements', description: 'Record stock movements and transfers' },
          { code: 'count', name: 'Perform Stock Counts', description: 'Perform inventory counts' },
          { code: 'export', name: 'Export Inventory', description: 'Export inventory data' },
          { code: 'import', name: 'Import Inventory', description: 'Import inventory from files' }
        ]
      },
      multi_entity: {
        moduleCode: 'multi_entity',
        moduleName: 'Multi-Entity Management',
        description: 'Entity management, consolidation, inter-company transactions, currency management',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Entities', description: 'View entity information' },
          { code: 'read_all', name: 'View All Entities', description: 'View all entities in organization' },
          { code: 'create', name: 'Create Entities', description: 'Create new entities' },
          { code: 'update', name: 'Edit Entities', description: 'Modify entity information' },
          { code: 'delete', name: 'Delete Entities', description: 'Remove entities' },
          { code: 'consolidate', name: 'Consolidate', description: 'Perform financial consolidation' },
          { code: 'inter_company', name: 'Inter-Company Transactions', description: 'Manage inter-company transactions' },
          { code: 'manage_currency', name: 'Manage Currency', description: 'Manage multi-currency settings' },
          { code: 'export', name: 'Export Entity Data', description: 'Export multi-entity data' }
        ]
      },
      compliance: {
        moduleCode: 'compliance',
        moduleName: 'Compliance & Audit',
        description: 'Audit trail, internal controls, risk management, SOX, regulatory reports',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Compliance', description: 'View compliance information' },
          { code: 'read_all', name: 'View All Compliance', description: 'View all compliance data' },
          { code: 'create', name: 'Create Compliance Records', description: 'Create compliance records' },
          { code: 'update', name: 'Edit Compliance', description: 'Modify compliance records' },
          { code: 'delete', name: 'Delete Compliance Records', description: 'Remove compliance records' },
          { code: 'manage_controls', name: 'Manage Controls', description: 'Manage internal controls' },
          { code: 'manage_risks', name: 'Manage Risks', description: 'Manage risk assessments' },
          { code: 'audit_trail', name: 'View Audit Trail', description: 'Access audit trail logs' },
          { code: 'export', name: 'Export Compliance', description: 'Export compliance and audit data' }
        ]
      },
      workflows: {
        moduleCode: 'workflows',
        moduleName: 'Workflow Management',
        description: 'Approval workflows, templates, and automation',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Workflows', description: 'View workflow information' },
          { code: 'read_all', name: 'View All Workflows', description: 'View all workflows' },
          { code: 'create', name: 'Create Workflows', description: 'Create new workflow templates' },
          { code: 'update', name: 'Edit Workflows', description: 'Modify workflow definitions' },
          { code: 'delete', name: 'Delete Workflows', description: 'Remove workflows' },
          { code: 'approve', name: 'Approve in Workflows', description: 'Approve items in workflow queues' },
          { code: 'manage_templates', name: 'Manage Templates', description: 'Manage workflow templates' },
          { code: 'export', name: 'Export Workflows', description: 'Export workflow data' }
        ]
      },
      documents: {
        moduleCode: 'documents',
        moduleName: 'Document Management',
        description: 'Financial document storage and management',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Documents', description: 'View document information' },
          { code: 'read_all', name: 'View All Documents', description: 'View all documents' },
          { code: 'create', name: 'Upload Documents', description: 'Upload new documents' },
          { code: 'update', name: 'Edit Documents', description: 'Modify document metadata' },
          { code: 'delete', name: 'Delete Documents', description: 'Remove documents' },
          { code: 'download', name: 'Download Documents', description: 'Download document files' },
          { code: 'export', name: 'Export Documents', description: 'Export document data' }
        ]
      },
      integrations: {
        moduleCode: 'integrations',
        moduleName: 'Integrations',
        description: 'Third-party connections, API keys, webhooks, sync jobs',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Integrations', description: 'View integration information' },
          { code: 'read_all', name: 'View All Integrations', description: 'View all integrations and statuses' },
          { code: 'create', name: 'Create Integrations', description: 'Set up new integrations' },
          { code: 'update', name: 'Edit Integrations', description: 'Modify integration settings' },
          { code: 'delete', name: 'Delete Integrations', description: 'Remove integrations' },
          { code: 'manage_api_keys', name: 'Manage API Keys', description: 'Manage API keys' },
          { code: 'manage_webhooks', name: 'Manage Webhooks', description: 'Manage webhook endpoints' },
          { code: 'sync', name: 'Run Sync Jobs', description: 'Trigger data sync jobs' },
          { code: 'export', name: 'Export Integration Logs', description: 'Export integration logs' }
        ]
      },
      ai_insights: {
        moduleCode: 'ai_insights',
        moduleName: 'AI-Powered Insights',
        description: 'AI-powered financial insights, predictive analytics, anomaly detection',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View AI Insights', description: 'View AI-generated insights' },
          { code: 'read_all', name: 'View All Insights', description: 'View all AI insights' },
          { code: 'generate', name: 'Generate Insights', description: 'Generate new AI insights' },
          { code: 'export', name: 'Export Insights', description: 'Export insight data' },
          { code: 'configure', name: 'Configure AI', description: 'Configure AI models and parameters' }
        ]
      },
      security: {
        moduleCode: 'security',
        moduleName: 'Security Management',
        description: 'Encryption, MFA, SSO, threat intelligence, security policies',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Security', description: 'View security information and settings' },
          { code: 'configure', name: 'Configure Security', description: 'Configure security settings' },
          { code: 'manage_mfa', name: 'Manage MFA', description: 'Manage multi-factor authentication' },
          { code: 'manage_sso', name: 'Manage SSO', description: 'Manage single sign-on settings' },
          { code: 'manage_policies', name: 'Manage Policies', description: 'Manage security policies' },
          { code: 'view_threats', name: 'View Threats', description: 'View threat intelligence' },
          { code: 'manage_alerts', name: 'Manage Alerts', description: 'Manage security alerts' },
          { code: 'export', name: 'Export Security Data', description: 'Export security reports' }
        ]
      },
      performance: {
        moduleCode: 'performance',
        moduleName: 'Performance & Monitoring',
        description: 'System performance dashboards, cache management, job queues',
        isCore: false,
        permissions: [
          { code: 'read', name: 'View Performance', description: 'View performance metrics' },
          { code: 'read_all', name: 'View All Performance Data', description: 'View all performance dashboards and diagnostics' },
          { code: 'manage_cache', name: 'Manage Cache', description: 'Manage system cache' },
          { code: 'manage_jobs', name: 'Manage Jobs', description: 'Manage background job queues' },
          { code: 'configure_alerts', name: 'Configure Alerts', description: 'Configure performance alerts' },
          { code: 'export', name: 'Export Metrics', description: 'Export performance metrics' }
        ]
      },
      notifications: {
        moduleCode: 'notifications',
        moduleName: 'Notifications',
        description: 'System notifications and alerts',
        isCore: true,
        permissions: [
          { code: 'read', name: 'View Notifications', description: 'View notifications' },
          { code: 'update', name: 'Manage Notifications', description: 'Update notification settings' },
          { code: 'manage_preferences', name: 'Manage Preferences', description: 'Manage notification preferences' }
        ]
      },
      system: {
        moduleCode: 'system',
        moduleName: 'System Administration',
        description: 'User management, roles & permissions, company settings, audit logs, backups',
        isCore: true,
        permissions: [
          { code: 'settings_read', name: 'View Settings', description: 'View system settings' },
          { code: 'settings_update', name: 'Update Settings', description: 'Update system settings' },
          { code: 'users_read', name: 'View Users', description: 'View user information' },
          { code: 'users_read_all', name: 'View All Users', description: 'View all users in organization' },
          { code: 'users_create', name: 'Create Users', description: 'Create new user accounts' },
          { code: 'users_update', name: 'Edit Users', description: 'Modify user information' },
          { code: 'users_delete', name: 'Delete Users', description: 'Remove user accounts' },
          { code: 'users_activate', name: 'Activate Users', description: 'Activate/deactivate users' },
          { code: 'users_reset_password', name: 'Reset Passwords', description: 'Reset user passwords' },
          { code: 'users_export', name: 'Export Users', description: 'Export user data' },
          { code: 'users_import', name: 'Import Users', description: 'Import users from files' },
          { code: 'roles_read', name: 'View Roles', description: 'View role information' },
          { code: 'roles_read_all', name: 'View All Roles', description: 'View all roles' },
          { code: 'roles_create', name: 'Create Roles', description: 'Create new roles' },
          { code: 'roles_update', name: 'Edit Roles', description: 'Modify role permissions' },
          { code: 'roles_delete', name: 'Delete Roles', description: 'Remove roles' },
          { code: 'roles_assign', name: 'Assign Roles', description: 'Assign roles to users' },
          { code: 'roles_export', name: 'Export Roles', description: 'Export role data' },
          { code: 'audit_read', name: 'View Audit Logs', description: 'View audit log information' },
          { code: 'audit_read_all', name: 'View All Audit Logs', description: 'View all audit logs' },
          { code: 'audit_export', name: 'Export Audit Logs', description: 'Export audit log data' },
          { code: 'tenant_config_read', name: 'View Tenant Config', description: 'View tenant-specific configurations' },
          { code: 'tenant_config_update', name: 'Update Tenant Config', description: 'Update tenant configurations' },
          { code: 'credit_config_view', name: 'View Credit Config', description: 'View credit configuration settings' },
          { code: 'credit_config_edit', name: 'Edit Credit Config', description: 'Edit credit configuration settings' },
          { code: 'backup_create', name: 'Create Backups', description: 'Create system backups' },
          { code: 'backup_restore', name: 'Restore Backups', description: 'Restore system from backups' },
          { code: 'dropdowns_read', name: 'View Dropdowns', description: 'View dropdown values' },
          { code: 'dropdowns_manage', name: 'Manage Dropdowns', description: 'Create/update/delete dropdown values' },
          { code: 'fiscal_year_manage', name: 'Manage Fiscal Year', description: 'Manage fiscal year setup' },
          { code: 'sequences_manage', name: 'Manage Sequences', description: 'Manage number sequences' },
          { code: 'wrapper_sync', name: 'Wrapper Sync', description: 'Trigger and view Wrapper tenant sync' }
        ]
      }
    }
  },

};

// 🎯 **PLAN-BASED ACCESS CONTROL**
export const PLAN_ACCESS_MATRIX = {
  free: {
    applications: ['crm', 'accounting'],
    modules: {
      crm: ['leads', 'contacts', 'accounts', 'tasks', 'notes', 'activities', 'notifications'],
      accounting: ['dashboard', 'invoices', 'customers', 'bills', 'vendors', 'expense_reports', 'chart_of_accounts', 'reports']
    },
    permissions: {
      crm: {
        leads:         ['read', 'create', 'update', 'delete'],
        contacts:      ['read', 'create', 'update', 'delete'],
        accounts:      ['read', 'create', 'update', 'delete'],
        tasks:         ['read', 'create', 'update', 'delete'],
        notes:         ['read', 'create', 'update', 'delete'],
        activities:    ['read'],
        notifications: ['read', 'update'],
      },
      accounting: {
        dashboard: ['view'],
        invoices: ['read', 'create', 'update', 'delete'],
        customers: ['read', 'create', 'update', 'delete'],
        bills: ['read', 'create', 'update', 'delete'],
        vendors: ['read', 'create', 'update', 'delete'],
        expense_reports: ['read', 'create', 'update'],
        chart_of_accounts: ['read', 'create', 'update'],
        reports: ['read', 'export']
      }
    },
    credits: {
      free: 1000,        // Free tier gets 1000 initial credits (as per onboarding requirements)
      paid: 0,           // Can purchase additional credits
      expiryDays: 30     // Monthly renewal cycle
    }
  },


  starter: {
    applications: ['crm', 'hr', 'project_management', 'accounting'],
    modules: {
      crm: [
        // Core CRM
        'leads', 'contacts', 'accounts',
        // Pipeline & support
        'opportunities', 'tickets',
        // Activities
        'tasks', 'meetings', 'calls', 'communications', 'notes', 'activities',
        // Reference
        'documents', 'notifications', 'calendar',
      ],
      hr: ['employees', 'leave', 'dashboard'],
      project_management: ['projects', 'tasks', 'team', 'dashboard'],
      accounting: [
        'dashboard', 'invoices', 'customers', 'bills', 'vendors',
        'expense_reports', 'chart_of_accounts', 'reports',
        'notifications', 'system'
      ]
    },
    permissions: {
      crm: {
        leads:          ['read', 'create', 'update', 'delete'],
        contacts:       ['read', 'create', 'update', 'delete'],
        accounts:       ['read', 'create', 'update', 'delete'],
        opportunities:  ['read', 'create', 'update', 'delete'],
        tickets:        ['read', 'create', 'update', 'delete'],
        tasks:          ['read', 'create', 'update', 'delete'],
        meetings:       ['read', 'create', 'update', 'delete'],
        calls:          ['read', 'create', 'update', 'delete'],
        communications: ['read', 'create'],              // write-all unlocked at Professional
        documents:      ['read', 'create', 'delete'],
        notes:          ['read', 'create', 'update', 'delete'],
        activities:     ['read'],
        notifications:  ['read', 'update'],
        calendar:       ['read'],
      },
      hr: {
        employees: ['read', 'create', 'update', 'delete'],
        leave: ['read', 'create', 'update', 'approve'],
        dashboard: ['read']
      },
      project_management: {
        projects: ['read', 'create', 'update', 'delete', 'export', 'assign'],
        tasks: ['read', 'read_all', 'create', 'update', 'delete', 'export', 'assign', 'change_status'],
        team: ['read', 'read_all', 'create', 'update', 'delete', 'export'],
        dashboard: ['view']
      },
      accounting: {
        dashboard: ['view'],
        invoices: ['read', 'read_all', 'create', 'update', 'delete', 'send', 'export'],
        customers: ['read', 'read_all', 'create', 'update', 'delete', 'export'],
        bills: ['read', 'read_all', 'create', 'update', 'delete', 'pay', 'export'],
        vendors: ['read', 'read_all', 'create', 'update', 'delete', 'export'],
        expense_reports: ['read', 'create', 'update', 'approve'],
        chart_of_accounts: ['read', 'create', 'update', 'export'],
        reports: ['read', 'export'],
        notifications: ['read', 'update'],
        system: ['settings_read', 'users_read', 'roles_read']
      }
    },
    credits: {
      free: 60000,       // Annual free credits (matches Stripe config)
      paid: 0,           // Additional paid credits can be purchased
      expiryDays: 365    // Annual renewal cycle
    }
  },

  professional: {
    applications: ['crm', 'hr', 'project_management', 'accounting'],
    modules: {
      crm: [
        // All Starter modules
        'leads', 'contacts', 'accounts', 'opportunities', 'tickets',
        'tasks', 'meetings', 'calls', 'communications', 'notes', 'activities',
        'documents', 'notifications', 'calendar',
        // Professional additions — commercial pipeline
        'events', 'quotations', 'invoices', 'sales-orders', 'products',
        // Professional additions — data & outreach ops
        'bulk_upload', 'webforms', 'email_templates',
      ],
      hr: ['employees', 'payroll', 'leave', 'dashboard'],
      project_management: ['projects', 'tasks', 'sprints', 'time_tracking', 'team', 'backlog', 'documents', 'analytics', 'reports', 'chat', 'calendar', 'kanban', 'dashboard', 'notifications', 'workspace'],
      accounting: [
        // Starter modules
        'dashboard', 'invoices', 'customers', 'bills', 'vendors',
        'expense_reports', 'chart_of_accounts', 'reports',
        'notifications', 'system',
        // Professional additions
        'general_ledger', 'journal_entries', 'credit_notes',
        'estimates', 'sales_orders', 'purchase_orders',
        'banking', 'tax', 'vendor_credits', 'documents'
      ]
    },
    permissions: {
      crm: {
        // Core — same as Starter
        leads:              ['read', 'create', 'update', 'delete'],
        contacts:           ['read', 'create', 'update', 'delete'],
        accounts:           ['read', 'create', 'update', 'delete'],
        opportunities:      ['read', 'create', 'update', 'delete'],
        tickets:            ['read', 'create', 'update', 'delete'],
        tasks:              ['read', 'create', 'update', 'delete'],
        meetings:           ['read', 'create', 'update', 'delete'],
        calls:              ['read', 'create', 'update', 'delete'],
        notes:              ['read', 'create', 'update', 'delete'],
        activities:         ['read'],
        documents:          ['read', 'create', 'delete'],
        notifications:      ['read', 'update'],
        calendar:           ['read'],
        // Upgraded at Professional
        communications:     ['read', 'create', 'update', 'delete'],  // full CRUD (Starter: read/create only)
        // Commercial pipeline — Professional additions
        events:             ['read', 'create', 'update', 'delete'],
        quotations:         ['read', 'create', 'update', 'delete'],
        invoices:           ['read', 'create', 'update', 'delete'],
        'sales-orders':     ['read', 'create', 'update', 'delete'],
        products:           ['read', 'create', 'update', 'delete'],
        // Data & outreach ops — Professional additions
        bulk_upload:        ['read', 'create', 'delete'],
        webforms:           ['read', 'create', 'update', 'delete'],
        email_templates:    ['read', 'create', 'update', 'delete'],
        // Basic system access
        // NOTE: reports_* codes are intentionally absent — the CRM reports module is gated by
        // requireRole(admin) not requirePermission, so these codes have no effect in the CRM.
        // Reports access in the CRM is admin-role-only regardless of plan tier.
        system:             ['settings_read', 'users_read', 'users_read_all', 'users_create', 'users_update', 'users_activate', 'roles_read', 'roles_read_all', 'roles_create', 'roles_update', 'roles_assign', 'audit_read', 'activity_logs_read'],
      },
      hr: {
        employees: ['read', 'read_all', 'create', 'update', 'delete', 'manage_roles'],
        payroll: ['read', 'create', 'update', 'process'],
        leave: ['read', 'read_all', 'create', 'update', 'approve', 'reject'],
        dashboard: ['read']
      },
      project_management: {
        projects: ['read', 'read_all', 'create', 'update', 'delete', 'export', 'import', 'assign', 'archive', 'restore', 'manage_budget', 'manage_timeline', 'manage_settings'],
        tasks: ['read', 'read_all', 'create', 'update', 'delete', 'export', 'import', 'assign', 'reassign', 'change_status', 'change_priority', 'add_subtasks', 'manage_dependencies', 'add_attachments', 'add_comments', 'time_track'],
        sprints: ['read', 'read_all', 'create', 'update', 'delete', 'export', 'start', 'complete', 'cancel', 'manage_capacity', 'assign_tasks', 'view_burndown'],
        time_tracking: ['read', 'read_all', 'create', 'update', 'delete', 'export', 'import', 'approve', 'reject', 'view_reports', 'manage_billable'],
        team: ['read', 'read_all', 'create', 'update', 'delete', 'export', 'import', 'assign_roles', 'manage_permissions', 'view_performance', 'manage_availability'],
        backlog: ['read', 'read_all', 'create', 'update', 'delete', 'export', 'import', 'prioritize', 'estimate', 'move_to_sprint', 'manage_epics'],
        documents: ['read', 'read_all', 'create', 'update', 'delete', 'export', 'download', 'share', 'version_control', 'add_comments', 'approve', 'manage_permissions'],
        analytics: ['read', 'read_all', 'create', 'update', 'delete', 'export', 'schedule', 'view_dashboards', 'customize_dashboards', 'view_project_health', 'view_team_performance', 'view_burndown', 'view_velocity'],
        reports: ['read', 'read_all', 'create', 'update', 'delete', 'export', 'schedule', 'share', 'generate_pdf', 'customize'],
        chat: ['read', 'read_all', 'create', 'update', 'delete', 'create_channels', 'manage_channels', 'delete_channels', 'mention_users', 'share_files', 'pin_messages'],
        calendar: ['read', 'read_all', 'create', 'update', 'delete', 'export', 'import', 'share', 'manage_recurring'],
        kanban: ['read', 'read_all', 'create', 'update', 'delete', 'move_cards', 'manage_columns', 'manage_filters', 'export'],
        dashboard: ['view', 'customize', 'export', 'share', 'create_widgets', 'manage_widgets'],
        notifications: ['read', 'read_all', 'create', 'update', 'delete', 'manage_preferences', 'mark_read', 'bulk_actions'],
        workspace: ['read', 'read_all', 'create', 'update', 'delete', 'manage_members', 'manage_roles', 'manage_settings', 'export', 'archive', 'restore']
      },
      accounting: {
        // Starter modules (expanded permissions)
        dashboard: ['view', 'customize', 'export'],
        invoices: ['read', 'read_all', 'create', 'update', 'delete', 'send', 'post', 'export', 'import', 'generate_pdf'],
        customers: ['read', 'read_all', 'create', 'update', 'delete', 'export', 'import'],
        bills: ['read', 'read_all', 'create', 'update', 'delete', 'pay', 'approve', 'export'],
        vendors: ['read', 'read_all', 'create', 'update', 'delete', 'export', 'import'],
        expense_reports: ['read', 'read_all', 'create', 'update', 'delete', 'approve', 'reimburse', 'export'],
        chart_of_accounts: ['read', 'create', 'update', 'delete', 'import', 'export'],
        reports: ['read', 'read_all', 'create', 'export', 'schedule', 'generate_pdf'],
        // Professional additions
        general_ledger: ['read', 'create', 'update', 'delete', 'post', 'approve', 'close_period', 'export'],
        journal_entries: ['read', 'create', 'update', 'delete', 'post', 'approve', 'reverse', 'export'],
        credit_notes: ['read', 'create', 'update', 'delete', 'apply', 'export'],
        estimates: ['read', 'create', 'update', 'delete', 'send', 'convert', 'export', 'generate_pdf'],
        sales_orders: ['read', 'read_all', 'create', 'update', 'delete', 'approve', 'convert', 'export'],
        purchase_orders: ['read', 'read_all', 'create', 'update', 'delete', 'approve', 'receive', 'export'],
        banking: ['read', 'read_all', 'create', 'update', 'delete', 'reconcile', 'import_feeds', 'transfer', 'export'],
        tax: ['read', 'create', 'update', 'delete', 'configure', 'file_returns', 'reconcile', 'export'],
        vendor_credits: ['read', 'create', 'update', 'delete', 'apply', 'export'],
        documents: ['read', 'read_all', 'create', 'update', 'delete', 'download', 'export'],
        notifications: ['read', 'update', 'manage_preferences'],
        system: [
          'settings_read', 'settings_update',
          'users_read', 'users_read_all', 'users_create', 'users_update', 'users_delete', 'users_activate', 'users_export',
          'roles_read', 'roles_read_all', 'roles_create', 'roles_update', 'roles_delete', 'roles_assign', 'roles_export',
          'audit_read', 'audit_read_all', 'audit_export',
          'tenant_config_read', 'tenant_config_update',
          'credit_config_view', 'credit_config_edit',
          'dropdowns_read', 'dropdowns_manage',
          'fiscal_year_manage', 'sequences_manage'
        ]
      }
    },
    credits: {
      free: 300000,      // Annual free credits (matches Stripe config)
      paid: 0,           // Additional paid credits can be purchased
      expiryDays: 365    // Annual renewal cycle
    }
  },


  enterprise: {
    applications: ['crm', 'hr', 'affiliateConnect', 'project_management', 'operations', 'accounting'],
    modules: {
      crm: [
        // All Professional modules
        'leads', 'contacts', 'accounts', 'opportunities', 'tickets',
        'tasks', 'meetings', 'calls', 'communications', 'notes', 'activities',
        'documents', 'notifications', 'calendar',
        'events', 'quotations', 'invoices', 'sales-orders', 'products',
        'bulk_upload', 'webforms', 'email_templates',
        // Enterprise additions — advanced automation & customisation
        'inventory',
        'cadences', 'marketing_campaigns',
        'approval_processes',
        'custom_fields', 'layouts',
        'custom_buttons', 'custom_functions',
        'webhooks',
      ],
      hr: ['employees', 'payroll', 'leave', 'dashboard'],
      affiliateConnect: ['dashboard', 'products', 'affiliates', 'tracking', 'commissions', 'campaigns', 'influencers', 'payments', 'analytics', 'fraud', 'communications', 'integrations', 'settings', 'support'],
      project_management: ['projects', 'tasks', 'sprints', 'time_tracking', 'team', 'backlog', 'documents', 'analytics', 'reports', 'chat', 'calendar', 'kanban', 'dashboard', 'notifications', 'workspace', 'workflow', 'system'],
      operations: ['dashboard', 'inventory', 'warehouse', 'procurement', 'suppliers', 'transportation', 'orders', 'fulfillments', 'shipments', 'catalog', 'quality', 'rfx', 'finance', 'tax_compliance', 'supply_chain', 'analytics', 'contracts', 'service_appointments', 'notifications', 'system', 'marketing', 'customers', 'returns', 'customer_portal', 'vendor_management', 'service_providers'],
      accounting: [
        'dashboard', 'general_ledger', 'chart_of_accounts', 'journal_entries',
        'invoices', 'customers', 'credit_notes', 'sales_orders', 'estimates', 'recurring_invoices',
        'bills', 'vendors', 'purchase_orders', 'expense_reports', 'vendor_credits',
        'banking', 'tax', 'reports', 'analytics', 'budgeting', 'cost_accounting',
        'fixed_assets', 'payroll', 'projects', 'inventory', 'multi_entity',
        'compliance', 'workflows', 'documents', 'integrations',
        'ai_insights', 'security', 'performance', 'notifications', 'system'
      ]
    },
    permissions: {
      crm: {
        // All Professional permissions
        leads:              ['read', 'create', 'update', 'delete'],
        contacts:           ['read', 'create', 'update', 'delete'],
        accounts:           ['read', 'create', 'update', 'delete'],
        opportunities:      ['read', 'create', 'update', 'delete'],
        tickets:            ['read', 'create', 'update', 'delete'],
        tasks:              ['read', 'create', 'update', 'delete'],
        meetings:           ['read', 'create', 'update', 'delete'],
        calls:              ['read', 'create', 'update', 'delete'],
        events:             ['read', 'create', 'update', 'delete'],
        communications:     ['read', 'create', 'update', 'delete'],
        quotations:         ['read', 'create', 'update', 'delete'],
        invoices:           ['read', 'create', 'update', 'delete'],
        'sales-orders':     ['read', 'create', 'update', 'delete'],
        products:           ['read', 'create', 'update', 'delete'],
        documents:          ['read', 'create', 'delete'],
        notes:              ['read', 'create', 'update', 'delete'],
        activities:         ['read'],
        notifications:      ['read', 'update'],
        calendar:           ['read'],
        bulk_upload:        ['read', 'create', 'delete'],
        webforms:           ['read', 'create', 'update', 'delete'],
        email_templates:    ['read', 'create', 'update', 'delete'],
        // Enterprise additions
        inventory:          ['read', 'create', 'update', 'delete'],
        cadences:           ['read', 'create', 'update', 'delete'],
        marketing_campaigns: ['read', 'create', 'update', 'delete'],
        approval_processes: ['read', 'create', 'update', 'delete', 'approve'],
        custom_fields:      ['read', 'manage'],
        layouts:            ['read', 'manage'],
        custom_buttons:     ['read', 'manage', 'execute'],
        custom_functions:   ['read', 'manage', 'execute'],
        webhooks:           ['read', 'create', 'update', 'delete'],
        // Full system access
        system: [
          'settings_read', 'settings_update',
          'configurations_read', 'configurations_create', 'configurations_update', 'configurations_delete',
          'users_read', 'users_read_all', 'users_create', 'users_update', 'users_delete', 'users_activate',
          'roles_read', 'roles_read_all', 'roles_create', 'roles_update', 'roles_delete', 'roles_assign',
          'audit_read', 'audit_read_all', 'audit_export', 'audit_view_details', 'audit_filter',
          'activity_logs_read', 'activity_logs_read_all', 'activity_logs_export',
          'reports_read', 'reports_read_all', 'reports_create', 'reports_update', 'reports_delete', 'reports_export', 'reports_schedule',
          'dropdowns_read', 'dropdowns_create', 'dropdowns_update', 'dropdowns_delete',
          'integrations_read', 'integrations_create', 'integrations_update', 'integrations_delete',
        ],
      },
      hr: {
        employees: ['read', 'read_all', 'create', 'update', 'delete', 'view_salary', 'export'],
        payroll: ['read', 'process', 'approve', 'export', 'generate_reports'],
        leave: ['read', 'create', 'approve', 'reject', 'cancel', 'export'],
        dashboard: ['view', 'customize', 'export']
      },
      affiliateConnect: {
        dashboard: ['view_dashboard', 'view_analytics', 'view_reports', 'export_data', 'view_all_tenants', 'view_tenant_analytics', 'view_affiliate_analytics', 'view_influencer_analytics'],
        products: ['read', 'read_all', 'create', 'update', 'delete', 'update_commission', 'upload_images', 'export', 'import', 'manage_categories'],
        affiliates: ['read', 'read_all', 'create', 'update', 'delete', 'invite', 'approve', 'reject', 'assign_tier', 'view_pending', 'view_details', 'update_details', 'view_commissions', 'update_commissions'],
        tracking: ['read', 'read_all', 'create', 'update', 'delete', 'track_clicks', 'track_conversions', 'view_analytics', 'export_analytics', 'manage_utm'],
        commissions: ['read_tiers', 'create_tiers', 'update_tiers', 'delete_tiers', 'read_rules', 'create_rules', 'update_rules', 'delete_rules', 'view_products', 'update_products', 'calculate_commissions', 'view_affiliate_commissions'],
        campaigns: ['read', 'read_all', 'create', 'update', 'delete', 'join_campaign', 'view_participants', 'manage_participants', 'view_progress', 'submit_content', 'approve_content', 'view_contract', 'accept_contract', 'manage_versions', 'view_analytics'],
        influencers: ['read', 'read_all', 'create', 'update', 'delete', 'connect_instagram', 'connect_youtube', 'connect_twitter', 'view_analytics', 'view_media_kit', 'update_media_kit', 'view_ratings', 'manage_ratings'],
        payments: ['read_payouts', 'create_payouts', 'update_payouts', 'view_methods', 'add_methods', 'update_methods', 'delete_methods', 'view_history', 'process_payments', 'view_affiliate_payments'],
        analytics: ['view_dashboard', 'view_campaign_analytics', 'view_affiliate_analytics', 'view_revenue_analytics', 'create_reports', 'view_reports', 'export_analytics', 'view_all_tenants', 'view_tenant_analytics'],
        fraud: ['read_rules', 'create_rules', 'update_rules', 'delete_rules', 'view_alerts', 'update_alerts', 'view_monitoring', 'manage_detection'],
        communications: ['read_templates', 'create_templates', 'update_templates', 'delete_templates', 'send_notifications', 'view_notifications', 'update_notification_status', 'manage_messaging'],
        integrations: ['read_api_keys', 'create_api_keys', 'update_api_keys', 'delete_api_keys', 'read_webhooks', 'create_webhooks', 'update_webhooks', 'delete_webhooks', 'manage_integrations'],
        settings: ['read_tenant_settings', 'update_tenant_settings', 'read_users', 'create_users', 'update_users', 'delete_users', 'read_roles', 'create_roles', 'update_roles', 'delete_roles', 'manage_permissions'],
        support: ['read_tickets', 'create_tickets', 'update_tickets', 'view_knowledge_base', 'search_knowledge_base', 'manage_tickets', 'view_all_tickets']
      },
      project_management: {
        projects: ['read', 'read_all', 'create', 'update', 'delete', 'export', 'import', 'assign', 'archive', 'restore', 'manage_budget', 'manage_timeline', 'manage_settings'],
        tasks: ['read', 'read_all', 'create', 'update', 'delete', 'export', 'import', 'assign', 'reassign', 'change_status', 'change_priority', 'add_subtasks', 'manage_dependencies', 'add_attachments', 'add_comments', 'time_track'],
        sprints: ['read', 'read_all', 'create', 'update', 'delete', 'export', 'start', 'complete', 'cancel', 'manage_capacity', 'assign_tasks', 'view_burndown'],
        time_tracking: ['read', 'read_all', 'create', 'update', 'delete', 'export', 'import', 'approve', 'reject', 'view_reports', 'manage_billable', 'bulk_approve'],
        team: ['read', 'read_all', 'create', 'update', 'delete', 'export', 'import', 'assign_roles', 'manage_permissions', 'view_performance', 'manage_availability'],
        backlog: ['read', 'read_all', 'create', 'update', 'delete', 'export', 'import', 'prioritize', 'estimate', 'move_to_sprint', 'manage_epics'],
        documents: ['read', 'read_all', 'create', 'update', 'delete', 'export', 'download', 'share', 'version_control', 'add_comments', 'approve', 'manage_permissions'],
        analytics: ['read', 'read_all', 'create', 'update', 'delete', 'export', 'schedule', 'view_dashboards', 'customize_dashboards', 'view_project_health', 'view_team_performance', 'view_burndown', 'view_velocity'],
        reports: ['read', 'read_all', 'create', 'update', 'delete', 'export', 'schedule', 'share', 'generate_pdf', 'customize'],
        chat: ['read', 'read_all', 'create', 'update', 'delete', 'create_channels', 'manage_channels', 'delete_channels', 'mention_users', 'share_files', 'pin_messages'],
        calendar: ['read', 'read_all', 'create', 'update', 'delete', 'export', 'import', 'share', 'manage_recurring'],
        kanban: ['read', 'read_all', 'create', 'update', 'delete', 'move_cards', 'manage_columns', 'manage_filters', 'export'],
        dashboard: ['view', 'customize', 'export', 'share', 'create_widgets', 'manage_widgets'],
        notifications: ['read', 'read_all', 'create', 'update', 'delete', 'manage_preferences', 'mark_read', 'bulk_actions'],
        workspace: ['read', 'read_all', 'create', 'update', 'delete', 'manage_members', 'manage_roles', 'manage_settings', 'export', 'archive', 'restore'],
        workflow: ['read', 'read_all', 'create', 'update', 'delete', 'activate', 'deactivate', 'view_executions', 'manage_rules', 'manage_actions', 'export', 'import'],
        system: ['settings_read', 'settings_update', 'users_read', 'users_read_all', 'users_create', 'users_update', 'users_delete', 'users_activate', 'users_reset_password', 'users_export', 'users_import', 'roles_read', 'roles_read_all', 'roles_create', 'roles_update', 'roles_delete', 'roles_assign', 'roles_export', 'integrations_read', 'integrations_create', 'integrations_update', 'integrations_delete', 'audit_read', 'audit_read_all', 'audit_export', 'audit_view_details', 'audit_filter', 'audit_generate_reports', 'audit_archive', 'audit_purge', 'activity_logs_read', 'activity_logs_read_all', 'activity_logs_export', 'activity_logs_view_details', 'activity_logs_filter', 'activity_logs_generate_reports', 'activity_logs_archive', 'activity_logs_purge']
      },
      operations: {
        dashboard: ['view', 'customize', 'export'],
        inventory: ['read', 'read_all', 'create', 'update', 'delete', 'export', 'import', 'adjust', 'movement'],
        warehouse: ['read', 'read_all', 'create', 'update', 'delete', 'cycle_count', 'pick_path'],
        procurement: ['read', 'read_all', 'create', 'update', 'delete', 'approve', 'export'],
        suppliers: ['read', 'read_all', 'create', 'update', 'delete', 'view_performance', 'view_risk', 'export'],
        transportation: ['read', 'read_all', 'create', 'update', 'delete', 'export'],
        orders: ['read', 'read_all', 'create', 'update', 'delete', 'process', 'export'],
        fulfillments: ['read', 'read_all', 'create', 'update', 'delete', 'export'],
        shipments: ['read', 'read_all', 'create', 'update', 'delete', 'track', 'export'],
        catalog: ['read', 'read_all', 'create', 'update', 'delete', 'export'],
        quality: ['read', 'read_all', 'create', 'update', 'delete', 'export'],
        rfx: ['read', 'read_all', 'create', 'update', 'delete', 'submit_response', 'evaluate', 'export'],
        finance: ['read', 'read_all', 'create', 'update', 'delete', 'export'],
        tax_compliance: ['read', 'read_all', 'create', 'update', 'export'],
        supply_chain: ['read', 'read_all', 'create', 'update', 'export'],
        analytics: ['read', 'read_all', 'create', 'export', 'schedule'],
        contracts: ['read', 'read_all', 'create', 'update', 'delete', 'export'],
        service_appointments: ['read', 'read_all', 'create', 'update', 'delete', 'export'],
        notifications: ['read', 'read_all', 'create', 'update', 'manage_preferences'],
        system: ['settings_read', 'settings_update', 'users_read', 'users_read_all', 'users_create', 'users_update', 'users_delete', 'roles_read', 'roles_read_all', 'roles_create', 'roles_update', 'roles_delete', 'wrapper_sync'],
        marketing: ['read', 'read_all', 'create', 'update', 'delete', 'export'],
        customers: ['read', 'read_all', 'create', 'update', 'delete', 'export'],
        returns: ['read', 'read_all', 'create', 'update', 'delete', 'approve', 'export'],
        customer_portal: ['read', 'read_all', 'manage_shop', 'manage_services', 'manage_orders', 'manage_bookings', 'manage_payments', 'manage_wishlist', 'manage_preferences', 'export'],
        vendor_management: ['read', 'read_all', 'create', 'update', 'delete', 'manage_products', 'manage_ratings', 'manage_policies', 'manage_communication', 'view_analytics', 'manage_certifications', 'manage_portfolios', 'export'],
        service_providers: ['read', 'read_all', 'create', 'update', 'delete', 'manage_catalog', 'manage_pricing', 'manage_promotions', 'view_analytics', 'export']
      },
      accounting: {
        dashboard: ['view', 'customize', 'export'],
        general_ledger: ['read', 'create', 'update', 'delete', 'post', 'approve', 'close_period', 'export'],
        chart_of_accounts: ['read', 'create', 'update', 'delete', 'import', 'export'],
        journal_entries: ['read', 'create', 'update', 'delete', 'post', 'approve', 'reverse', 'export'],
        invoices: ['read', 'read_all', 'create', 'update', 'delete', 'send', 'post', 'export', 'import', 'generate_pdf'],
        customers: ['read', 'read_all', 'create', 'update', 'delete', 'export', 'import'],
        credit_notes: ['read', 'create', 'update', 'delete', 'apply', 'export'],
        sales_orders: ['read', 'read_all', 'create', 'update', 'delete', 'approve', 'convert', 'export'],
        estimates: ['read', 'create', 'update', 'delete', 'send', 'convert', 'export', 'generate_pdf'],
        recurring_invoices: ['read', 'read_all', 'create', 'update', 'delete', 'send', 'post', 'export'],
        bills: ['read', 'read_all', 'create', 'update', 'delete', 'pay', 'approve', 'export'],
        vendors: ['read', 'read_all', 'create', 'update', 'delete', 'export', 'import'],
        purchase_orders: ['read', 'read_all', 'create', 'update', 'delete', 'approve', 'receive', 'export'],
        expense_reports: ['read', 'read_all', 'create', 'update', 'delete', 'approve', 'reimburse', 'export'],
        vendor_credits: ['read', 'create', 'update', 'delete', 'apply', 'export'],
        banking: ['read', 'read_all', 'create', 'update', 'delete', 'reconcile', 'import_feeds', 'transfer', 'export'],
        tax: ['read', 'create', 'update', 'delete', 'configure', 'file_returns', 'reconcile', 'export'],
        reports: ['read', 'read_all', 'create', 'export', 'schedule', 'generate_pdf'],
        analytics: ['read', 'read_all', 'create', 'export', 'schedule', 'customize_dashboards'],
        budgeting: ['read', 'read_all', 'create', 'update', 'delete', 'approve', 'forecast', 'export'],
        cost_accounting: ['read', 'read_all', 'create', 'update', 'delete', 'allocate', 'export'],
        fixed_assets: ['read', 'read_all', 'create', 'update', 'delete', 'depreciate', 'dispose', 'transfer', 'export'],
        payroll: ['read', 'read_all', 'create', 'update', 'delete', 'run', 'approve', 'view_salary', 'export'],
        projects: ['read', 'read_all', 'create', 'update', 'delete', 'track_time', 'bill', 'allocate_resources', 'export'],
        inventory: ['read', 'read_all', 'create', 'update', 'delete', 'adjust', 'movement', 'count', 'export', 'import'],
        multi_entity: ['read', 'read_all', 'create', 'update', 'delete', 'consolidate', 'inter_company', 'manage_currency', 'export'],
        compliance: ['read', 'read_all', 'create', 'update', 'delete', 'manage_controls', 'manage_risks', 'audit_trail', 'export'],
        workflows: ['read', 'read_all', 'create', 'update', 'delete', 'approve', 'manage_templates', 'export'],
        documents: ['read', 'read_all', 'create', 'update', 'delete', 'download', 'export'],
        integrations: ['read', 'create', 'update', 'delete', 'manage_api_keys', 'manage_webhooks', 'sync', 'export'],
        ai_insights: ['read', 'read_all', 'generate', 'export', 'configure'],
        security: ['read', 'configure', 'manage_mfa', 'manage_sso', 'manage_policies', 'view_threats', 'manage_alerts', 'export'],
        performance: ['read', 'manage_cache', 'manage_jobs', 'configure_alerts', 'export'],
        notifications: ['read', 'update', 'manage_preferences'],
        system: [
          'settings_read', 'settings_update',
          'users_read', 'users_read_all', 'users_create', 'users_update', 'users_delete', 'users_activate', 'users_reset_password', 'users_export', 'users_import',
          'roles_read', 'roles_read_all', 'roles_create', 'roles_update', 'roles_delete', 'roles_assign', 'roles_export',
          'audit_read', 'audit_read_all', 'audit_export',
          'tenant_config_read', 'tenant_config_update',
          'credit_config_view', 'credit_config_edit',
          'backup_create', 'backup_restore',
          'dropdowns_read', 'dropdowns_manage',
          'fiscal_year_manage', 'sequences_manage',
          'wrapper_sync'
        ]
      }
    },
    credits: {
      free: 1200000,     // Annual free credits (100000/month × 12)
      paid: 0,           // Additional paid credits can be purchased
      expiryDays: 365    // Annual renewal cycle
    }
  }
};

type AppCodeKey = keyof typeof BUSINESS_SUITE_MATRIX;
type PlanIdKey = keyof typeof PLAN_ACCESS_MATRIX;

// 🛠️ **UTILITY FUNCTIONS**
export class PermissionMatrixUtils {
  
  // Get all applications from matrix
  static getAllApplications() {
    return (Object.keys(BUSINESS_SUITE_MATRIX) as AppCodeKey[]).map(appCode => ({
      ...BUSINESS_SUITE_MATRIX[appCode].appInfo,
      appCode
    }));
  }
  
  // Get all modules for an application
  static getApplicationModules(appCode: string) {
    const app = BUSINESS_SUITE_MATRIX[appCode as AppCodeKey];
    if (!app) return [];

    type ModEntry = { moduleCode: string; moduleName: string; permissions: { code: string; name: string; description: string }[] };
    const mods = app.modules as Record<string, ModEntry>;
    return Object.keys(mods).map(moduleCode => ({
      ...mods[moduleCode],
      appCode,
      moduleCode
    }));
  }
  
  // Get all permissions for a module
  static getModulePermissions(appCode: string, moduleCode: string) {
    const app = BUSINESS_SUITE_MATRIX[appCode as AppCodeKey];
    type ModEntry = { moduleCode: string; moduleName: string; permissions: { code: string; name: string; description: string }[] };
    const module = app ? (app.modules as Record<string, ModEntry>)[moduleCode] : undefined;
    if (!module) return [];

    return module.permissions.map((permission: { code: string; name: string; description: string }) => ({
      ...permission,
      fullCode: `${appCode}.${moduleCode}.${permission.code}`,
      appCode,
      moduleCode
    }));
  }
  
  // Get permissions for a plan
  static getPlanPermissions(planId: string) {
    const planAccess = PLAN_ACCESS_MATRIX[planId as PlanIdKey];
    if (!planAccess) return [];

    const permissions: Array<{ code: string; name: string; description: string; fullCode: string; appCode: string; moduleCode: string }> = [];

    planAccess.applications.forEach((appCode: string) => {
      const appPermissions = (planAccess.permissions as Record<string, unknown>)[appCode];

      if (appPermissions === '*') {
        // All permissions for all modules in this app
        const allModules = this.getApplicationModules(appCode);
        allModules.forEach(module => {
          const modulePermissions = this.getModulePermissions(appCode, module.moduleCode);
          permissions.push(...modulePermissions);
        });
      } else if (typeof appPermissions === 'object' && appPermissions !== null) {
        // Specific permissions per module
        Object.keys(appPermissions as Record<string, unknown>).forEach(moduleCode => {
          const modulePermCodes = (appPermissions as Record<string, string[] | string>)[moduleCode];

          if (modulePermCodes === '*') {
            // All permissions for this module
            const modulePermissions = this.getModulePermissions(appCode, moduleCode);
            permissions.push(...modulePermissions);
          } else if (Array.isArray(modulePermCodes)) {
            // Specific permissions for this module
            modulePermCodes.forEach((permCode: string) => {
              permissions.push({
                code: permCode,
                name: this.getPermissionName(appCode, moduleCode, permCode),
                description: this.getPermissionDescription(appCode, moduleCode, permCode),
                fullCode: `${appCode}.${moduleCode}.${permCode}`,
                appCode,
                moduleCode
              });
            });
          }
        });
      }
    });

    return permissions;
  }

  // Helper method to get permission name from BUSINESS_SUITE_MATRIX
  static getPermissionName(appCode: string, moduleCode: string, permCode: string): string {
    const app = BUSINESS_SUITE_MATRIX[appCode as AppCodeKey];
    type ModEntry = { permissions: { code: string; name: string; description: string }[] };
    const module = app ? (app.modules as Record<string, ModEntry>)[moduleCode] : undefined;
    if (!module) return permCode;

    const permission = module.permissions?.find((p: { code: string }) => p.code === permCode);
    return permission?.name || permCode;
  }

  // Helper method to get permission description from BUSINESS_SUITE_MATRIX
  static getPermissionDescription(appCode: string, moduleCode: string, permCode: string): string {
    const app = BUSINESS_SUITE_MATRIX[appCode as AppCodeKey];
    type ModEntry = { permissions: { code: string; name: string; description: string }[] };
    const module = app ? (app.modules as Record<string, ModEntry>)[moduleCode] : undefined;
    if (!module) return '';

    const permission = module.permissions?.find((p: { code: string }) => p.code === permCode);
    return permission?.description || '';
  }

  // Get credits configuration for a plan
  static getPlanCredits(planId: string) {
    const planAccess = PLAN_ACCESS_MATRIX[planId as PlanIdKey];
    return planAccess?.credits || { free: 0, paid: 0, expiryDays: 30 };
  }
  
  // Validate permission matrix
  static validateMatrix(): string[] {
    const errors: string[] = [];

    (Object.keys(BUSINESS_SUITE_MATRIX) as AppCodeKey[]).forEach(appCode => {
      const app = BUSINESS_SUITE_MATRIX[appCode];
      
      // Validate app info
      if (!app.appInfo || !app.appInfo.appName) {
        errors.push(`App ${appCode} missing appInfo.appName`);
      }
      
      // Validate modules
      if (!app.modules || Object.keys(app.modules).length === 0) {
        errors.push(`App ${appCode} has no modules defined`);
      } else {
        type ModEntry = { permissions: { code?: string; name?: string }[] };
        const mods = app.modules as Record<string, ModEntry>;
        Object.keys(mods).forEach(moduleCode => {
          const module = mods[moduleCode];

          if (!module.permissions || module.permissions.length === 0) {
            errors.push(`Module ${appCode}.${moduleCode} has no permissions defined`);
          }

          module.permissions.forEach((permission) => {
            if (!permission.code || !permission.name) {
              errors.push(`Permission in ${appCode}.${moduleCode} missing code or name`);
            }
          });
        });
      }
    });
    
    return errors;
  }

  /**
   * Extract applications present in a role's permissions
   * @param {object} permissions - Role permissions object (hierarchical: { crm: { leads: [...] }, hr: { employees: [...] } })
   * @returns {string[]} Array of application codes (e.g., ['crm', 'hr'])
   */
  static extractApplicationsFromPermissions(permissions: Record<string, unknown> | null | undefined): string[] {
    if (!permissions || typeof permissions !== 'object') {
      return [];
    }

    const applications = new Set<string>();

    // Handle hierarchical format where top-level keys are app codes
    Object.keys(permissions).forEach(appCode => {
      // Check if this is a valid application code
      if (appCode in BUSINESS_SUITE_MATRIX) {
        applications.add(appCode);
      }
    });

    return Array.from(applications);
  }

  /**
   * Filter permissions for a specific application
   * @param {object} permissions - Full permissions object (hierarchical format)
   * @param {string} appCode - Application code (e.g., 'crm', 'hr')
   * @returns {object} Filtered permissions for the application
   */
  static filterPermissionsByApplication(permissions: Record<string, unknown> | null | undefined, appCode: string): Record<string, unknown> {
    if (!permissions || typeof permissions !== 'object') {
      return {};
    }

    // For hierarchical format, return just the app-specific permissions
    if (appCode in permissions) {
      return {
        [appCode]: permissions[appCode]
      };
    }

    return {};
  }
}

/**
 * Create super admin role configuration for onboarding
 * Uses PLAN_ACCESS_MATRIX to generate permissions based on subscription plan
 * @param {string} selectedPlan - The selected plan (free, trial, starter, professional, basic, enterprise)
 * @param {string} tenantId - The tenant ID
 * @param {string} createdBy - The user ID creating the role
 * @returns {object} Role configuration object with nested permissions structure
 */
export function createSuperAdminRoleConfig(selectedPlan: string = 'free', tenantId?: string, createdBy?: string) {
  // Get plan access configuration from PLAN_ACCESS_MATRIX
  const planAccess = PLAN_ACCESS_MATRIX[selectedPlan as PlanIdKey];
  
  if (!planAccess) {
    Logger.log('warning', 'permissions', 'create-super-admin-role-config', `⚠️ Plan ${selectedPlan} not found in PLAN_ACCESS_MATRIX, using 'free' plan`);
    return createSuperAdminRoleConfig('free', tenantId, createdBy);
  }

  // Extract permissions from PLAN_ACCESS_MATRIX
  // The permissions structure is already in nested format: { crm: { leads: [...], contacts: [...] } }
  const permissions = planAccess.permissions || {};

  return {
    tenantId,
    organizationId: tenantId, // Set organizationId to tenantId for root organization (will be updated after org creation)
    roleName: 'Organization Admin',
    description: 'Full administrative access to all features and settings. This role has complete control over the organization.',
    permissions,
    isSystemRole: true,
    isDefault: true,
    priority: 100, // Highest priority
    scope: 'organization',
    isInheritable: true,
    color: '#dc2626', // Red color for admin role
    createdBy,
    restrictions: {}, // No restrictions for super admin
  };
}

// ─── ACCOUNTING UTILITY FUNCTIONS ───────────────────────────────────────────

/**
 * Returns a Record mapping each accounting module keyword to an array of module names
 * that should become accessible when the user has any permission containing
 * that keyword. Used by GET /auth/user/permissions to derive moduleAccess.
 */
export function buildAccountingPermissionToModulesMap(): Record<string, string[]> {
  const accountingApp = BUSINESS_SUITE_MATRIX.accounting;
  if (!accountingApp) return {};

  const map: Record<string, string[]> = {};

  for (const moduleCode of Object.keys(accountingApp.modules)) {
    if (!map[moduleCode]) map[moduleCode] = [];
    if (!map[moduleCode].includes(moduleCode)) {
      map[moduleCode].push(moduleCode);
    }
  }

  // AR umbrella → sub-modules
  map['invoices'] = [...(map['invoices'] || []), 'accounts_receivable'];
  map['customers'] = [...(map['customers'] || []), 'accounts_receivable'];
  map['credit_notes'] = [...(map['credit_notes'] || []), 'accounts_receivable'];
  map['sales_orders'] = [...(map['sales_orders'] || []), 'accounts_receivable'];
  map['estimates'] = [...(map['estimates'] || []), 'accounts_receivable'];
  map['recurring_invoices'] = [...(map['recurring_invoices'] || []), 'accounts_receivable'];
  map['payments'] = [...(map['payments'] || []), 'accounts_receivable'];

  // AP umbrella → sub-modules
  map['bills'] = [...(map['bills'] || []), 'accounts_payable'];
  map['vendors'] = [...(map['vendors'] || []), 'accounts_payable'];
  map['purchase_orders'] = [...(map['purchase_orders'] || []), 'accounts_payable'];
  map['expense_reports'] = [...(map['expense_reports'] || []), 'accounts_payable'];
  map['vendor_credits'] = [...(map['vendor_credits'] || []), 'accounts_payable'];

  // Additional aliases for backward compat with sidebar requiredModules
  map['general_ledger'] = [...(map['general_ledger'] || []), 'accounting'];
  map['chart_of_accounts'] = [...(map['chart_of_accounts'] || []), 'accounting'];
  map['journal_entries'] = [...(map['journal_entries'] || []), 'accounting'];
  map['budgeting'] = [...(map['budgeting'] || []), 'financial_planning'];
  map['banking'] = [...(map['banking'] || []), 'bank_accounts', 'bank_reconciliation', 'cash_flow'];
  map['tax'] = [...(map['tax'] || []), 'tax_management', 'gst', 'tds', 'tax_compliance'];
  map['payroll'] = [...(map['payroll'] || []), 'payroll_employees', 'payroll_runs', 'payroll_payslips'];
  map['reports'] = [...(map['reports'] || []), 'financial_statements'];
  map['analytics'] = [...(map['analytics'] || []), 'reports'];
  map['compliance'] = [...(map['compliance'] || []), 'audit'];
  map['projects'] = [...(map['projects'] || []), 'time_tracking', 'project_billing', 'project_costing'];
  map['system'] = [...(map['system'] || []), 'user_management', 'system_admin', 'settings', 'admin_settings', 'rbac'];

  for (const key of Object.keys(map)) {
    map[key] = [...new Set(map[key])];
  }

  return map;
}

/**
 * Generates the LEGACY_TO_WRAPPER mapping automatically from the accounting permission matrix.
 * For each module, creates:
 *   manage_{module} → all accounting.{module}.* permissions
 *   view_{module}   → [accounting.{module}.read]
 */
export function buildAccountingLegacyToWrapperMap(): Record<string, string[]> {
  const accountingApp = BUSINESS_SUITE_MATRIX.accounting;
  if (!accountingApp) return {};

  const map: Record<string, string[]> = {};
  const appCode = accountingApp.appInfo.appCode;

  for (const [moduleCode, mod] of Object.entries(accountingApp.modules)) {
    const allPerms = mod.permissions.map((p: { code: string }) => `${appCode}.${moduleCode}.${p.code}`);
    const readPerms = mod.permissions
      .filter((p: { code: string }) => p.code === 'read' || p.code === 'read_all')
      .map((p: { code: string }) => `${appCode}.${moduleCode}.${p.code}`);

    map[`manage_${moduleCode}`] = allPerms;
    if (readPerms.length > 0) {
      map[`view_${moduleCode}`] = readPerms;
    }
  }

  map['manage_accounting'] = [
    ...map['manage_general_ledger'],
    ...map['manage_chart_of_accounts'],
  ];
  map['view_accounting'] = [
    `${appCode}.general_ledger.read`,
    `${appCode}.chart_of_accounts.read`,
  ];
  map['manage_entities'] = map['manage_multi_entity'];
  map['view_entities'] = map['view_multi_entity'];

  return map;
}

export default BUSINESS_SUITE_MATRIX;