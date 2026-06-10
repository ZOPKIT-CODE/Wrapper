import { PermissionSummary, DashboardRole } from '@/types/role-management'

/**
 * Utility function to handle both permission formats and provide consistent summaries
 */
export const getPermissionSummary = (
  permissions: Record<string, unknown> | string[]
): PermissionSummary => {
  // Handle JSON string permissions (like "all crm permissions role")
  if (typeof permissions === 'string') {
    try {
      const parsedPermissions = JSON.parse(permissions)
      // Recursively call with parsed object
      return getPermissionSummary(parsedPermissions)
    } catch (error) {
      console.error('Failed to parse permissions JSON string:', error)
      return {
        total: 0,
        admin: 0,
        write: 0,
        read: 0,
        modules: 0,
        mainModules: 0,
        moduleDetails: {},
        moduleNames: [],
        mainModuleNames: [],
        applicationCount: 0,
        moduleCount: 0,
      }
    }
  }

  // Handle new hierarchical permissions (like Super Administrator)
  if (
    permissions &&
    typeof permissions === 'object' &&
    !Array.isArray(permissions)
  ) {
    const hierarchicalPerms = permissions as Record<string, unknown>
    let totalOperations = 0
    let adminCount = 0
    let writeCount = 0
    let readCount = 0
    const mainModules: string[] = []
    const subModules: string[] = []
    const moduleDetails: Record<string, string[]> = {}

    // Process hierarchical structure like { crm: { leads: [...] } }
    Object.entries(hierarchicalPerms).forEach(([moduleKey, moduleData]) => {
      if (moduleKey === 'metadata') return // Skip metadata

      if (moduleData && typeof moduleData === 'object') {
        mainModules.push(moduleKey)
        moduleDetails[moduleKey] = []

        // Count permissions within each sub-module
        Object.entries(moduleData).forEach(([subModuleKey, operations]) => {
          if (Array.isArray(operations)) {
            const subModuleName = `${moduleKey}.${subModuleKey}`
            subModules.push(subModuleName)
            moduleDetails[moduleKey].push(
              `${subModuleKey} (${operations.length})`
            )
            totalOperations += operations.length

            // Categorize by operation type - updated to match permission matrix
            operations.forEach((op: string) => {
              const action = op.toLowerCase()
              if (
                [
                  'delete',
                  'admin',
                  'manage',
                  'approve',
                  'assign',
                  'change_role',
                  'change_status',
                  'process',
                  'calculate',
                  'pay',
                  'dispute',
                  'close',
                  'reject',
                  'cancel',
                ].some((admin) => action.includes(admin))
              ) {
                adminCount++
              } else if (
                [
                  'read',
                  'view',
                  'export',
                  'list',
                  'read_all',
                  'view_salary',
                  'view_contacts',
                  'view_invoices',
                  'dashboard',
                ].some((read) => action.includes(read))
              ) {
                readCount++
              } else if (
                [
                  'create',
                  'update',
                  'import',
                  'send',
                  'generate_pdf',
                  'customize',
                ].some((write) => action.includes(write))
              ) {
                writeCount++
              } else {
                writeCount++ // Default to write if not clearly read or admin
              }
            })
          }
        })
      }
    })

    return {
      total: totalOperations,
      admin: adminCount,
      write: writeCount,
      read: readCount,
      modules: subModules.length, // Count sub-modules, not main modules
      mainModules: mainModules.length,
      moduleDetails,
      moduleNames: subModules, // Show sub-module names
      mainModuleNames: mainModules,
      applicationCount: mainModules.length,
      moduleCount: subModules.length,
    }
  }

  // Handle flat array permissions (like custom roles)
  if (Array.isArray(permissions)) {
    const permArray = permissions as string[]
    const moduleMap = new Map<string, Set<string>>()
    const moduleDetails: Record<string, string[]> = {}

    // Group permissions by module (e.g., "crm.contacts.read" -> "crm.contacts")
    permArray.forEach((perm) => {
      const parts = perm.split('.')
      if (parts.length >= 2) {
        const moduleKey = `${parts[0]}.${parts[1]}`
        if (!moduleMap.has(moduleKey)) {
          moduleMap.set(moduleKey, new Set())
          moduleDetails[moduleKey] = []
        }
        moduleMap.get(moduleKey)!.add(parts[2] || 'access')
      }
    })

    // Convert moduleMap to moduleDetails
    moduleMap.forEach((perms, module) => {
      moduleDetails[module] = Array.from(perms)
    })

    let adminCount = 0
    let writeCount = 0
    let readCount = 0

    // Count permission types - updated to match permission matrix
    permArray.forEach((perm) => {
      const action = perm.split('.').pop()?.toLowerCase() || ''
      if (
        [
          'delete',
          'admin',
          'manage',
          'approve',
          'assign',
          'change_role',
          'change_status',
          'process',
          'calculate',
          'pay',
          'dispute',
          'close',
          'reject',
          'cancel',
        ].some((admin) => action.includes(admin))
      ) {
        adminCount++
      } else if (
        [
          'read',
          'view',
          'list',
          'read_all',
          'view_salary',
          'view_contacts',
          'view_invoices',
          'export',
          'dashboard',
        ].some((read) => action.includes(read))
      ) {
        readCount++
      } else if (
        [
          'create',
          'update',
          'import',
          'send',
          'generate_pdf',
          'customize',
        ].some((write) => action.includes(write))
      ) {
        writeCount++
      } else {
        writeCount++ // Default to write if not clearly read or admin
      }
    })

    return {
      total: permArray.length,
      admin: adminCount,
      write: writeCount,
      read: readCount,
      modules: moduleMap.size,
      mainModules: new Set(
        Array.from(moduleMap.keys()).map((m) => m.split('.')[0])
      ).size,
      moduleDetails,
      moduleNames: Array.from(moduleMap.keys()),
      mainModuleNames: Array.from(
        new Set(Array.from(moduleMap.keys()).map((m) => m.split('.')[0]))
      ),
      applicationCount: new Set(
        Array.from(moduleMap.keys()).map((m) => m.split('.')[0])
      ).size,
      moduleCount: moduleMap.size,
    }
  }

  // Fallback for empty or invalid permissions
  return {
    total: 0,
    admin: 0,
    write: 0,
    read: 0,
    modules: 0,
    mainModules: 0,
    moduleDetails: {},
    moduleNames: [],
    mainModuleNames: [],
    applicationCount: 0,
    moduleCount: 0,
  }
}

