import { useState, useMemo } from 'react'
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader'
import {
  ChevronDown,
  ChevronRight,
  Users,
  Shield,
  Search,
  Plus,
  Settings,
  Grid,
  List,
  Crown,
  Key,
  Eye,
  EyeOff,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  mockPermissions,
  mockUsers,
  PermissionItem,
  User,
} from '@/data/mockPermissions'
import { customRoleTemplates, CustomRole } from '@/data/kindeIntegratedData'

// Enhanced User interface with subscription
interface EnhancedUser extends User {
  subscription: 'starter' | 'professional' | 'enterprise'
  department: string
  status: 'active' | 'inactive' | 'pending'
}

// Enhanced users with subscription data
const enhancedUsers: EnhancedUser[] = mockUsers.map((user) => ({
  ...user,
  subscription:
    Math.random() > 0.7
      ? 'enterprise'
      : Math.random() > 0.4
        ? 'professional'
        : 'starter',
  department: ['Engineering', 'Sales', 'Marketing', 'HR', 'Finance'][
    Math.floor(Math.random() * 5)
  ],
  status:
    Math.random() > 0.8
      ? 'inactive'
      : Math.random() > 0.9
        ? 'pending'
        : 'active',
}))

export function Permissions() {
  return <PermissionsContent />
}

