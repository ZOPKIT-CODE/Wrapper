import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Filter,
  Search,
  Download,
  Calendar,
  Clock,
  User,
  Shield,
  Eye,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  BarChart3,
  Users,
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
  ChevronRight,
  X,
  CheckCircle2,
  Info
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatDistanceToNow, format } from 'date-fns';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface ActivityLog {
  logId: string;
  action: string;
  appCode?: string;
  appName?: string;
  metadata: any;
  ipAddress?: string;
  createdAt: string;
}

interface ActivityStats {
  period: string;
  uniqueActiveUsers: number;
  activityBreakdown: Array<{ action: string; count: number }>;
}

export function ActivityDashboard() {
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('24h');
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch user activities
  const { data: userActivitiesData, isLoading: activitiesLoading, refetch: refetchActivities } = useQuery({
    queryKey: ['userActivities', searchQuery, actionFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('action', searchQuery);
      if (actionFilter !== 'all') params.append('action', actionFilter);
      params.append('limit', '100');

      const response = await api.get(`/activity/user?${params.toString()}`);
      return response.data;
    },
    refetchInterval: 30000,
  });

  const activities = useMemo(() => userActivitiesData?.data?.activities || [], [userActivitiesData]);

  // Fetch activity statistics
  const { data: activityStatsData, isLoading: statsLoading } = useQuery({
    queryKey: ['activityStats', periodFilter],
    queryFn: async () => {
      const response = await api.get(`/activity/stats?period=${periodFilter}`);
      return response.data;
    },
    refetchInterval: 60000,
  });

  const stats = useMemo(() => activityStatsData?.data as ActivityStats | undefined, [activityStatsData]);

  const selectedLog = useMemo(() => 
    activities.find((log: ActivityLog) => log.logId === selectedLogId),
  [activities, selectedLogId]);

  // Set first log as selected by default if none selected
  React.useEffect(() => {
    if (activities.length > 0 && !selectedLogId) {
      setSelectedLogId(activities[0].logId);
    }
  }, [activities, selectedLogId]);

  const handleExport = async (format: 'json' | 'csv' = 'json') => {
    try {
      setLoading(true);
      const filters: any = {};
      if (actionFilter !== 'all') filters.action = actionFilter;

      const response = await api.post('/activity/export', {
        type: 'user',
        format,
        filters
      }, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `activity-logs-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Activity logs exported successfully!');
    } catch (error: any) {
      console.error('Export failed:', error);
      toast.error(error.response?.data?.error || 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setActionFilter('all');
  };

  const getActivityIcon = (action: string) => {
    const a = action.toLowerCase();
    if (a.includes('login')) return <LogIn className="w-4 h-4" />;
    if (a.includes('logout')) return <LogOut className="w-4 h-4" />;
    if (a.includes('user.created') || a.includes('user.invited')) return <UserPlus className="w-4 h-4" />;
    if (a.includes('user.deleted') || a.includes('user.deactivated')) return <UserMinus className="w-4 h-4" />;
    if (a.includes('role')) return <Shield className="w-4 h-4" />;
    if (a.includes('permission')) return <Settings className="w-4 h-4" />;
    if (a.includes('app')) return <Monitor className="w-4 h-4" />;
    if (a.includes('export')) return <Download className="w-4 h-4" />;
    if (a.includes('edit') || a.includes('updated')) return <Edit className="w-4 h-4" />;
    if (a.includes('delete')) return <Trash2 className="w-4 h-4" />;
    return <Activity className="w-4 h-4" />;
  };

  const getActivityColor = (action: string) => {
    const a = action.toLowerCase();
    if (a.includes('login')) return 'text-emerald-600 bg-emerald-50 border-emerald-100';
    if (a.includes('logout')) return 'text-slate-600 bg-slate-50 border-slate-100';
    if (a.includes('created') || a.includes('invited')) return 'text-blue-600 bg-blue-50 border-blue-100';
    if (a.includes('deleted') || a.includes('failed')) return 'text-rose-600 bg-rose-50 border-rose-100';
    if (a.includes('updated') || a.includes('modified')) return 'text-amber-600 bg-amber-50 border-amber-100';
    if (a.includes('role') || a.includes('permission')) return 'text-violet-600 bg-violet-50 border-violet-100';
    return 'text-slate-600 bg-slate-50 border-slate-100';
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
    <div className="flex flex-col h-full space-y-6 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[#1B2E5A] flex items-center gap-3">
            <div className="p-2 bg-[#1B2E5A] rounded-xl shadow-lg shadow-blue-200">
              <Activity className="w-6 h-6 text-white" />
            </div>
            Activity Logs
          </h1>
          <p className="text-slate-500 mt-1 font-medium">Monitor your account activity and security events</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchActivities()}
            className="bg-white border-slate-200 hover:bg-slate-50 shadow-sm font-semibold h-10"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", activitiesLoading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            onClick={() => handleExport('json')}
            disabled={loading || activities.length === 0}
            className="bg-[#1B2E5A] hover:bg-[#152449] text-white shadow-md shadow-blue-100 font-semibold h-10"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Logs
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard 
          title="Total Activities" 
          value={activities.length} 
          icon={<Activity className="w-5 h-5" />} 
          color="blue"
          loading={activitiesLoading}
        />
        <StatsCard 
          title="Active Users" 
          value={stats?.uniqueActiveUsers || 0} 
          icon={<Users className="w-5 h-5" />} 
          color="emerald"
          loading={statsLoading}
        />
        <StatsCard 
          title="Security Events" 
          value={activities.filter(a => a.action.includes('login') || a.action.includes('role') || a.action.includes('permission')).length} 
          icon={<Shield className="w-5 h-5" />} 
          color="violet"
          loading={activitiesLoading}
        />
        <StatsCard 
          title="Data Changes" 
          value={activities.filter(a => a.action.includes('updated') || a.action.includes('created') || a.action.includes('deleted')).length} 
          icon={<Database className="w-5 h-5" />} 
          color="amber"
          loading={activitiesLoading}
        />
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Search by action name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 border-slate-200 focus:ring-blue-500 h-10 rounded-xl"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-full md:w-[180px] border-slate-200 h-10 rounded-xl bg-white">
              <SelectValue placeholder="Action Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="login">Logins</SelectItem>
              <SelectItem value="user">User Management</SelectItem>
              <SelectItem value="role">Roles & Permissions</SelectItem>
              <SelectItem value="app">App Access</SelectItem>
              <SelectItem value="export">Exports</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="ghost" 
            onClick={clearFilters}
            className="text-slate-500 hover:text-slate-900 h-10"
          >
            <X className="w-4 h-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      {/* Main Content Split Pane */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6 pb-6">
        {/* Left Panel: Logs List */}
        <div className="lg:col-span-5 flex flex-col min-h-[400px] lg:h-full bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              Recent Events
              <Badge variant="secondary" className="bg-slate-200/50 text-slate-700 rounded-full px-2 py-0">
                {activities.length}
              </Badge>
            </h3>
            <div className="text-xs text-slate-400 font-medium italic">
              Auto-refreshes every 30s
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {activitiesLoading ? (
              <div className="flex flex-col items-center justify-center h-full py-12 space-y-4">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                <p className="text-slate-400 font-medium">Fetching activities...</p>
              </div>
            ) : activities.length > 0 ? (
              activities.map((activity: ActivityLog) => (
                <button
                  key={activity.logId}
                  onClick={() => setSelectedLogId(activity.logId)}
                  className={cn(
                    "w-full text-left p-3 rounded-2xl transition-all duration-200 flex items-center gap-3 group relative border",
                    selectedLogId === activity.logId 
                      ? "bg-blue-50 border-blue-200 shadow-sm" 
                      : "bg-transparent border-transparent hover:bg-slate-50 hover:border-slate-100"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-xl transition-transform group-hover:scale-110 border",
                    getActivityColor(activity.action)
                  )}>
                    {getActivityIcon(activity.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className={cn(
                        "text-sm font-bold truncate",
                        selectedLogId === activity.logId ? "text-blue-900" : "text-slate-700"
                      )}>
                        {formatActionName(activity.action)}
                      </p>
                      <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap ml-2">
                        {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                      <span className="flex items-center gap-1">
                        <Globe className="w-2.5 h-2.5 opacity-60" />
                        {activity.ipAddress || 'Internal'}
                      </span>
                      {activity.appName && (
                        <>
                          <span className="w-1 h-1 bg-slate-300 rounded-full" />
                          <span className="text-blue-600/70">{activity.appName}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {selectedLogId === activity.logId && (
                    <div className="absolute right-3 w-1 h-6 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                  )}
                </button>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full py-12 text-center px-6">
                <div className="p-4 bg-slate-50 rounded-full mb-4">
                  <Activity className="w-8 h-8 text-slate-300" />
                </div>
                <h4 className="text-[#1B2E5A] font-bold mb-1">No Activities Found</h4>
                <p className="text-slate-500 text-sm">No activity matches your current filters.</p>
                <Button variant="link" onClick={clearFilters} className="text-blue-600 mt-2 font-bold">
                  Clear All Filters
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Detailed View */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
          {selectedLog ? (
            <>
              <div className="p-6 border-b border-slate-100 bg-slate-50/30">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "p-3 rounded-2xl shadow-sm border animate-in zoom-in duration-300",
                      getActivityColor(selectedLog.action)
                    )}>
                      {React.cloneElement(getActivityIcon(selectedLog.action) as React.ReactElement, { className: "w-6 h-6" })}
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-[#1B2E5A]">{formatActionName(selectedLog.action)}</h2>
                      <div className="flex items-center gap-3 mt-1 text-sm font-medium text-slate-500">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {format(new Date(selectedLog.createdAt), 'MMM d, yyyy • h:mm a')}
                        </span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full" />
                        <span className="text-slate-400 font-mono text-xs">{selectedLog.logId}</span>
                      </div>
                    </div>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 px-3 py-1 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3" /> Success
                  </Badge>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                {/* Event Summary Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <Globe className="w-3 h-3" /> Connection Info
                    </h4>
                    <div className="space-y-2">
                      <DetailRow label="IP Address" value={selectedLog.ipAddress || 'Not Recorded'} />
                      <DetailRow 
                        label="Browser/Device" 
                        value={getDeviceInfo(selectedLog.metadata?.userAgent).device} 
                        icon={getDeviceInfo(selectedLog.metadata?.userAgent).icon}
                      />
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <Database className="w-3 h-3" /> Application Context
                    </h4>
                    <div className="space-y-2">
                      <DetailRow label="Service Name" value={selectedLog.appName || 'Wrapper Core'} />
                      <DetailRow label="App Code" value={selectedLog.appCode || 'N/A'} />
                    </div>
                  </div>
                </div>

                {/* Metadata JSON Viewer */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                      <Info className="w-3 h-3" /> Event Metadata
                    </h4>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 text-[10px] font-black uppercase text-blue-600 hover:bg-blue-50"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(selectedLog.metadata, null, 2));
                        toast.success('Metadata copied to clipboard');
                      }}
                    >
                      Copy JSON
                    </Button>
                  </div>
                  <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-slate-200 to-slate-100 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                    <pre className="relative p-5 bg-slate-900 text-blue-100 text-xs rounded-2xl overflow-x-auto shadow-inner leading-relaxed font-mono">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50/50 border-t border-slate-100">
                <p className="text-[10px] text-center text-slate-400 font-medium italic">
                  End-to-end encrypted log. Securely stored in your vault.
                </p>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-slate-50/30">
              <div className="relative mb-6">
                <div className="absolute -inset-4 bg-blue-100/50 rounded-full blur-xl animate-pulse"></div>
                <Eye className="w-16 h-16 text-blue-200 relative z-10" />
              </div>
              <h3 className="text-xl font-black text-[#1B2E5A] mb-2">Select an Activity</h3>
              <p className="text-slate-500 max-w-xs mx-auto leading-relaxed">
                Click on any event from the left panel to view detailed metadata and security information.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper Components
function StatsCard({ title, value, icon, color, loading }: { 
  title: string; 
  value: string | number; 
  icon: React.ReactNode; 
  color: 'blue' | 'emerald' | 'violet' | 'amber';
  loading?: boolean;
}) {
  const colorMap = {
    blue: 'text-blue-600 bg-blue-50 border-blue-100 shadow-blue-50',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100 shadow-emerald-50',
    violet: 'text-violet-600 bg-violet-50 border-violet-100 shadow-violet-50',
    amber: 'text-amber-600 bg-amber-50 border-amber-100 shadow-amber-50'
  };

  return (
    <Card className="border-slate-200 rounded-3xl shadow-sm hover:shadow-md transition-all duration-300 group overflow-hidden bg-white">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">{title}</p>
            {loading ? (
              <div className="h-8 w-16 bg-slate-100 animate-pulse rounded-lg mt-1" />
            ) : (
              <h3 className="text-3xl font-black text-[#1B2E5A] tracking-tight">{value}</h3>
            )}
          </div>
          <div className={cn("p-3 rounded-2xl border transition-transform group-hover:rotate-12", colorMap[color])}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailRow({ label, value, icon }: { label: string; value: string; icon?: any }) {
  const Icon = icon;
  return (
    <div className="flex flex-col space-y-1">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{label}</span>
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400" />}
        <span className="text-sm font-bold text-slate-700 truncate">{value}</span>
      </div>
    </div>
  );
}
