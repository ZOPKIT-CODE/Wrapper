import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Search, 
  Grid3X3, 
  List, 
  TreePine,
  Filter,
  Eye,
  Edit,
  Shield,
  Users,
  Clock,
  Globe,
  Database,
  Check,
  X,
  BarChart3
} from 'lucide-react';

interface Operation {
  id: string;
  name: string;
  description: string;
  level: 'basic' | 'standard' | 'advanced';
}

interface Module {
  key: string;
  name: string;
  description: string;
  operationCount: number;
  operations: Operation[];
}

interface Application {
  key: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  moduleCount: number;
  operationCount: number;
  modules: Module[];
}

interface PermissionStructure {
  structure: Record<string, any>;
  summary: {
    applicationCount: number;
    moduleCount: number;
    operationCount: number;
  };
  applications: Application[];
  flatPermissions: any[];
}

interface RolePermissions {
  [moduleKey: string]: {
    level: 'none' | 'read' | 'write' | 'admin';
    operations: string[];
    scope: 'own' | 'team' | 'department' | 'zone' | 'all';
    conditions: Record<string, any>;
    restrictions?: {
      timeRestrictions?: Record<string, any>;
      ipRestrictions?: Record<string, any>;
      dataRestrictions?: Record<string, any>;
      featureRestrictions?: Record<string, any>;
    };
  };
}

interface ApplicationPermissionViewerProps {
  permissionStructure: PermissionStructure;
  rolePermissions?: RolePermissions;
  readOnly?: boolean;
  onPermissionChange?: (moduleKey: string, operationId: string, enabled: boolean) => void;
  onLevelChange?: (moduleKey: string, level: 'none' | 'read' | 'write' | 'admin') => void;
  onScopeChange?: (moduleKey: string, scope: 'own' | 'team' | 'department' | 'zone' | 'all') => void;
}

type ViewMode = 'tree' | 'table' | 'cards';

