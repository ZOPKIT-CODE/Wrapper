// Mock data for demonstrating the advanced permissions system

export interface PermissionItem {
  id: string
  name: string
  description: string
  category: string
  tool: string
  resource: string
  action: string
  icon: string
  color: string
  level: 'basic' | 'advanced' | 'admin'
  dependencies?: string[]
}

export interface User {
  id: string
  name: string
  email: string
  avatar: string
  role: string
  department?: string
  subscription?: 'starter' | 'professional' | 'enterprise'
  isActive: boolean
  lastActive: string
  assignedPermissions: string[]
  inheritedPermissions: string[]
  restrictedPermissions: string[]
  lastActivity: string
  joinDate: string
}

export interface Role {
  id: string
  name: string
  description: string
  color: string
  icon: string
  type: 'system' | 'custom'
  userCount: number
  permissions: string[]
  restrictions: Record<string, unknown>
  createdAt: string
  isDefault: boolean
}

export const mockPermissions: PermissionItem[] = [
  // CRM Permissions
  {
    id: 'crm.contacts.view',
    name: 'View Contacts',
    description: 'View and browse contact information',
    category: 'CRM - Contacts',
    tool: 'crm',
    resource: 'contacts',
    action: 'view',
    icon: '👁️',
    color: '#3B82F6',
    level: 'basic',
  },
  {
    id: 'crm.contacts.create',
    name: 'Create Contacts',
    description: 'Add new contacts to the system',
    category: 'CRM - Contacts',
    tool: 'crm',
    resource: 'contacts',
    action: 'create',
    icon: '➕',
    color: '#10B981',
    level: 'basic',
    dependencies: ['crm.contacts.view'],
  },
  {
    id: 'crm.contacts.edit',
    name: 'Edit Contacts',
    description: 'Modify existing contact information',
    category: 'CRM - Contacts',
    tool: 'crm',
    resource: 'contacts',
    action: 'edit',
    icon: '✏️',
    color: '#F59E0B',
    level: 'advanced',
    dependencies: ['crm.contacts.view'],
  },
  {
    id: 'crm.contacts.delete',
    name: 'Delete Contacts',
    description: 'Remove contacts from the system',
    category: 'CRM - Contacts',
    tool: 'crm',
    resource: 'contacts',
    action: 'delete',
    icon: '🗑️',
    color: '#EF4444',
    level: 'admin',
    dependencies: ['crm.contacts.view', 'crm.contacts.edit'],
  },
  {
    id: 'crm.contacts.export',
    name: 'Export Contacts',
    description: 'Export contact data to various formats',
    category: 'CRM - Contacts',
    tool: 'crm',
    resource: 'contacts',
    action: 'export',
    icon: '📤',
    color: '#8B5CF6',
    level: 'advanced',
    dependencies: ['crm.contacts.view'],
  },
  {
    id: 'crm.deals.view',
    name: 'View Deals',
    description: 'View and browse deal information',
    category: 'CRM - Deals',
    tool: 'crm',
    resource: 'deals',
    action: 'view',
    icon: '💼',
    color: '#3B82F6',
    level: 'basic',
  },
  {
    id: 'crm.deals.create',
    name: 'Create Deals',
    description: 'Create new deals and opportunities',
    category: 'CRM - Deals',
    tool: 'crm',
    resource: 'deals',
    action: 'create',
    icon: '💰',
    color: '#10B981',
    level: 'advanced',
    dependencies: ['crm.deals.view'],
  },
  {
    id: 'crm.deals.approve',
    name: 'Approve Deals',
    description: 'Approve high-value deals and contracts',
    category: 'CRM - Deals',
    tool: 'crm',
    resource: 'deals',
    action: 'approve',
    icon: '✅',
    color: '#059669',
    level: 'admin',
    dependencies: ['crm.deals.view', 'crm.deals.create'],
  },

  // HR Permissions
  {
    id: 'hr.employees.view',
    name: 'View Employees',
    description: 'View employee directory and profiles',
    category: 'HR - Employees',
    tool: 'hr',
    resource: 'employees',
    action: 'view',
    icon: '👥',
    color: '#6366F1',
    level: 'basic',
  },
  {
    id: 'hr.employees.create',
    name: 'Add Employees',
    description: 'Add new employees to the system',
    category: 'HR - Employees',
    tool: 'hr',
    resource: 'employees',
    action: 'create',
    icon: '👤',
    color: '#10B981',
    level: 'admin',
    dependencies: ['hr.employees.view'],
  },
  {
    id: 'hr.employees.salary',
    name: 'View Salary Data',
    description: 'Access employee salary and compensation info',
    category: 'HR - Employees',
    tool: 'hr',
    resource: 'employees',
    action: 'salary',
    icon: '💵',
    color: '#059669',
    level: 'admin',
    dependencies: ['hr.employees.view'],
  },
  {
    id: 'hr.payroll.process',
    name: 'Process Payroll',
    description: 'Run payroll calculations and processing',
    category: 'HR - Payroll',
    tool: 'hr',
    resource: 'payroll',
    action: 'process',
    icon: '🧮',
    color: '#DC2626',
    level: 'admin',
    dependencies: ['hr.employees.view', 'hr.employees.salary'],
  },

  // Affiliate Permissions
  {
    id: 'affiliate.partners.view',
    name: 'View Partners',
    description: 'View affiliate partner information',
    category: 'Affiliate - Partners',
    tool: 'affiliate',
    resource: 'partners',
    action: 'view',
    icon: '🤝',
    color: '#7C3AED',
    level: 'basic',
  },
  {
    id: 'affiliate.commissions.calculate',
    name: 'Calculate Commissions',
    description: 'Calculate affiliate commissions and payouts',
    category: 'Affiliate - Commissions',
    tool: 'affiliate',
    resource: 'commissions',
    action: 'calculate',
    icon: '📊',
    color: '#059669',
    level: 'advanced',
    dependencies: ['affiliate.partners.view'],
  },

  // Accounting Permissions
  {
    id: 'accounting.invoices.view',
    name: 'View Invoices',
    description: 'View invoice details and history',
    category: 'Accounting - Invoices',
    tool: 'accounting',
    resource: 'invoices',
    action: 'view',
    icon: '📄',
    color: '#0891B2',
    level: 'basic',
  },
  {
    id: 'accounting.invoices.create',
    name: 'Create Invoices',
    description: 'Generate new invoices for customers',
    category: 'Accounting - Invoices',
    tool: 'accounting',
    resource: 'invoices',
    action: 'create',
    icon: '📝',
    color: '#10B981',
    level: 'advanced',
    dependencies: ['accounting.invoices.view'],
  },

  // Inventory Permissions
  {
    id: 'inventory.products.view',
    name: 'View Products',
    description: 'View product catalog and inventory',
    category: 'Inventory - Products',
    tool: 'inventory',
    resource: 'products',
    action: 'view',
    icon: '📦',
    color: '#F59E0B',
    level: 'basic',
  },
  {
    id: 'inventory.stock.adjust',
    name: 'Adjust Stock',
    description: 'Modify stock levels and inventory counts',
    category: 'Inventory - Stock',
    tool: 'inventory',
    resource: 'stock',
    action: 'adjust',
    icon: '📈',
    color: '#EF4444',
    level: 'admin',
    dependencies: ['inventory.products.view'],
  },
]

