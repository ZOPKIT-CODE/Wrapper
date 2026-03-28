import React, { useState, useEffect } from 'react'
import { 
  Users, 
  Shield, 
  Settings, 
  Check, 
  X, 
  ChevronDown, 
  ChevronRight,
  Plus,
  Minus,
  Search,
  Filter,
  Save,
  AlertTriangle,
  Info,
  Loader2
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { usePermissions } from '@/hooks/usePermissions'
import toast from 'react-hot-toast'

const PermissionMatrix: React.FC = () => {
  const {
    applications,
    users,
    templates,
    loading,
    hasPermission,
    togglePermission,
    saveChanges,
    resetChanges,
    getChangesCount,
    userHasChanges
  } = usePermissions()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedApp, setSelectedApp] = useState<string>('all')
  const [expandedApps, setExpandedApps] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  // Initialize expanded apps when applications load
  useEffect(() => {
    if (applications.length > 0) {
      setExpandedApps(new Set(applications.map(app => app.appId)))
    }
  }, [applications])

  // Filter applications and users
  const filteredApplications = applications.filter(app => 
    selectedApp === 'all' || app.appId === selectedApp
  )

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Toggle app expansion
  const toggleAppExpansion = (appId: string) => {
    setExpandedApps(prev => {
      const newSet = new Set(prev)
      if (newSet.has(appId)) {
        newSet.delete(appId)
      } else {
        newSet.add(appId)
      }
      return newSet
    })
  }

  // Toggle all permissions for a module
  const toggleModulePermissions = (userId: string, appId: string, moduleId: string, allPermissions: string[]) => {
    const hasAllPermissions = allPermissions.every(permId => 
      hasPermission(userId, appId, moduleId, permId)
    )
    
    // If user has all permissions, remove them all; otherwise, grant them all
    if (hasAllPermissions) {
      allPermissions.forEach(permId => {
        if (hasPermission(userId, appId, moduleId, permId)) {
          togglePermission(userId, appId, moduleId, permId)
        }
      })
    } else {
      allPermissions.forEach(permId => {
        if (!hasPermission(userId, appId, moduleId, permId)) {
          togglePermission(userId, appId, moduleId, permId)
        }
      })
    }
  }

  // Save permissions
  const handleSavePermissions = async () => {
    try {
      setSaving(true)
      await saveChanges()
    } catch (error) {
      toast.error('Failed to save permissions')
    } finally {
      setSaving(false)
    }
  }

  const getPermissionBadgeColor = (permissionName: string) => {
    const colorMap: Record<string, string> = {
      'view': 'bg-[#1B2E5A]/10 text-[#1B2E5A]',
      'create': 'bg-green-100 text-green-800',
      'edit': 'bg-yellow-100 text-yellow-800',
      'delete': 'bg-red-100 text-red-800',
      'approve': 'bg-purple-100 text-purple-800',
      'export': 'bg-[#1B2E5A]/10 text-[#1B2E5A]',
      'pay': 'bg-emerald-100 text-emerald-800',
      'process': 'bg-orange-100 text-orange-800',
      'salary': 'bg-pink-100 text-pink-800',
      'reject': 'bg-red-100 text-red-800',
      'calculate': 'bg-cyan-100 text-cyan-800'
    }
    return colorMap[permissionName] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading permissions...</span>
        </div>
      </div>
    )
  }

  const changesCount = getChangesCount()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1B2E5A]">Permission Management</h2>
          <p className="text-gray-600">Manage user access across applications and modules</p>
        </div>
        <div className="flex gap-2">
          {changesCount > 0 && (
            <Button 
              variant="outline" 
              onClick={resetChanges}
              disabled={saving}
            >
              Reset Changes
            </Button>
          )}
          <Button 
            onClick={handleSavePermissions} 
            disabled={saving || changesCount === 0}
            className="bg-[#1B2E5A] hover:bg-[#152449]"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes ({changesCount})
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={selectedApp}
                onChange={(e) => setSelectedApp(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Applications</option>
                {applications.map(app => (
                  <option key={app.appId} value={app.appId}>
                    {app.icon} {app.appName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Permission Matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Permission Matrix
          </CardTitle>
          <CardDescription>
            Grant or revoke permissions for each user across different applications and modules
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {filteredApplications.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No applications available
              </div>
            ) : (
              filteredApplications.map(app => (
                <div key={app.appId} className="border rounded-lg p-4">
                  {/* Application Header */}
                  <div 
                    className="flex items-center justify-between cursor-pointer mb-4"
                    onClick={() => toggleAppExpansion(app.appId)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{app.icon}</span>
                      <div>
                        <h3 className="font-semibold text-lg">{app.appName}</h3>
                        <p className="text-sm text-gray-600">{app.description}</p>
                      </div>
                      <Badge variant="outline" className="ml-2">
                        {app.subscriptionTier}
                      </Badge>
                    </div>
                    {expandedApps.has(app.appId) ? 
                      <ChevronDown className="h-5 w-5" /> : 
                      <ChevronRight className="h-5 w-5" />
                    }
                  </div>

                  {/* Modules and Permissions */}
                  {expandedApps.has(app.appId) && (
                    <div className="space-y-4">
                      {app.modules.length === 0 ? (
                        <div className="text-center py-4 text-gray-500">
                          No modules available for this application
                        </div>
                      ) : (
                        app.modules.map(module => (
                          <div key={module.moduleId} className="bg-gray-50 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <h4 className="font-medium">{module.moduleName}</h4>
                              {module.isCore && (
                                <Badge variant="secondary" className="text-xs">Core</Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-4">{module.description}</p>
                            
                            {/* Permission Grid */}
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead>
                                  <tr className="border-b">
                                    <th className="text-left py-2 px-3 font-medium">User</th>
                                    {module.permissions.map(permission => (
                                      <th key={permission} className="text-center py-2 px-2 font-medium min-w-[80px]">
                                        <Badge 
                                          variant="outline" 
                                          className={`text-xs ${getPermissionBadgeColor(permission)}`}
                                        >
                                          {permission}
                                        </Badge>
                                      </th>
                                    ))}
                                    <th className="text-center py-2 px-3 font-medium">All</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filteredUsers.map(user => (
                                    <tr key={user.userId} className={`border-b hover:bg-gray-50 ${userHasChanges(user.userId) ? 'bg-[#1B2E5A]/5' : ''}`}>
                                      <td className="py-3 px-3">
                                        <div className="flex items-center gap-2">
                                          <div className="w-8 h-8 bg-[#1B2E5A]/10 rounded-full flex items-center justify-center">
                                            <span className="text-sm font-medium text-[#1B2E5A]">
                                              {user.name.charAt(0)}
                                            </span>
                                          </div>
                                          <div>
                                            <div className="font-medium text-sm">{user.name}</div>
                                            <div className="text-xs text-gray-500">{user.email}</div>
                                            {userHasChanges(user.userId) && (
                                              <Badge variant="outline" className="text-xs mt-1">
                                                Modified
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                      
                                      {/* Individual permission toggles */}
                                      {module.permissions.map(permission => (
                                        <td key={permission} className="text-center py-3 px-2">
                                          <Switch
                                            checked={hasPermission(user.userId, app.appId, module.moduleId, permission)}
                                            onCheckedChange={() => togglePermission(user.userId, app.appId, module.moduleId, permission)}
                                          />
                                        </td>
                                      ))}
                                      
                                      {/* Toggle all permissions for this module */}
                                      <td className="text-center py-3 px-3">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => toggleModulePermissions(
                                            user.userId, 
                                            app.appId, 
                                            module.moduleId, 
                                            module.permissions
                                          )}
                                        >
                                          {module.permissions.every(p => 
                                            hasPermission(user.userId, app.appId, module.moduleId, p)
                                          ) ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                                        </Button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>How to use:</strong> Toggle individual permissions using the switches, or use the "All" button to quickly 
          grant or revoke all permissions for a module. Users with pending changes are highlighted in blue. 
          Don't forget to save your changes when you're done.
        </AlertDescription>
      </Alert>
    </div>
  )
}

export default PermissionMatrix 