import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Building,
  Users,
  MapPin,
  Settings,
  BarChart3,
  Shield,
  Activity,
  AlertTriangle,
  RefreshCw,
  Plus
} from 'lucide-react';
import { motion } from 'framer-motion';
import { OrganizationTreeManagement, OrganizationUserManagement } from '@/features/organizations/components';
import { useOrganizationAuth } from '@/hooks/useOrganizationAuth';
import toast from 'react-hot-toast';
// OrganizationPermissionManagement component temporarily removed during refactoring
// TODO: Implement organization-specific permission management component

interface TenantInfo {
  tenantId: string;
  companyName: string;
  subdomain: string;
  isActive: boolean;
  isVerified: boolean;
}

interface DashboardData {
  employees: any[];
  applications: any[];
  isAdmin: boolean;
  tenantInfo?: TenantInfo;
}

interface AuthStatusResponse {
  success: boolean;
  authStatus?: {
    tenantId?: string;
    userId?: string;
  };
}

export function OrganizationManagementPage() {
  const [activeTab, setActiveTab] = useState('hierarchy');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authTenantId, setAuthTenantId] = useState<string | null>(null);
  const { tenantId, userContext, makeRequest, isAuthenticated, loading: authLoading } = useOrganizationAuth();

  const effectiveTenantId = authTenantId || tenantInfo?.tenantId || tenantId;

  // // Debug logging
  // console.log('🏗️ OrganizationManagementPage:', {
  //   tenantId,
  //   authTenantId,
  //   tenantInfoTenantId: tenantInfo?.tenantId,
  //   effectiveTenantId,
  //   isAuthenticated,
  //   authLoading,
  //   userContext,
  //   dashboardData,
  //   loading
  // });

  // Load dashboard data
  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load user data, applications, and tenant info
      const [usersResponse, applicationsResponse, tenantResponse, authStatusResp] = await Promise.all([
        makeRequest('/tenants/current/users', {
          headers: { 'X-Application': 'crm' }
        }),
        makeRequest('/user-applications/summary', {
          headers: { 'X-Application': 'crm' }
        }),
        makeRequest('/tenants/current', {
          headers: { 'X-Application': 'crm' }
        }),
        makeRequest('/api/admin/auth-status', {
          headers: { 'X-Application': 'crm' }
        })
      ]);

      // Transform applications data to match expected format
      const applications = applicationsResponse.data?.applicationUsage?.map((app: any) => ({
        appId: app.appCode,
        appCode: app.appCode,
        appName: app.appName,
        description: `Application for ${app.appName}`,
        icon: 'default-icon',
        baseUrl: '#',
        isEnabled: true,
        subscriptionTier: 'standard',
        enabledModules: [],
        maxUsers: app.userCount
      })) || [];

      setDashboardData({
        employees: usersResponse.data || [],
        applications: applications,
        isAdmin: userContext?.roles?.includes('TENANT_ADMIN') || false,
        tenantInfo: tenantResponse.data
      });

      const serverTenantId = (authStatusResp as any)?.authStatus?.tenantId;
      if (serverTenantId) {
        setAuthTenantId(serverTenantId);
      } else {
        console.warn('⚠️ No tenant ID found in auth status response');
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      toast.error('Failed to load organization data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      loadDashboardData();
    }
  }, [isAuthenticated, authLoading]);

  // Handle invite employee
  const handleInviteEmployee = () => {
    // This would typically open an invite dialog or navigate to invite page
    toast.success('Invite functionality would open here');
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-[#1B2E5A] mx-auto mb-4" />
          <p className="text-gray-600">Loading organization management...</p>
          <p className="text-sm text-gray-500 mt-2">
            {authLoading ? 'Authenticating...' : 'Loading data...'}
          </p>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Alert className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load organization data. Please refresh the page or contact support.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { employees, applications, isAdmin, tenantInfo } = dashboardData;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="bg-white border-b border-gray-200"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Building className="w-8 h-8 text-[#1B2E5A] mr-3" />
              <div className="space-y-1">
                <h1 className="text-4xl font-black tracking-tighter text-[#1B2E5A]">
                  Organization Management
                </h1>
                {tenantInfo && (
                  <p className="text-muted-foreground text-sm">
                    {tenantInfo.companyName} ({tenantInfo.subdomain})
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={tenantInfo?.isActive ? "default" : "destructive"}>
                {tenantInfo?.isActive ? 'Active' : 'Inactive'}
              </Badge>
              <Badge variant={tenantInfo?.isVerified ? "default" : "secondary"}>
                {tenantInfo?.isVerified ? 'Verified' : 'Unverified'}
              </Badge>
              <Button variant="outline" onClick={loadDashboardData}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="rounded-2xl border border-[#1B2E5A]/20 bg-gradient-to-br from-[#1B2E5A]/5 to-white">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-[#1B2E5A]/10 rounded-lg">
                  <Building className="w-6 h-6 text-[#1B2E5A]" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Organizations</p>
                  <p className="text-2xl font-bold text-[#1B2E5A]">--</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-[#1B2E5A]/20 bg-gradient-to-br from-[#1B2E5A]/5 to-white">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-[#1B2E5A]/10 rounded-lg">
                  <Users className="w-6 h-6 text-[#1B2E5A]" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Team Members</p>
                  <p className="text-2xl font-bold text-[#1B2E5A]">{employees.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-[#1B2E5A]/20 bg-gradient-to-br from-[#1B2E5A]/5 to-white">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-[#1B2E5A]/10 rounded-lg">
                  <MapPin className="w-6 h-6 text-[#1B2E5A]" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Locations</p>
                  <p className="text-2xl font-bold text-[#1B2E5A]">--</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-[#1B2E5A]/20 bg-gradient-to-br from-[#1B2E5A]/5 to-white">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-2 bg-[#1B2E5A]/10 rounded-lg">
                  <Settings className="w-6 h-6 text-[#1B2E5A]" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Applications</p>
                  <p className="text-2xl font-bold text-[#1B2E5A]">{applications.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="hierarchy" className="flex items-center gap-2">
              <Building className="w-4 h-4" />
              Hierarchy
            </TabsTrigger>
            <TabsTrigger value="locations" className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Locations
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="permissions" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Permissions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="hierarchy" className="p-0 m-0 h-full">
            {effectiveTenantId && isAuthenticated ? (
              <div className="w-full h-full min-h-[600px] relative">
                <OrganizationTreeManagement
                  tenantId={effectiveTenantId}
                  isAdmin={isAdmin}
                  makeRequest={makeRequest}
                />
              </div>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Unable to load organization hierarchy. Please ensure you're logged in and have proper tenant access.
                  <br />
                  <strong>Current state:</strong> Tenant ID: {tenantId || 'null'}, Authenticated: {isAuthenticated ? 'Yes' : 'No'}
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>

          <TabsContent value="locations">
            <Alert>
              <MapPin className="h-4 w-4" />
              <AlertDescription>
                Location management is coming soon.
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="users">
            <OrganizationUserManagement
              employees={employees}
              isAdmin={isAdmin}
              makeRequest={makeRequest}
              loadDashboardData={loadDashboardData}
              inviteEmployee={handleInviteEmployee}
            />
          </TabsContent>

          <TabsContent value="permissions">
            <div className="p-6 text-center text-gray-500">
              <h3 className="text-lg font-medium mb-2">Permission Management</h3>
              <p>Organization-specific permission management is coming soon.</p>
              <p className="text-sm mt-2">Use the global Permissions page for application-wide settings.</p>
            </div>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}

export default OrganizationManagementPage;