export const mockUsers: User[] = [
  {
    id: 'user-1',
    name: 'Sarah Chen',
    email: 'sarah@acmecorp.com',
    avatar:
      'https://images.unsplash.com/photo-1494790108755-2616b612b5c4?w=40&h=40&fit=crop&crop=face',
    role: 'Sales Manager',
    department: 'Sales',
    isActive: true,
    lastActive: '2024-01-15T10:30:00Z',
    assignedPermissions: [
      'crm.contacts.view',
      'crm.contacts.create',
      'crm.deals.view',
      'crm.deals.create',
      'crm.deals.approve',
    ],
    inheritedPermissions: ['crm.contacts.view', 'crm.contacts.create'],
    restrictedPermissions: [],
    lastActivity: '2024-01-15T10:30:00Z',
    joinDate: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-2',
    name: 'Mike Rodriguez',
    email: 'mike@acmecorp.com',
    avatar:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face',
    role: 'Sales Rep',
    department: 'Sales',
    isActive: true,
    lastActive: '2024-01-15T09:15:00Z',
    assignedPermissions: [
      'crm.contacts.view',
      'crm.contacts.create',
      'crm.deals.view',
    ],
    inheritedPermissions: ['crm.contacts.view'],
    restrictedPermissions: ['crm.deals.approve'],
    lastActivity: '2024-01-15T09:15:00Z',
    joinDate: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-3',
    name: 'Emma Thompson',
    email: 'emma@acmecorp.com',
    avatar:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&crop=face',
    role: 'HR Manager',
    department: 'Human Resources',
    isActive: true,
    lastActive: '2024-01-15T08:45:00Z',
    assignedPermissions: [
      'hr.employees.view',
      'hr.employees.create',
      'hr.employees.salary',
      'hr.payroll.process',
    ],
    inheritedPermissions: ['hr.employees.view'],
    restrictedPermissions: [],
    lastActivity: '2024-01-15T08:45:00Z',
    joinDate: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-4',
    name: 'David Park',
    email: 'david@acmecorp.com',
    avatar:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face',
    role: 'Accountant',
    department: 'Finance',
    isActive: true,
    lastActive: '2024-01-15T11:20:00Z',
    assignedPermissions: [
      'accounting.invoices.view',
      'accounting.invoices.create',
    ],
    inheritedPermissions: ['accounting.invoices.view'],
    restrictedPermissions: [],
    lastActivity: '2024-01-15T11:20:00Z',
    joinDate: '2024-01-01T00:00:00Z',
  },
  {
    id: 'user-5',
    name: 'Lisa Wang',
    email: 'lisa@acmecorp.com',
    avatar:
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=40&h=40&fit=crop&crop=face',
    role: 'Marketing Manager',
    department: 'Marketing',
    isActive: false,
    lastActive: '2024-01-10T16:30:00Z',
    assignedPermissions: ['crm.contacts.view', 'affiliate.partners.view'],
    inheritedPermissions: [],
    restrictedPermissions: ['crm.deals.approve'],
    lastActivity: '2024-01-10T16:30:00Z',
    joinDate: '2024-01-01T00:00:00Z',
  },
]