/**
 * Get permission type color
 */
export const getPermissionTypeColor = (
  type: 'admin' | 'write' | 'read'
): string => {
  switch (type) {
    case 'admin':
      return 'bg-red-500'
    case 'write':
      return 'bg-orange-500'
    case 'read':
      return 'bg-green-500'
    default:
      return 'bg-gray-500'
  }
}

/**
 * Get permission type text color
 */
export const getPermissionTypeTextColor = (
  type: 'admin' | 'write' | 'read'
): string => {
  switch (type) {
    case 'admin':
      return 'text-red-700'
    case 'write':
      return 'text-orange-700'
    case 'read':
      return 'text-green-700'
    default:
      return 'text-gray-700'
  }
}

/**
 * Format role creation date
 */
export const formatRoleDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString()
}

/**
 * Check if role can be edited
 */
export const canEditRole = (role: DashboardRole): boolean => {
  if (role.isSystemRole) {
    return role.roleName !== 'Super Administrator'
  }
  return true
}

/**
 * Check if role can be deleted
 */
export const canDeleteRole = (role: DashboardRole): boolean => {
  // System roles cannot be deleted
  if (role.isSystemRole) {
    return false
  }
  // Roles with users cannot be deleted (optional business logic)
  if (role.userCount && role.userCount > 0) {
    return false
  }
  return true
}