function PermissionsContent() {
  const [users, setUsers] = useState<EnhancedUser[]>(enhancedUsers)
  const [roles] = useState<CustomRole[]>(customRoleTemplates)
  const [permissions] = useState<PermissionItem[]>(mockPermissions)

  // UI State
  const [viewMode, setViewMode] = useState<'workspace' | 'matrix' | 'overview'>(
    'overview'
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(
    new Set(['permissions', 'users', 'roles'])
  )

  // Matrix state
  const [userPermissions, setUserPermissions] = useState<
    Record<string, string[]>
  >(() => {
    const initial: Record<string, string[]> = {}
    enhancedUsers.forEach((user) => {
      initial[user.id] = [...user.assignedPermissions]
    })
    return initial
  })

  // Filter functions
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.department.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesStatus = showInactive || user.status === 'active'
      return matchesSearch && matchesStatus
    })
  }, [users, searchQuery, showInactive])

  const filteredRoles = useMemo(() => {
    return roles.filter(
      (role) =>
        role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        role.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [roles, searchQuery])

  const filteredPermissions = useMemo(() => {
    return permissions.filter(
      (permission) =>
        permission.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        permission.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [permissions, searchQuery])

  const togglePanel = (panel: string) => {
    setExpandedPanels((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(panel)) {
        newSet.delete(panel)
      } else {
        newSet.add(panel)
      }
      return newSet
    })
  }

  // Matrix functions
  const toggleUserPermission = (userId: string, permissionId: string) => {
    setUserPermissions((prev) => {
      const userPerms = prev[userId] || []
      const hasPermission = userPerms.includes(permissionId)

      const updatedPerms = hasPermission
        ? userPerms.filter((id) => id !== permissionId)
        : [...userPerms, permissionId]

      return {
        ...prev,
        [userId]: updatedPerms,
      }
    })
  }

  const hasAccess = (user: EnhancedUser, permission: PermissionItem) => {
    const requiredLevel =
      permission.tool === 'crm'
        ? 'starter'
        : permission.tool === 'hr'
          ? 'professional'
          : permission.tool === 'accounting'
            ? 'enterprise'
            : 'starter'

    const hasSubscription =
      requiredLevel === 'starter' ||
      (requiredLevel === 'professional' &&
        ['professional', 'enterprise'].includes(user.subscription)) ||
      (requiredLevel === 'enterprise' && user.subscription === 'enterprise')

    return hasSubscription
  }

  // Utility functions
  const getSubscriptionColor = (subscription: string) => {
    switch (subscription) {
      case 'enterprise':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'professional':
        return 'bg-[#1B2E5A]/10 text-[#1B2E5A] border-[#1B2E5A]/20'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'inactive':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getDepartmentIcon = (dept: string) => {
    const icons: Record<string, string> = {
      Engineering: '⚙️',
      Sales: '💼',
      Marketing: '📢',
      HR: '👥',
      Finance: '💰',
    }
    return icons[dept] || '🏢'
  }

  // Draggable Permission Card
  const DraggablePermissionCard = ({
    permission,
  }: {
    permission: PermissionItem
  }) => (
    <Card
      className="mb-3 h-24 cursor-grab border-2 transition-all hover:border-green-300 hover:bg-green-50 hover:shadow-lg active:cursor-grabbing"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/json', JSON.stringify(permission))
        e.dataTransfer.effectAllowed = 'copy'
        e.currentTarget.classList.add('opacity-50', 'scale-95')
      }}
      onDragEnd={(e) => {
        e.currentTarget.classList.remove('opacity-50', 'scale-95')
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 text-green-600">
            <Key className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-base font-semibold">
              {permission.name}
            </h4>
            <p className="mb-1 truncate text-sm text-gray-600">
              {permission.description}
            </p>
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="px-2 py-1 text-xs">
                {permission.tool}
              </Badge>
              <span className="text-gray-500 capitalize">
                {permission.level}
              </span>
            </div>
          </div>
          <div className="text-lg">
            {permission.level === 'admin'
              ? '🔴'
              : permission.level === 'advanced'
                ? '🟡'
                : '🟢'}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  // Droppable User Card
  const DroppableUserCard = ({ user }: { user: EnhancedUser }) => (
    <Card
      className="mb-3 h-28 cursor-pointer border-2 transition-all hover:border-[#1B2E5A]/40 hover:bg-[#1B2E5A]/5 hover:shadow-lg"
      onDragOver={(e) => {
        e.preventDefault()
        e.currentTarget.classList.add(
          'border-[#1B2E5A]',
          'bg-[#1B2E5A]/10',
          'scale-105'
        )
      }}
      onDragLeave={(e) => {
        e.currentTarget.classList.remove(
          'border-[#1B2E5A]',
          'bg-[#1B2E5A]/10',
          'scale-105'
        )
      }}
      onDrop={(e) => {
        e.preventDefault()
        e.currentTarget.classList.remove(
          'border-[#1B2E5A]',
          'bg-[#1B2E5A]/10',
          'scale-105'
        )
        e.currentTarget.classList.add('border-green-500', 'bg-green-100')

        setTimeout(() => {
          e.currentTarget.classList.remove('border-green-500', 'bg-green-100')
        }, 1000)

        const permissionData = e.dataTransfer.getData('application/json')
        if (permissionData) {
          const permission = JSON.parse(permissionData)
          setUsers((prev) =>
            prev.map((u) =>
              u.id === user.id
                ? {
                    ...u,
                    assignedPermissions: [
                      ...new Set([...u.assignedPermissions, permission.id]),
                    ],
                  }
                : u
            )
          )
        }
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-purple-500 text-lg font-bold text-white shadow-md">
            {user.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <h4 className="truncate text-base font-bold">{user.name}</h4>
              <Badge
                className={`px-2 py-1 text-xs ${getStatusColor(user.status)}`}
              >
                {user.status}
              </Badge>
            </div>
            <p className="mb-1 truncate text-sm text-gray-600">{user.email}</p>
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1">
                {getDepartmentIcon(user.department)} {user.department}
              </span>
              <Badge
                className={`px-2 py-0.5 text-xs ${getSubscriptionColor(user.subscription)}`}
              >
                {user.subscription}
              </Badge>
            </div>
          </div>
          <div className="text-center text-sm text-gray-500">
            <div className="font-medium">{user.assignedPermissions.length}</div>
            <div className="text-xs">permissions</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  // Enhanced Role Card for workspace
  const CompactRoleCard = ({ role }: { role: CustomRole }) => (
    <Card className="mb-3 h-24 border-2 transition-all hover:border-purple-300 hover:bg-purple-50 hover:shadow-lg">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
            <Crown className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-base font-semibold">{role.name}</h4>
            <p className="mb-1 truncate text-sm text-gray-600">
              {role.description}
            </p>
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="px-2 py-1 text-xs">
                {role.permissions.length} permissions
              </Badge>
              <span className="text-gray-500">{role.userCount} users</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  // Permission Matrix with Toggles
  const PermissionMatrix = () => {
    return (
      <Card className="professional-dropdown h-[600px] overflow-hidden border-0 shadow-lg">
        <CardHeader className="professional-dropdown-header pb-3">
          <CardTitle className="flex items-center gap-3 text-xl font-bold text-[#1B2E5A]">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-700">
              <Grid className="h-4 w-4 text-white" />
            </div>
            Permission Matrix
            <Badge className="ml-auto bg-gray-100 text-gray-700">
              {filteredUsers.length} × {filteredPermissions.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="professional-dropdown-content p-0">
          <div className="hidden-scrollbar h-[520px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr>
                  <th className="sticky left-0 min-w-[180px] border-r bg-gray-50 p-3 text-left font-medium text-[#1B2E5A]">
                    User
                  </th>
                  {filteredPermissions.slice(0, 8).map((permission) => (
                    <th
                      key={permission.id}
                      className="min-w-[100px] p-3 text-center font-medium text-[#1B2E5A]"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs">
                          {permission.tool.toUpperCase()}
                        </span>
                        <span className="truncate text-xs font-normal">
                          {permission.name}
                        </span>
                        <div className="text-xs">
                          {permission.level === 'admin'
                            ? '🔴'
                            : permission.level === 'advanced'
                              ? '🟡'
                              : '🟢'}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.slice(0, 10).map((user) => (
                  <tr
                    key={user.id}
                    className="border-t border-gray-100 hover:bg-gray-50"
                  >
                    <td className="sticky left-0 border-r bg-white p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-purple-500 text-xs font-semibold text-white">
                          {user.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">
                            {user.name}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Badge
                              className={`px-1 py-0 text-xs ${getSubscriptionColor(user.subscription)}`}
                            >
                              {user.subscription}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </td>
                    {filteredPermissions.slice(0, 8).map((permission) => {
                      const canAccess = hasAccess(user, permission)
                      const isEnabled =
                        userPermissions[user.id]?.includes(permission.id) ||
                        false

                      return (
                        <td key={permission.id} className="p-3 text-center">
                          <div className="flex items-center justify-center">
                            {canAccess ? (
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={() =>
                                  toggleUserPermission(user.id, permission.id)
                                }
                                className="data-[state=checked]:bg-green-600"
                              />
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <span className="text-sm text-gray-400">
                                  ⛔
                                </span>
                                <span className="text-xs text-gray-500">
                                  Upgrade
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Stats Overview Component
  const StatsOverview = () => (
    <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
      <Card className="border-l-4 border-l-[#1B2E5A]">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-[#1B2E5A]" />
            <div>
              <p className="text-2xl font-bold">{filteredUsers.length}</p>
              <p className="text-sm text-gray-600">Active Users</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-purple-500">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Crown className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">{filteredRoles.length}</p>
              <p className="text-sm text-gray-600">Roles</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-green-500">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Key className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{filteredPermissions.length}</p>
              <p className="text-sm text-gray-600">Permissions</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-orange-500">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">
                {users.filter((u) => u.status === 'active').length}
              </p>
              <p className="text-sm text-gray-600">Active</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Custom Scrollbar Styles - Hidden but functional */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          .hidden-scrollbar {
            scrollbar-width: none; /* Firefox */
            -ms-overflow-style: none; /* Internet Explorer 10+ */
          }
          .hidden-scrollbar::-webkit-scrollbar {
            display: none; /* Safari and Chrome */
            width: 0;
            height: 0;
          }
          
          .professional-dropdown {
            transition: all 0.3s ease;
          }
          .professional-dropdown.expanded {
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          }
          .professional-dropdown-header {
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border-bottom: 1px solid #e2e8f0;
            transition: all 0.2s ease;
          }
          .professional-dropdown-header:hover {
            background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%);
          }
          .professional-dropdown-content {
            background: linear-gradient(to bottom, #ffffff 0%, #fafafa 100%);
          }
        `,
        }}
      />

      {/* Header */}
      <DashboardPageHeader
        title="Permissions Management"
        description="Drag & drop permissions • Matrix toggles • Role management"
        actions={
          <>
            <Button variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Quick Role
            </Button>
            <Button size="sm">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </>
        }
      />

      {/* Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* View Mode Toggle */}
          <div className="flex rounded-lg bg-gray-100 p-1">
            {[
              { key: 'overview', label: 'Overview', icon: Grid },
              { key: 'workspace', label: 'Workspace', icon: Users },
              { key: 'matrix', label: 'Matrix', icon: List },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setViewMode(key as any)}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                  viewMode === key
                    ? 'bg-white text-[#1B2E5A] shadow-sm'
                    : 'text-gray-600 hover:text-[#1B2E5A]'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 pl-10"
            />
          </div>

          {/* Show Inactive Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInactive(!showInactive)}
            className={showInactive ? 'border-[#1B2E5A]/20 bg-[#1B2E5A]/5' : ''}
          >
            {showInactive ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'overview' && (
        <div className="space-y-6">
          <StatsOverview />

          {/* Quick Overview Grid */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* Recent Users */}
            <Card className="professional-dropdown border-0 shadow-lg">
              <CardHeader className="professional-dropdown-header rounded-t-lg pb-3">
                <CardTitle className="flex items-center gap-3 text-lg font-semibold text-[#1B2E5A]">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1B2E5A]">
                    <Users className="h-4 w-4 text-white" />
                  </div>
                  Recent Users
                  <Badge className="ml-auto bg-[#1B2E5A]/10 text-[#1B2E5A]">
                    {filteredUsers.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="hidden-scrollbar professional-dropdown-content max-h-96 space-y-2 overflow-y-auto p-6">
                {filteredUsers.slice(0, 8).map((user) => (
                  <DroppableUserCard key={user.id} user={user} />
                ))}
              </CardContent>
            </Card>

            {/* Active Roles */}
            <Card className="professional-dropdown border-0 shadow-lg">
              <CardHeader className="professional-dropdown-header rounded-t-lg pb-3">
                <CardTitle className="flex items-center gap-3 text-lg font-semibold text-[#1B2E5A]">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500">
                    <Crown className="h-4 w-4 text-white" />
                  </div>
                  Active Roles
                  <Badge className="ml-auto bg-purple-100 text-purple-700">
                    {filteredRoles.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="hidden-scrollbar professional-dropdown-content max-h-96 space-y-2 overflow-y-auto p-6">
                {filteredRoles.slice(0, 8).map((role) => (
                  <CompactRoleCard key={role.id} role={role} />
                ))}
              </CardContent>
            </Card>

            {/* Key Permissions */}
            <Card className="professional-dropdown border-0 shadow-lg">
              <CardHeader className="professional-dropdown-header rounded-t-lg pb-3">
                <CardTitle className="flex items-center gap-3 text-lg font-semibold text-[#1B2E5A]">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500">
                    <Key className="h-4 w-4 text-white" />
                  </div>
                  Key Permissions
                  <Badge className="ml-auto bg-green-100 text-green-700">
                    {filteredPermissions.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="hidden-scrollbar professional-dropdown-content max-h-96 space-y-2 overflow-y-auto p-6">
                {filteredPermissions.slice(0, 8).map((permission) => (
                  <DraggablePermissionCard
                    key={permission.id}
                    permission={permission}
                  />
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {viewMode === 'workspace' && (
        <div className="grid h-[800px] grid-cols-12 gap-6">
          {/* Permissions Panel */}
          <div className="col-span-4">
            <Card
              className={`professional-dropdown flex h-full flex-col border-0 shadow-lg ${expandedPanels.has('permissions') ? 'expanded' : ''}`}
            >
              <button
                onClick={() => togglePanel('permissions')}
                className="professional-dropdown-header flex items-center justify-between rounded-t-lg p-6 transition-all duration-200 hover:bg-green-50"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
                    <Key className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-xl font-bold text-[#1B2E5A]">
                      Available Permissions
                    </h2>
                    <p className="mt-1 text-sm text-gray-600">
                      {filteredPermissions.length} permissions ready to assign
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                    {filteredPermissions.length}
                  </Badge>
                  {expandedPanels.has('permissions') ? (
                    <ChevronDown className="h-6 w-6 text-gray-400 transition-transform duration-200" />
                  ) : (
                    <ChevronRight className="h-6 w-6 text-gray-400 transition-transform duration-200" />
                  )}
                </div>
              </button>

              {expandedPanels.has('permissions') && (
                <div className="professional-dropdown-content flex flex-1 flex-col">
                  <div className="border-b border-green-100 bg-gradient-to-r from-green-50 to-emerald-50 p-5">
                    <div className="flex items-center gap-3 text-sm font-medium text-green-700">
                      <div className="h-3 w-3 animate-pulse rounded-full bg-green-500"></div>
                      <span>
                        Drag permissions to team members to assign access
                      </span>
                    </div>
                  </div>
                  <CardContent className="hidden-scrollbar flex-1 overflow-y-auto p-6">
                    <div className="space-y-3">
                      {filteredPermissions.map((permission) => (
                        <DraggablePermissionCard
                          key={permission.id}
                          permission={permission}
                        />
                      ))}
                    </div>
                  </CardContent>
                </div>
              )}
            </Card>
          </div>

          {/* Users Panel */}
          <div className="col-span-5">
            <Card
              className={`professional-dropdown flex h-full flex-col border-0 shadow-lg ${expandedPanels.has('users') ? 'expanded' : ''}`}
            >
              <button
                onClick={() => togglePanel('users')}
                className="professional-dropdown-header flex items-center justify-between p-6 transition-all duration-200 hover:bg-blue-50"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-xl font-bold text-[#1B2E5A]">
                      Team Members
                    </h2>
                    <p className="mt-1 text-sm text-gray-600">
                      {filteredUsers.length} active team members
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
                    {filteredUsers.length}
                  </Badge>
                  {expandedPanels.has('users') ? (
                    <ChevronDown className="h-6 w-6 text-gray-400 transition-transform duration-200" />
                  ) : (
                    <ChevronRight className="h-6 w-6 text-gray-400 transition-transform duration-200" />
                  )}
                </div>
              </button>

              {expandedPanels.has('users') && (
                <div className="professional-dropdown-content flex flex-1 flex-col">
                  <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-5">
                    <div className="flex items-center gap-3 text-sm font-medium text-blue-700">
                      <div className="h-3 w-3 animate-pulse rounded-full bg-blue-500"></div>
                      <span>
                        Drop zone active - Release permissions here to assign
                      </span>
                    </div>
                  </div>
                  <CardContent className="hidden-scrollbar flex-1 overflow-y-auto p-6">
                    <div className="space-y-3">
                      {filteredUsers.map((user) => (
                        <DroppableUserCard key={user.id} user={user} />
                      ))}
                    </div>
                  </CardContent>
                </div>
              )}
            </Card>
          </div>

          {/* Roles Panel */}
          <div className="col-span-3">
            <Card
              className={`professional-dropdown flex h-full flex-col border-0 shadow-lg ${expandedPanels.has('roles') ? 'expanded' : ''}`}
            >
              <button
                onClick={() => togglePanel('roles')}
                className="professional-dropdown-header flex items-center justify-between rounded-t-lg p-6 transition-all duration-200 hover:bg-purple-50"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg">
                    <Crown className="h-6 w-6 text-white" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-xl font-bold text-[#1B2E5A]">Roles</h2>
                    <p className="mt-1 text-sm text-gray-600">
                      {filteredRoles.length} role templates
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="bg-purple-100 px-3 py-1 text-sm font-medium text-purple-700">
                    {filteredRoles.length}
                  </Badge>
                  {expandedPanels.has('roles') ? (
                    <ChevronDown className="h-6 w-6 text-gray-400 transition-transform duration-200" />
                  ) : (
                    <ChevronRight className="h-6 w-6 text-gray-400 transition-transform duration-200" />
                  )}
                </div>
              </button>

              {expandedPanels.has('roles') && (
                <div className="professional-dropdown-content flex flex-1 flex-col">
                  <div className="border-b border-purple-100 bg-gradient-to-r from-purple-50 to-violet-50 p-5">
                    <div className="flex items-center gap-3 text-sm font-medium text-purple-700">
                      <div className="h-3 w-3 animate-pulse rounded-full bg-purple-500"></div>
                      <span>Quick access role templates</span>
                    </div>
                  </div>
                  <CardContent className="hidden-scrollbar flex-1 overflow-y-auto p-6">
                    <div className="space-y-3">
                      {filteredRoles.map((role) => (
                        <CompactRoleCard key={role.id} role={role} />
                      ))}
                    </div>
                  </CardContent>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {viewMode === 'matrix' && <PermissionMatrix />}
    </div>
  )
}

export default Permissions
