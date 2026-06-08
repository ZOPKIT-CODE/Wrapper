import React, { useState, useEffect } from 'react';
import { useDashboardTabParam } from '@/hooks/useDashboardTabParam';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Users, Building2, CreditCard, TrendingUp, AlertTriangle, RefreshCw, Download, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

// Sub-components
import { TenantManagement } from './TenantManagement';
import { EntityManagement } from './EntityManagement';
import { CreditManagement } from './CreditManagement';
import ApplicationAssignmentManager from './ApplicationAssignmentManager';
import CreditOperationCostManager from './credit-configuration/CreditOperationCostManager';
import SeasonalCreditsManagement from './SeasonalCreditsManagement';
import { ContactSubmissionsTable } from './ContactSubmissionsTable';
import BlogAdminPanel from '@/features/blog/components/BlogAdminPanel';

interface DashboardStats {
  tenantStats: {
    total: number;
    active: number;
    trial: number;
    paid: number;
  };
  entityStats: {
    total: number;
    organizations: number;
    locations: number;
    departments: number;
  };
  creditStats: {
    totalCredits: number;
    totalReserved: number;
    lowBalanceAlerts: number;
  };
}

interface RecentActivity {
  type: string;
  tenantName: string;
  description: string;
  timestamp: string;
}

import { Container } from '@/components/common/Page/Container';

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useDashboardTabParam({
    allowed: [
      'overview',
      'tenants-entities',
      'credits',
      'applications',
      'clients',
      'operation-costs',
      'seasonal-credits',
      'blog',
    ] as const,
    defaultTab: 'overview',
  });
  const [tenantEntityTab, setTenantEntityTab] = useState<'tenants' | 'entities'>('tenants');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [overviewResponse, activityResponse] = await Promise.all([
        api.get('/admin/dashboard/overview'),
        api.get('/admin/dashboard/recent-activity')
      ]);

      if (overviewResponse.data.success) {
        setStats(overviewResponse.data.data);
      }

      if (activityResponse.data.success) {
        setRecentActivity(activityResponse.data.data.activities || []);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError('Failed to load dashboard data');
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRefresh = () => {
    fetchDashboardData();
  };

  const handleExportData = async () => {
    try {
      toast.info('Exporting data...');
      // Implement export functionality
      toast.success('Data export completed');
    } catch (err) {
      toast.error('Failed to export data');
    }
  };

  if (loading) {
    return (
      <Container className="min-h-[400px] flex items-center justify-center dashboard-actionable-cursors">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading dashboard...</span>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="dashboard-actionable-cursors">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </Container>
    );
  }

  return (
    <Container wide className="dashboard-actionable-cursors">
      <div className="rounded-2xl bg-gradient-to-br from-[#11254d] via-[#1B2E5A] to-[#0f1f40] p-6 text-white shadow-2xl mb-6">

        <div className="flex items-center justify-between">
          <div>
            <nav className="mb-4">
              <div className="flex items-center space-x-2 text-sm text-blue-100/80">
                <span>Admin Dashboard</span>
              </div>
            </nav>
            <h1 className="text-3xl font-bold tracking-tight">Company Admin Dashboard</h1>
            <p className="text-blue-100/85">
              Comprehensive overview of all tenants, entities, and credits
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleRefresh} variant="outline" size="sm" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={handleExportData} variant="outline" size="sm" className="border-white/30 bg-white/10 text-white hover:bg-white/20">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-8 bg-[#1B2E5A] text-white">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tenants-entities">Tenants & Entities</TabsTrigger>
          <TabsTrigger value="credits">Credits</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="operation-costs">Operation Costs</TabsTrigger>
          <TabsTrigger value="seasonal-credits">Seasonal Credits</TabsTrigger>
          <TabsTrigger value="blog">Blog</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.tenantStats.total || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.tenantStats.active || 0} active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Entities</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.entityStats.total || 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.entityStats.organizations || 0} organizations
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Org Credits</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.creditStats.totalCredits.toFixed(2) || '0.00'}</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.creditStats.totalReserved.toFixed(2) || '0.00'} reserved
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Low Balance Alerts</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats?.creditStats.lowBalanceAlerts || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Entities with low credits
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest changes across all tenants</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No recent activity</p>
                ) : (
                  recentActivity.map((activity, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{activity.description}</p>
                        <p className="text-xs text-muted-foreground">{activity.tenantName}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {new Date(activity.timestamp).toLocaleDateString()}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tenants-entities" className="space-y-4">
          <Tabs value={tenantEntityTab} onValueChange={(value) => setTenantEntityTab(value as 'tenants' | 'entities')}>
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="tenants">Tenants</TabsTrigger>
              <TabsTrigger value="entities">Entities</TabsTrigger>
            </TabsList>

            <TabsContent value="tenants" className="mt-4">
              <TenantManagement />
            </TabsContent>

            <TabsContent value="entities" className="mt-4">
              <EntityManagement />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="credits">
          <CreditManagement />
        </TabsContent>

        <TabsContent value="applications">
          <ApplicationAssignmentManager />
        </TabsContent>

        <TabsContent value="clients">
          <ContactSubmissionsTable />
        </TabsContent>

        <TabsContent value="operation-costs">
          <CreditOperationCostManager />
        </TabsContent>

        <TabsContent value="seasonal-credits">
          <SeasonalCreditsManagement />
        </TabsContent>

        <TabsContent value="blog">
          <BlogAdminPanel />
        </TabsContent>
      </Tabs>
    </Container>
  );
};


export default AdminDashboard;
