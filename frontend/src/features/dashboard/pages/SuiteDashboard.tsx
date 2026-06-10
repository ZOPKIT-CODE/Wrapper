import React, { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/cognito-auth'
import type { AxiosRequestConfig } from 'axios'
import api from '@/lib/api'

const getErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err)

interface Application {
  appId: string
  appCode: string
  appName: string
  description: string
  icon: string
  baseUrl: string
  subscriptionTier: string
  enabledModules: string[]
}

interface ActivityLog {
  logId: string
  action: string
  appCode: string
  appName: string
  metadata: Record<string, unknown>
  createdAt: string
}

const SuiteDashboard: React.FC = () => {
  const { user, isAuthenticated } = useAuth()
  const [applications, setApplications] = useState<Application[]>([])
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** Uses shared `api` client (auth interceptors + `/api` base URL). */
  const makeRequest = async <T,>(
    endpoint: string,
    config: AxiosRequestConfig = {}
  ): Promise<T> => {
    const response = await api.request<T>({
      url: endpoint,
      ...config,
    })
    return response.data
  }

  // Load user's available applications
  const loadApplications = async () => {
    try {
      setLoading(true)
      const data = await makeRequest<{ applications: Application[] }>(
        '/suite/applications'
      )
      setApplications(data.applications)
    } catch (err: unknown) {
      setError(`Failed to load applications: ${getErrorMessage(err)}`)
    } finally {
      setLoading(false)
    }
  }

  // Load user activity
  const loadActivity = async () => {
    try {
      const data = await makeRequest<{ activities: ActivityLog[] }>(
        '/suite/activity'
      )
      setActivities(data.activities)
    } catch (err: unknown) {
      console.error('Failed to load activity:', err)
    }
  }

  // Launch application with SSO
  const launchApplication = async (appCode: string, appName: string) => {
    try {
      setLoading(true)

      // Request SSO token for the application
      const data = await makeRequest<{ redirectUrl: string }>(
        '/suite/sso/redirect',
        {
          method: 'POST',
          data: {
            appCode,
            returnTo: '/',
          },
        }
      )

      // Redirect to the application with SSO token
      window.location.href = data.redirectUrl
    } catch (err: unknown) {
      setError(`Failed to launch ${appName}: ${getErrorMessage(err)}`)
      setLoading(false)
    }
  }

  // Get application icon
  const getAppIcon = (appCode: string, icon?: string) => {
    if (icon) return icon

    const iconMap: { [key: string]: string } = {
      crm: '🏢',
      hr: '👥',
      affiliate: '💰',
      analytics: '📊',
      project: '📋',
      accounting: '💰',
    }

    return iconMap[appCode] || '📱'
  }

  // Get subscription tier badge color
  const getTierColor = (tier: string) => {
    const colorMap: { [key: string]: string } = {
      basic: 'bg-gray-100 text-gray-800',
      pro: 'bg-blue-100 text-blue-800',
      enterprise: 'bg-purple-100 text-purple-800',
      custom: 'bg-gold-100 text-gold-800',
    }
    return colorMap[tier] || 'bg-gray-100 text-gray-800'
  }

  useEffect(() => {
    if (isAuthenticated) {
      loadApplications()
      loadActivity()
    }
  }, [isAuthenticated])

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  if (!isAuthenticated) {
    return (
      <div className="dashboard-actionable-cursors flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-md rounded-lg bg-white p-8 text-center shadow-md">
          <div className="mb-6">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#1B2E5A]/10">
              <span className="text-2xl">🚀</span>
            </div>
          </div>
          <h2 className="mb-4 text-2xl font-bold text-[#1B2E5A]">
            Business Suite
          </h2>
          <p className="mb-6 text-gray-600">
            Please log in to access your applications
          </p>
        </div>
      </div>
    )
  }

  // `user` carries dynamic claim keys (index signature `unknown`); narrow the
  // camelCase fields this header reads to strings without changing behavior.
  const givenName =
    typeof user?.givenName === 'string' ? user.givenName : undefined
  const picture = typeof user?.picture === 'string' ? user.picture : undefined

  return (
    <div className="dashboard-actionable-cursors min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl font-bold text-[#1B2E5A]">
                  🚀 Business Suite
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                Welcome,{' '}
                <span className="font-medium text-gray-900">
                  {givenName || user?.email}
                </span>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-300">
                {picture ? (
                  <img
                    src={picture}
                    alt="Profile"
                    className="h-8 w-8 rounded-full"
                  />
                ) : (
                  <span className="text-sm font-medium">
                    {(givenName || user?.email || 'U')[0].toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Error Message */}
      {error && (
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            ❌ {error}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[#1B2E5A]"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Applications Grid */}
            <div className="lg:col-span-2">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-[#1B2E5A]">
                  Your Applications
                </h2>
                <p className="text-gray-600">
                  Access your business tools and services
                </p>
              </div>

              {applications.length === 0 ? (
                <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white py-12 text-center">
                  <span className="mb-4 block text-4xl">📱</span>
                  <h3 className="mb-2 text-lg font-medium text-[#1B2E5A]">
                    No Applications Available
                  </h3>
                  <p className="text-gray-600">
                    Contact your administrator to enable applications for your
                    organization.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {applications.map((app) => (
                    <div
                      key={app.appId}
                      className="group cursor-pointer rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
                      onClick={() =>
                        launchApplication(app.appCode, app.appName)
                      }
                    >
                      <div className="mb-4 flex items-start justify-between">
                        <div className="flex items-center">
                          <div className="mr-3 text-3xl">
                            {getAppIcon(app.appCode, app.icon)}
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-[#1B2E5A] group-hover:text-[#1B2E5A]">
                              {app.appName}
                            </h3>
                            <span
                              className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${getTierColor(app.subscriptionTier)}`}
                            >
                              {app.subscriptionTier}
                            </span>
                          </div>
                        </div>
                        <div className="text-gray-400 group-hover:text-[#1B2E5A]">
                          <svg
                            className="h-5 w-5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      </div>

                      <p className="mb-4 line-clamp-2 text-sm text-gray-600">
                        {app.description ||
                          `Manage your ${app.appName.toLowerCase()} operations`}
                      </p>

                      {app.enabledModules && app.enabledModules.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {app.enabledModules.slice(0, 3).map((module) => (
                            <span
                              key={module}
                              className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700"
                            >
                              {module}
                            </span>
                          ))}
                          {app.enabledModules.length > 3 && (
                            <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
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
              <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-semibold text-[#1B2E5A]">
                  Quick Stats
                </h3>
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
                    <span className="text-sm font-medium">Today</span>
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-lg font-semibold text-[#1B2E5A]">
                  Recent Activity
                </h3>
                {activities.length === 0 ? (
                  <p className="text-sm text-gray-600">No recent activity</p>
                ) : (
                  <div className="space-y-3">
                    {activities.slice(0, 5).map((activity) => (
                      <div
                        key={activity.logId}
                        className="flex items-start space-x-3"
                      >
                        <div className="text-sm">
                          {activity.appCode === 'crm'
                            ? '🏢'
                            : activity.appCode === 'hr'
                              ? '👥'
                              : activity.appCode === 'affiliate'
                                ? '💰'
                                : '📱'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-900">
                            {activity.action
                              .replace(/_/g, ' ')
                              .replace(/\b\w/g, (l) => l.toUpperCase())}
                          </p>
                          <p className="text-xs text-gray-500">
                            {activity.appName} •{' '}
                            {new Date(activity.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Support */}
              <div className="rounded-lg border border-[#1B2E5A]/20 bg-[#1B2E5A]/5 p-6">
                <h3 className="mb-2 text-lg font-semibold text-[#1B2E5A]">
                  Need Help?
                </h3>
                <p className="mb-4 text-sm text-[#1B2E5A]/80">
                  Get support or request new applications for your organization.
                </p>
                <button className="w-full rounded-md bg-[#1B2E5A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#152449]">
                  Contact Support
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default SuiteDashboard
