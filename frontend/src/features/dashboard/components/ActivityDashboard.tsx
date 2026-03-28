import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Filter,
  Search,
  Download,
  Clock,
  User,
  Shield,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  BarChart3,
  Users,
  FileText,
  Database,
  Settings,
  LogIn,
  LogOut,
  UserPlus,
  UserMinus,
  Edit,
  Trash2,
  Globe,
  Smartphone,
  Monitor,
  ChevronDown,
  ChevronRight,
  X
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatDistanceToNow } from 'date-fns';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import LoadingButton, { IconButton } from '../common/LoadingButton';
import { Typography } from '../common/Typography';

interface ActivityLog {
  logId: string;
  action: string;
  appCode?: string;
  appName?: string;
  metadata: any;
  ipAddress?: string;
  createdAt: string;
}

interface AuditLog {
  logId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  oldValues?: any;
  newValues?: any;
  details?: any;
  ipAddress?: string;
  createdAt: string;
}

export function ActivityDashboard() {
  const [activeTab, setActiveTab] = useState<'activities' | 'audit' | 'stats'>('activities');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [resourceTypeFilter, setResourceTypeFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('');
  const [periodFilter, setPeriodFilter] = useState('24h');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  // Fetch user activities
  const { data: userActivities, isLoading: activitiesLoading, refetch: refetchActivities } = useQuery({
    queryKey: ['userActivities', searchQuery, actionFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('action', searchQuery);
      if (actionFilter) params.append('action', actionFilter);
      params.append('limit', '100');

      const response = await api.get(`/activity/user?${params.toString()}`);
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch audit logs (admin only)
  const { data: auditLogs, isLoading: auditLoading, refetch: refetchAudit } = useQuery({
    queryKey: ['auditLogs', searchQuery, actionFilter, resourceTypeFilter, userFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('action', searchQuery);
      if (actionFilter) params.append('action', actionFilter);
      if (resourceTypeFilter && resourceTypeFilter !== 'all') params.append('resourceType', resourceTypeFilter);
      if (userFilter) params.append('userId', userFilter);
      params.append('limit', '100');

      const response = await api.get(`/activity/audit?${params.toString()}`);
      return response.data;
    },
    refetchInterval: 30000,
    retry: (failureCount, error: any) => {
      // Don't retry if it's a 403 (access denied)
      if (error?.response?.status === 403) return false;
      return failureCount < 2;
    }
  });

  // Fetch activity statistics
  const { data: activityStats, isLoading: statsLoading } = useQuery({
    queryKey: ['activityStats', periodFilter],
    queryFn: async () => {
      const response = await api.get(`/activity/stats?period=${periodFilter}`);
      return response.data;
    },
    refetchInterval: 60000, // Refresh every minute
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 403) return false;
      return failureCount < 2;
    }
  });

  const handleExport = async (type: 'user' | 'audit', format: 'json' | 'csv' = 'json') => {
    try {
      setLoading(true);
      const filters: any = {};
      
      if (actionFilter) filters.action = actionFilter;
      if (resourceTypeFilter && resourceTypeFilter !== 'all') filters.resourceType = resourceTypeFilter;
      if (userFilter) filters.userId = userFilter;

      const response = await api.post('/activity/export', {
        type,
        format,
        filters
      }, {
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${type}-logs-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`${type === 'user' ? 'Activity' : 'Audit'} logs exported successfully!`);
    } catch (error: any) {
      console.error('Export failed:', error);
      toast.error(error.response?.data?.error || 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setActionFilter('');
    setResourceTypeFilter('all');
    setUserFilter('');
  };

  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getActivityIcon = (action: string) => {
    if (action.includes('login')) return <LogIn className="w-4 h-4" />;
    if (action.includes('logout')) return <LogOut className="w-4 h-4" />;
    if (action.includes('user.created') || action.includes('user.invited')) return <UserPlus className="w-4 h-4" />;
    if (action.includes('user.deleted') || action.includes('user.deactivated')) return <UserMinus className="w-4 h-4" />;
    if (action.includes('role')) return <Shield className="w-4 h-4" />;
    if (action.includes('permission')) return <Settings className="w-4 h-4" />;
    if (action.includes('app')) return <Monitor className="w-4 h-4" />;
    if (action.includes('export')) return <Download className="w-4 h-4" />;
    if (action.includes('edit') || action.includes('updated')) return <Edit className="w-4 h-4" />;
    if (action.includes('delete')) return <Trash2 className="w-4 h-4" />;
    return <Activity className="w-4 h-4" />;
  };

  const getActivityColor = (action: string) => {
    if (action.includes('login')) return 'text-green-600 bg-green-50';
    if (action.includes('logout')) return 'text-gray-600 bg-gray-50';
    if (action.includes('created') || action.includes('invited')) return 'text-blue-600 bg-blue-50';
    if (action.includes('deleted') || action.includes('failed')) return 'text-red-600 bg-red-50';
    if (action.includes('updated') || action.includes('modified')) return 'text-orange-600 bg-orange-50';
    if (action.includes('role') || action.includes('permission')) return 'text-purple-600 bg-purple-50';
    return 'text-gray-600 bg-gray-50';
  };

  const formatActionName = (action: string) => {
    return action
      .split('.')
      .map(word => word.replace(/_/g, ' '))
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' › ');
  };

  const getDeviceInfo = (userAgent?: string) => {
    if (!userAgent) return { device: 'Unknown', icon: Monitor };
    
    if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
      return { device: 'Mobile', icon: Smartphone };
    }
    return { device: 'Desktop', icon: Monitor };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#1B2E5A] flex items-center gap-2">
            <Activity className="w-8 h-8" />
            Activity & Audit Logs
          </h1>
          <p className="text-gray-600 mt-1">Track user activities and system changes across your platform</p>
        </div>
        
        <div className="flex items-center gap-3">
          <LoadingButton
            variant="outline"
            size="sm"
            onClick={() => {
              refetchActivities();
              refetchAudit();
            }}
            isLoading={loading}
            startIcon={RefreshCw}
          >
            Refresh
          </LoadingButton>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <IconButton
            onClick={() => setActiveTab('activities')}
            startIcon={User}
          >
            My Activities
          </IconButton>
          
          <IconButton
            onClick={() => setActiveTab('audit')}
            startIcon={Shield}
          >
            Audit Logs
          </IconButton>
            
          <IconButton
            onClick={() => setActiveTab('stats')}
            startIcon={BarChart3}
          >
            Statistics
          </IconButton>
          <IconButton
            onClick={() => setActiveTab('stats')}
            startIcon={BarChart3}
          >
            Statistics
          </IconButton>
        </nav>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Action</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search activities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            {activeTab === 'audit' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Resource Type</label>
                  <Select value={resourceTypeFilter} onValueChange={setResourceTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="role">Role</SelectItem>
                      <SelectItem value="permission">Permission</SelectItem>
                      <SelectItem value="application">Application</SelectItem>
                      <SelectItem value="session">Session</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">User Filter</label>
                  <Input
                    placeholder="User ID or email..."
                    value={userFilter}
                    onChange={(e) => setUserFilter(e.target.value)}
                  />
                </div>
              </>
            )}
            
            {activeTab === 'stats' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time Period</label>
                <Select value={periodFilter} onValueChange={setPeriodFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1h">Last Hour</SelectItem>
                    <SelectItem value="24h">Last 24 Hours</SelectItem>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                    <SelectItem value="30d">Last 30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="flex items-end">
              <IconButton variant="outline" onClick={clearFilters} className="w-full"
                startIcon={X}>
                Clear Filters
              </IconButton>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {activeTab === 'activities' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Your Activities</CardTitle>
              <CardDescription>Your recent actions and system interactions</CardDescription>
            </div>
            <IconButton
              variant="outline"
              size="sm"
              onClick={() => handleExport('user', 'json')}
              disabled={loading}
              startIcon={Download}
            >
              Export
            </IconButton>
          </CardHeader>
          <CardContent>
            {activitiesLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-600">Loading activities...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {userActivities?.data?.activities?.map((activity: ActivityLog) => {
                  const DeviceIcon = getDeviceInfo(activity.metadata?.userAgent).icon;
                  const isExpanded = expandedItems.has(activity.logId);
                  
                  return (
                    <div
                      key={activity.logId}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <div className={`p-2 rounded-lg ${getActivityColor(activity.action)}`}>
                            {getActivityIcon(activity.action)}
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-gray-900">
                                {formatActionName(activity.action)}
                              </span>
                              {activity.appName && (
                                <Badge variant="secondary">{activity.appName}</Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                              </span>
                              
                              {activity.ipAddress && (
                                <span className="flex items-center gap-1">
                                  <Globe className="w-3 h-3" />
                                  {activity.ipAddress}
                                </span>
                              )}
                              
                              <span className="flex items-center gap-1">
                                <DeviceIcon className="w-3 h-3" />
                                {getDeviceInfo(activity.metadata?.userAgent).device}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {activity.metadata && Object.keys(activity.metadata).length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpanded(activity.logId)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </Button>
                        )}
                      </div>
                      
                      {isExpanded && activity.metadata && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Details</h4>
                          <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto">
                            {JSON.stringify(activity.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {!userActivities?.data?.activities?.length && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <Typography variant="muted">No activities found</Typography>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'audit' && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Audit Logs</CardTitle>
              <CardDescription>System changes and administrative actions</CardDescription>
            </div>
            <div className="flex gap-2">
              <LoadingButton
                variant="outline"
                size="sm"
                onClick={() => handleExport('audit', 'csv')}
                isLoading={loading}
                disabled={loading}
                startIcon={Download}
              >
                CSV
              </LoadingButton>
              <LoadingButton
                isLoading={loading}
                variant="outline"
                size="sm"
                onClick={() => handleExport('audit', 'json')}
                disabled={loading}
                startIcon={Download}
              >
                JSON
              </LoadingButton>
            </div>
          </CardHeader>
          <CardContent>
            {auditLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-600">Loading audit logs...</span>
              </div>
            ) : auditLogs?.error ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {auditLogs.error || 'Access denied. Admin privileges required to view audit logs.'}
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                {auditLogs?.data?.logs?.map((log: AuditLog) => {
                  const isExpanded = expandedItems.has(log.logId);
                  
                  return (
                    <div
                      key={log.logId}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <div className={`p-2 rounded-lg ${getActivityColor(log.action)}`}>
                            {getActivityIcon(log.action)}
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-[#1B2E5A]">
                                {formatActionName(log.action)}
                              </span>
                              <Badge variant="outline">{log.resourceType}</Badge>
                              {log.resourceId && (
                                <Badge variant="secondary" className="font-mono text-xs">
                                  {log.resourceId.slice(0, 8)}...
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {log.userName || log.userEmail || 'System'}
                              </span>
                              
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                              </span>
                              
                              {log.ipAddress && (
                                <span className="flex items-center gap-1">
                                  <Globe className="w-3 h-3" />
                                  {log.ipAddress}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {(log.oldValues || log.newValues || log.details) && (
                          <IconButton
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleExpanded(log.logId)}
                            startIcon={isExpanded ? ChevronDown : ChevronRight}
                          />
                           
                        )}
                      </div>
                      
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                          {log.oldValues && (
                            <div>
                              <Typography variant="h4">Before</Typography>
                              <pre className="text-xs bg-red-50 p-3 rounded overflow-x-auto">
                                {JSON.stringify(log.oldValues, null, 2)}
                              </pre>
                            </div>
                          )}
                          
                          {log.newValues && (
                            <div>
                              <Typography variant="h4">After</Typography>
                              <pre className="text-xs bg-green-50 p-3 rounded overflow-x-auto">
                                {JSON.stringify(log.newValues, null, 2)}
                              </pre>
                            </div>
                          )}
                          
                          {log.details && (
                            <div>
                              <Typography variant="h4">Details</Typography>
                              <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {!auditLogs?.data?.logs?.length && (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <Typography variant="muted">No audit logs found</Typography>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'stats' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {statsLoading ? (
            <div className="col-span-2 flex items-center justify-center py-16">
              <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
              <span className="ml-3 text-gray-600">Loading statistics...</span>
            </div>
          ) : activityStats?.error ? (
            <div className="col-span-2">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {activityStats.error || 'Access denied. Admin privileges required to view statistics.'}
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <>
              {/* Activity Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Activity Metrics
                  </CardTitle>
                  <CardDescription>
                    Activity summary for the {activityStats?.data?.period || 'selected period'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-blue-700">Active Users</span>
                        <Users className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="text-2xl font-bold text-blue-900 mt-1">
                        {activityStats?.data?.uniqueActiveUsers || 0}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Activity Breakdown</h4>
                      <div className="space-y-2">
                        {activityStats?.data?.activityBreakdown?.map((item: any) => (
                          <div key={item.action} className="flex items-center justify-between">
                            <Typography>{formatActionName(item.action)}</Typography>
                            <Badge variant="secondary">{item.count}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Audit Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    Audit Metrics
                  </CardTitle>
                  <CardDescription>
                    System changes and administrative actions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Typography variant="h4">Resource Changes</Typography>
                      <div className="space-y-2">
                        {activityStats?.data?.auditBreakdown?.map((item: any) => (
                          <div key={`${item.resourceType}-${item.action}`} className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">
                              {item.resourceType} › {formatActionName(item.action)}
                            </span>
                            <Badge variant="outline">{item.count}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
} 