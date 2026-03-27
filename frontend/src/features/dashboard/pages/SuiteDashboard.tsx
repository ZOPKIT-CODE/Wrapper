import React, { useState, useEffect } from 'react';
import { useKindeAuth } from '@kinde-oss/kinde-auth-react';
import api from '@/lib/api';
import { config } from '@/lib/config';

interface Application {
  appId: string;
  appCode: string;
  appName: string;
  description: string;
  icon: string;
  baseUrl: string;
  subscriptionTier: string;
  enabledModules: string[];
}

interface ActivityLog {
  logId: string;
  action: string;
  appCode: string;
  appName: string;
  metadata: any;
  createdAt: string;
}

const SuiteDashboard: React.FC = () => {
  const { user, isAuthenticated, getToken } = useKindeAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // API helper function using enhanced token retrieval
  const makeRequest = async (endpoint: string, options: RequestInit = {}) => {
    try {
      // Create a custom axios instance for the external API
      const customApi = api.create({
        baseURL: config.WRAPPER_DOMAIN,
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const response = await customApi(endpoint, options);
      return response.data;
    } catch (err: any) {
      throw err;
    }
  };

  // Load user's available applications
  const loadApplications = async () => {
    try {
      setLoading(true);
      const data = await makeRequest('/suite/applications');
      setApplications(data.applications);
    } catch (err: any) {
      setError(`Failed to load applications: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Load user activity
  const loadActivity = async () => {
    try {
      const data = await makeRequest('/suite/activity');
      setActivities(data.activities);
    } catch (err: any) {
      console.error('Failed to load activity:', err);
    }
  };

  // Launch application with SSO
  const launchApplication = async (appCode: string, appName: string) => {
    try {
      setLoading(true);
      
      // Request SSO token for the application
      const data = await makeRequest('/suite/sso/redirect', {
        method: 'POST',
        body: JSON.stringify({ 
          appCode,
          returnTo: '/' // Default landing page for the app
        })
      });

      // Redirect to the application with SSO token
      window.location.href = data.redirectUrl;
      
    } catch (err: any) {
      setError(`Failed to launch ${appName}: ${err.message}`);
      setLoading(false);
    }
  };

  // Get application icon
  const getAppIcon = (appCode: string, icon?: string) => {
    if (icon) return icon;
    
    const iconMap: { [key: string]: string } = {
      'crm': '🏢',
      'hr': '👥',
      'affiliate': '💰',
      'analytics': '📊',
      'project': '📋',
      'accounting': '💰'
    };
    
    return iconMap[appCode] || '📱';
  };

  // Get subscription tier badge color
  const getTierColor = (tier: string) => {
    const colorMap: { [key: string]: string } = {
      'basic': 'bg-gray-100 text-gray-800',
      'pro': 'bg-blue-100 text-blue-800',
      'enterprise': 'bg-purple-100 text-purple-800',
      'custom': 'bg-gold-100 text-gold-800'
    };
    return colorMap[tier] || 'bg-gray-100 text-gray-800';
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadApplications();
      loadActivity();
    }
  }, [isAuthenticated]);

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
          <div className="mb-6">
            <div className="mx-auto h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">🚀</span>
            </div>
          </div>
          <h2 className="text-2xl font-bold text-[#1B2E5A] mb-4">Business Suite</h2>
          <p className="text-gray-600 mb-6">Please log in to access your applications</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl font-bold text-blue-600">🚀 Business Suite</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                Welcome, <span className="font-medium text-gray-900">{user?.given_name || user?.email}</span>
              </div>
              <div className="h-8 w-8 bg-gray-300 rounded-full flex items-center justify-center">
                {user?.picture ? (
                  <img src={user.picture} alt="Profile" className="h-8 w-8 rounded-full" />
                ) : (
                  <span className="text-sm font-medium">{(user?.given_name || user?.email || 'U')[0].toUpperCase()}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Error Message */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            ❌ {error}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Applications Grid */}
            <div className="lg:col-span-2">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-[#1B2E5A]">Your Applications</h2>
                <p className="text-gray-600">Access your business tools and services</p>
              </div>

              {applications.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
                  <span className="text-4xl mb-4 block">📱</span>
                  <h3 className="text-lg font-medium text-[#1B2E5A] mb-2">No Applications Available</h3>
                  <p className="text-gray-600">Contact your administrator to enable applications for your organization.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {applications.map((app) => (
                    <div
                      key={app.appId}
                      className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer group"
                      onClick={() => launchApplication(app.appCode, app.appName)}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center">
                          <div className="text-3xl mr-3">
                            {getAppIcon(app.appCode, app.icon)}
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-[#1B2E5A] group-hover:text-blue-600">
                              {app.appName}
                            </h3>
                            <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${getTierColor(app.subscriptionTier)}`}>
                              {app.subscriptionTier}
                            </span>
                          </div>
                        </div>
                        <div className="text-gray-400 group-hover:text-blue-500">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                      
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                        {app.description || `Manage your ${app.appName.toLowerCase()} operations`}
                      </p>
                      
                      {app.enabledModules && app.enabledModules.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {app.enabledModules.slice(0, 3).map((module) => (
                            <span
                              key={module}
                              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                            >
                              {module}
                            </span>
                          ))}
                          {app.enabledModules.length > 3 && (
                            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                              +{app.enabledModules.length - 3} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              
              {/* Quick Stats */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-[#1B2E5A] mb-4">Quick Stats</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Available Apps</span>
                    <span className="font-medium">{applications.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Active Sessions</span>
                    <span className="font-medium text-green-600">●</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last Login</span>
                    <span className="font-medium text-sm">Today</span>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-[#1B2E5A] mb-4">Recent Activity</h3>
                {activities.length === 0 ? (
                  <p className="text-gray-600 text-sm">No recent activity</p>
                ) : (
                  <div className="space-y-3">
                    {activities.slice(0, 5).map((activity) => (
                      <div key={activity.logId} className="flex items-start space-x-3">
                        <div className="text-sm">
                          {activity.appCode === 'crm' ? '🏢' : 
                           activity.appCode === 'hr' ? '👥' : 
                           activity.appCode === 'affiliate' ? '💰' : '📱'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900">
                            {activity.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </p>
                          <p className="text-xs text-gray-500">
                            {activity.appName} • {new Date(activity.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Support */}
              <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">Need Help?</h3>
                <p className="text-blue-700 text-sm mb-4">
                  Get support or request new applications for your organization.
                </p>
                <button className="w-full bg-[#1B2E5A] text-white px-4 py-2 rounded-md hover:bg-[#152449] transition-colors text-sm font-medium">
                  Contact Support
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SuiteDashboard; 