export function ApplicationPermissionViewer({
  permissionStructure,
  rolePermissions = {},
  readOnly = false,
  onPermissionChange,
  onLevelChange,
  onScopeChange
}: ApplicationPermissionViewerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('tree');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedApp, setSelectedApp] = useState<string>('all');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['CRM', 'HR', 'SYSTEM']));
  const [selectedLevel, setSelectedLevel] = useState<string>('all');

  // Filter permissions based on search and filters
  const filteredData = useMemo(() => {
    if (!permissionStructure?.applications) return [];

    return permissionStructure.applications.filter(app => {
      if (selectedApp !== 'all' && app.key !== selectedApp) return false;
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesApp = app.name.toLowerCase().includes(query) || 
                          app.description.toLowerCase().includes(query);
        const matchesModule = app.modules.some(module => 
          module.name.toLowerCase().includes(query) || 
          module.description.toLowerCase().includes(query)
        );
        const matchesOperation = app.modules.some(module =>
          module.operations.some(op => 
            op.name.toLowerCase().includes(query) || 
            op.description.toLowerCase().includes(query)
          )
        );
        
        if (!matchesApp && !matchesModule && !matchesOperation) return false;
      }
      
      return true;
    });
  }, [permissionStructure, searchQuery, selectedApp]);

  const toggleExpansion = (itemKey: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemKey)) {
      newExpanded.delete(itemKey);
    } else {
      newExpanded.add(itemKey);
    }
    setExpandedItems(newExpanded);
  };

  const getPermissionCount = (moduleKey: string) => {
    const modulePerms = rolePermissions[moduleKey];
    if (!modulePerms) return { total: 0, granted: 0 };
    
    const application = permissionStructure.applications.find(app => 
      app.modules.some(mod => mod.key === moduleKey)
    );
    const module = application?.modules.find(mod => mod.key === moduleKey);
    
    if (!module) return { total: 0, granted: 0 };
    
    return {
      total: module.operations.length,
      granted: modulePerms.operations?.length || 0
    };
  };

  const isOperationEnabled = (moduleKey: string, operationId: string) => {
    return rolePermissions[moduleKey]?.operations?.includes(operationId) || false;
  };

  const getModuleLevel = (moduleKey: string) => {
    return rolePermissions[moduleKey]?.level || 'none';
  };

  const getModuleScope = (moduleKey: string) => {
    return rolePermissions[moduleKey]?.scope || 'own';
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'admin': return 'text-red-600 bg-red-50 border-red-200';
      case 'write': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'read': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getScopeColor = (scope: string) => {
    switch (scope) {
      case 'all': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'zone': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'department': return 'text-indigo-600 bg-indigo-50 border-indigo-200';
      case 'team': return 'text-cyan-600 bg-cyan-50 border-cyan-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  // Tree View Component
  const TreeView = () => (
    <div className="space-y-4">
      {filteredData.map(application => (
        <div key={application.key} className="border border-gray-200 rounded-lg overflow-hidden">
          <div 
            className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100"
            onClick={() => toggleExpansion(application.key)}
            style={{ borderLeft: `4px solid ${application.color}` }}
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {expandedItems.has(application.key) ? 
                  <ChevronDown className="w-4 h-4" /> : 
                  <ChevronRight className="w-4 h-4" />
                }
                <span className="text-xl">{application.icon}</span>
              </div>
              <div>
                <h3 className="font-semibold text-[#1B2E5A]">{application.name}</h3>
                <p className="text-sm text-gray-600">{application.description}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-[#1B2E5A]">
                {application.moduleCount} modules • {application.operationCount} operations
              </div>
              <div className="text-xs text-gray-500">
                {application.modules.reduce((sum, module) => {
                  const { granted } = getPermissionCount(module.key);
                  return sum + granted;
                }, 0)} granted
              </div>
            </div>
          </div>

          {expandedItems.has(application.key) && (
            <div className="p-4 space-y-3">
              {application.modules.map(module => (
                <div key={module.key} className="ml-6 border border-gray-100 rounded-lg">
                  <div 
                    className="flex items-center justify-between p-3 bg-white cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleExpansion(`${application.key}.${module.key}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {expandedItems.has(`${application.key}.${module.key}`) ? 
                          <ChevronDown className="w-3 h-3" /> : 
                          <ChevronRight className="w-3 h-3" />
                        }
                        <Shield className="w-4 h-4 text-gray-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-[#1B2E5A]">{module.name}</h4>
                        <p className="text-xs text-gray-600">{module.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!readOnly && (
                        <select
                          value={getModuleLevel(module.key)}
                          onChange={(e) => onLevelChange?.(module.key, e.target.value as any)}
                          className={`px-2 py-1 text-xs border rounded ${getLevelColor(getModuleLevel(module.key))}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <option value="none">None</option>
                          <option value="read">Read</option>
                          <option value="write">Write</option>
                          <option value="admin">Admin</option>
                        </select>
                      )}
                      {readOnly && (
                        <span className={`px-2 py-1 text-xs border rounded ${getLevelColor(getModuleLevel(module.key))}`}>
                          {getModuleLevel(module.key)}
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {getPermissionCount(module.key).granted}/{getPermissionCount(module.key).total}
                      </span>
                    </div>
                  </div>

                  {expandedItems.has(`${application.key}.${module.key}`) && (
                    <div className="p-3 bg-gray-50 border-t">
                      <div className="space-y-2">
                        {module.operations.map(operation => (
                          <div key={operation.id} className="flex items-center justify-between py-2 px-3 bg-white rounded border">
                            <div className="flex items-center gap-3">
                              {!readOnly ? (
                                <input
                                  type="checkbox"
                                  checked={isOperationEnabled(module.key, operation.id)}
                                  onChange={(e) => onPermissionChange?.(module.key, operation.id, e.target.checked)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                              ) : (
                                <div className="w-4 h-4 flex items-center justify-center">
                                  {isOperationEnabled(module.key, operation.id) ? 
                                    <Check className="w-3 h-3 text-green-600" /> : 
                                    <X className="w-3 h-3 text-gray-400" />
                                  }
                                </div>
                              )}
                              <div>
                                <span className="text-sm font-medium text-[#1B2E5A]">{operation.name}</span>
                                <p className="text-xs text-gray-600">{operation.description}</p>
                              </div>
                            </div>
                            <span className={`px-2 py-1 text-xs rounded border ${
                              operation.level === 'advanced' ? 'bg-red-50 text-red-700 border-red-200' :
                              operation.level === 'standard' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                              'bg-green-50 text-green-700 border-green-200'
                            }`}>
                              {operation.level}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  // Table View Component  
  const TableView = () => (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Application</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Module</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Operation</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Level</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Access</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scope</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredData.flatMap(application =>
              application.modules.flatMap(module =>
                module.operations.map((operation, index) => (
                  <tr key={`${module.key}-${operation.id}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{application.icon}</span>
                        <div>
                          <div className="font-medium text-[#1B2E5A]">{application.name}</div>
                          <div className="text-xs text-gray-500">{application.key}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-[#1B2E5A]">{module.name}</div>
                        <div className="text-xs text-gray-500">{module.key}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium text-[#1B2E5A]">{operation.name}</div>
                        <div className="text-xs text-gray-500">{operation.description}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded border ${
                        operation.level === 'advanced' ? 'bg-red-50 text-red-700 border-red-200' :
                        operation.level === 'standard' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                        'bg-green-50 text-green-700 border-green-200'
                      }`}>
                        {operation.level}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {!readOnly ? (
                        <input
                          type="checkbox"
                          checked={isOperationEnabled(module.key, operation.id)}
                          onChange={(e) => onPermissionChange?.(module.key, operation.id, e.target.checked)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      ) : (
                        <div className="flex items-center">
                          {isOperationEnabled(module.key, operation.id) ? 
                            <Check className="w-4 h-4 text-green-600" /> : 
                            <X className="w-4 h-4 text-gray-400" />
                          }
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!readOnly ? (
                        <select
                          value={getModuleScope(module.key)}
                          onChange={(e) => onScopeChange?.(module.key, e.target.value as any)}
                          className={`px-2 py-1 text-xs border rounded ${getScopeColor(getModuleScope(module.key))}`}
                        >
                          <option value="own">Own</option>
                          <option value="team">Team</option>
                          <option value="department">Department</option>
                          <option value="zone">Zone</option>
                          <option value="all">All</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-1 text-xs border rounded ${getScopeColor(getModuleScope(module.key))}`}>
                          {getModuleScope(module.key)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded border ${getLevelColor(getModuleLevel(module.key))}`}>
                        {getModuleLevel(module.key)}
                      </span>
                    </td>
                  </tr>
                ))
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Card View Component
  const CardView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      {filteredData.map(application => (
        <div key={application.key} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          <div 
            className="p-4 border-b border-gray-200"
            style={{ borderTop: `4px solid ${application.color}` }}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{application.icon}</span>
              <div>
                <h3 className="font-semibold text-[#1B2E5A]">{application.name}</h3>
                <p className="text-sm text-gray-600">{application.description}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>{application.moduleCount} modules</span>
              <span>{application.operationCount} operations</span>
            </div>
          </div>

          <div className="p-4">
            <div className="space-y-3">
              {application.modules.map(module => {
                const { total, granted } = getPermissionCount(module.key);
                const level = getModuleLevel(module.key);
                const scope = getModuleScope(module.key);
                
                return (
                  <div key={module.key} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-gray-400" />
                        <h4 className="font-medium text-[#1B2E5A]">{module.name}</h4>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`px-2 py-1 text-xs border rounded ${getLevelColor(level)}`}>
                          {level}
                        </span>
                        <span className="text-xs text-gray-500">{granted}/{total}</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">{module.description}</p>
                    
                    {!readOnly && (
                      <div className="flex items-center gap-2">
                        <select
                          value={level}
                          onChange={(e) => onLevelChange?.(module.key, e.target.value as any)}
                          className={`flex-1 px-2 py-1 text-xs border rounded ${getLevelColor(level)}`}
                        >
                          <option value="none">None</option>
                          <option value="read">Read</option>
                          <option value="write">Write</option>
                          <option value="admin">Admin</option>
                        </select>
                        <select
                          value={scope}
                          onChange={(e) => onScopeChange?.(module.key, e.target.value as any)}
                          className={`flex-1 px-2 py-1 text-xs border rounded ${getScopeColor(scope)}`}
                        >
                          <option value="own">Own</option>
                          <option value="team">Team</option>
                          <option value="department">Department</option>
                          <option value="zone">Zone</option>
                          <option value="all">All</option>
                        </select>
                      </div>
                    )}

                    {level !== 'none' && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <div className="grid grid-cols-2 gap-1">
                          {module.operations.slice(0, 4).map(operation => (
                            <div key={operation.id} className="flex items-center gap-1">
                              {isOperationEnabled(module.key, operation.id) ? 
                                <Check className="w-3 h-3 text-green-600" /> : 
                                <X className="w-3 h-3 text-gray-400" />
                              }
                              <span className="text-xs text-gray-600 truncate">{operation.name}</span>
                            </div>
                          ))}
                          {module.operations.length > 4 && (
                            <div className="text-xs text-gray-500 col-span-2">
                              +{module.operations.length - 4} more operations
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  if (!permissionStructure?.applications) {
    return (
      <div className="text-center py-8">
        <Shield className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600">Loading permission structure...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-[#1B2E5A]">Application Permissions</h2>
            <p className="text-gray-600">Manage access to applications, modules, and operations</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-[#1B2E5A]">{permissionStructure.summary.operationCount}</div>
              <div className="text-sm text-gray-600">Total Operations</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">{permissionStructure.summary.moduleCount}</div>
              <div className="text-sm text-gray-600">Modules</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-600">{permissionStructure.summary.applicationCount}</div>
              <div className="text-sm text-gray-600">Applications</div>
            </div>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search applications, modules, or operations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <select
              value={selectedApp}
              onChange={(e) => setSelectedApp(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Applications</option>
              {permissionStructure.applications.map(app => (
                <option key={app.key} value={app.key}>{app.name}</option>
              ))}
            </select>

            {/* View Mode Buttons */}
            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('tree')}
                className={`px-3 py-2 flex items-center gap-1 ${
                  viewMode === 'tree' 
                    ? 'bg-[#1B2E5A] text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <TreePine className="w-4 h-4" />
                Tree
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-2 flex items-center gap-1 border-l border-gray-300 ${
                  viewMode === 'table' 
                    ? 'bg-[#1B2E5A] text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <List className="w-4 h-4" />
                Table
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-2 flex items-center gap-1 border-l border-gray-300 ${
                  viewMode === 'cards' 
                    ? 'bg-[#1B2E5A] text-white' 
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Grid3X3 className="w-4 h-4" />
                Cards
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic View Content */}
      <div className="min-h-96">
        {viewMode === 'tree' && <TreeView />}
        {viewMode === 'table' && <TableView />}
        {viewMode === 'cards' && <CardView />}
      </div>
    </div>
  );
} 