export const mockRoles: Role[] = [
  {
    id: 'role-1',
    name: 'Sales Manager',
    description: 'Full access to CRM with deal approval capabilities',
    color: '#10B981',
    icon: '💼',
    type: 'custom',
    userCount: 3,
    permissions: [
      'crm.contacts.view',
      'crm.contacts.create',
      'crm.contacts.edit',
      'crm.deals.view',
      'crm.deals.create',
      'crm.deals.approve',
    ],
    restrictions: {
      'crm.deals.value_limit': 100000,
      'crm.contacts.own_records_only': false,
    },
    createdAt: '2024-01-01T00:00:00Z',
    isDefault: false,
  },
  {
    id: 'role-2',
    name: 'Sales Representative',
    description: 'Basic CRM access for sales activities',
    color: '#3B82F6',
    icon: '📞',
    type: 'custom',
    userCount: 8,
    permissions: [
      'crm.contacts.view',
      'crm.contacts.create',
      'crm.deals.view',
      'crm.deals.create',
    ],
    restrictions: {
      'crm.deals.value_limit': 25000,
      'crm.contacts.own_records_only': true,
    },
    createdAt: '2024-01-01T00:00:00Z',
    isDefault: false,
  },
  {
    id: 'role-3',
    name: 'HR Administrator',
    description: 'Complete HR management capabilities',
    color: '#8B5CF6',
    icon: '👥',
    type: 'custom',
    userCount: 2,
    permissions: [
      'hr.employees.view',
      'hr.employees.create',
      'hr.employees.salary',
      'hr.payroll.process',
    ],
    restrictions: {},
    createdAt: '2024-01-01T00:00:00Z',
    isDefault: false,
  },
  {
    id: 'role-4',
    name: 'Finance Manager',
    description: 'Financial operations and accounting access',
    color: '#059669',
    icon: '💰',
    type: 'custom',
    userCount: 3,
    permissions: [
      'accounting.invoices.view',
      'accounting.invoices.create',
      'hr.employees.salary',
    ],
    restrictions: {},
    createdAt: '2024-01-01T00:00:00Z',
    isDefault: false,
  },
  {
    id: 'role-5',
    name: 'Admin',
    description: 'Full system administrator access',
    color: '#DC2626',
    icon: '⚡',
    type: 'system',
    userCount: 1,
    permissions: ['*'], // All permissions
    restrictions: {},
    createdAt: '2024-01-01T00:00:00Z',
    isDefault: false,
  },
]

export const permissionCategories = [
  {
    id: 'crm',
    name: 'Customer Management',
    icon: '👥',
    color: '#3B82F6',
    description: 'Manage customer relationships and sales processes',
  },
  {
    id: 'hr',
    name: 'Human Resources',
    icon: '👤',
    color: '#8B5CF6',
    description: 'Employee management and HR operations',
  },
  {
    id: 'affiliate',
    name: 'Affiliate Management',
    icon: '🤝',
    color: '#7C3AED',
    description: 'Partner and affiliate program management',
  },
  {
    id: 'accounting',
    name: 'Financial Management',
    icon: '💰',
    color: '#059669',
    description: 'Accounting and financial operations',
  },
  {
    id: 'inventory',
    name: 'Inventory Control',
    icon: '📦',
    color: '#F59E0B',
    description: 'Product and inventory management',
  },
]
