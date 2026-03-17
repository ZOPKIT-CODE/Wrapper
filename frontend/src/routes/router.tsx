import { createRootRoute, createRoute, createRouter, Outlet, Navigate, useNavigate } from '@tanstack/react-router'
import { Suspense, useMemo } from 'react'
import { useKindeAuth } from '@kinde-oss/kinde-auth-react'
import { useUserContextSafe } from '@/contexts/UserContextProvider'

import { ZopkitRoundLoader } from '@/components/common/feedback/ZopkitRoundLoader'
import { NewVersionBanner } from '@/components/NewVersionBanner'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { PermissionGuard } from '@/components/auth/PermissionGuard'
import { OnboardingGuard, OnboardingPageGuard } from '@/features/onboarding/indexOptimized'
import { UserManagementProvider } from '@/features/users/components/context/UserManagementContext'
import { ErrorBoundary } from '@/errors/ErrorBoundary'
import SilentAuthGuard from '@/components/auth/SilentAuthGuard'
import { UserContextProvider } from '@/contexts/UserContextProvider'
import { EntityScopeProvider } from '@/contexts/EntityScopeContext'

import { RootRedirect } from './RootRedirect'
import {
  Landing, ProductPage, IndustryPage, PrivacyPolicy, TermsOfService,
  CookiePolicy, Security, Pricing, Login, AuthCallback, InviteAccept,
  OnboardingPage, PaymentSuccess, PaymentCancelled, PaymentDetailsPage,
  BillingUpgradePage, Billing, SuiteDashboard, ActivityDashboard,
  ApplicationPage, ApplicationDetailsPage, UserManagementDashboard,
  InviteUserPage, UserDetailsPage, UserApplicationAccessPage,
  RolesPage, RoleDetailsPage, RoleBuilderPage, OrganizationPage, OrganizationCreatePage,
  Permissions, Settings, AdminDashboardPage, TenantDetailsPage,
  CampaignDetailsPage, NotFound,
} from './lazyPages'

function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="text-center flex flex-col items-center">
        <ZopkitRoundLoader size="page" className="mb-6" />
        <p className="text-gray-600 dark:text-gray-300 text-base font-medium">
          Your data is loading...
        </p>
      </div>
    </div>
  )
}

function PaymentSuccessErrorFallback() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-xl border border-slate-200 bg-white p-6 shadow-xl text-center">
        <p className="text-slate-900 font-bold mb-2">Something went wrong</p>
        <p className="text-slate-600 text-sm mb-6">
          The payment success page could not load. Your payment may still have gone through.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => navigate({ to: '/dashboard/billing' })}
            className="w-full rounded-lg bg-blue-600 py-3 px-4 text-white font-semibold hover:bg-blue-700"
          >
            Return to Billing
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full rounded-lg border border-slate-300 py-3 px-4 text-slate-700 font-medium hover:bg-slate-50"
          >
            Refresh page
          </button>
        </div>
      </div>
    </div>
  )
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const ctx = useUserContextSafe()
  const user = ctx?.user ?? null

  if (ctx?.loading) return <LoadingScreen />
  if (user && !user.isTenantAdmin) {
    return <Navigate to="/dashboard/applications" />
  }
  return <>{children}</>
}

function RootLayout() {
  const { isAuthenticated, isLoading } = useKindeAuth()

  const authState = useMemo(
    () => ({ isAuthenticated: !!isAuthenticated, isLoading: !!isLoading }),
    [isAuthenticated, isLoading],
  )

  if (authState.isLoading) {
    return <LoadingScreen />
  }

  return (
    <SilentAuthGuard>
      <UserContextProvider>
        <EntityScopeProvider>
          <div className="App">
            <NewVersionBanner />
            <Suspense fallback={<LoadingScreen />}>
              <Outlet />
            </Suspense>
          </div>
        </EntityScopeProvider>
      </UserContextProvider>
    </SilentAuthGuard>
  )
}

function AuthRedirectLanding() {
  const { isAuthenticated } = useKindeAuth()
  if (isAuthenticated) return <Navigate to="/" />
  return <Landing />
}

// ---------------------------------------------------------------------------
// Route Tree
// ---------------------------------------------------------------------------

const rootRoute = createRootRoute({
  validateSearch: (search: Record<string, unknown>) => search,
  component: RootLayout,
})

// Public
const landingRoute = createRoute({ getParentRoute: () => rootRoute, path: '/landing', component: AuthRedirectLanding })
const productRoute = createRoute({ getParentRoute: () => rootRoute, path: '/products/$productId', component: ProductPage })
const industryRoute = createRoute({ getParentRoute: () => rootRoute, path: '/industries/$industrySlug', component: IndustryPage })
const privacyRoute = createRoute({ getParentRoute: () => rootRoute, path: '/privacy', component: PrivacyPolicy })
const termsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/terms', component: TermsOfService })
const cookiesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/cookies', component: CookiePolicy })
const securityRoute = createRoute({ getParentRoute: () => rootRoute, path: '/security', component: Security })
const pricingRoute = createRoute({ getParentRoute: () => rootRoute, path: '/pricing', component: Pricing })

// Auth
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: RootRedirect })
const loginRoute = createRoute({ getParentRoute: () => rootRoute, path: '/login', component: Login })
const authCallbackRoute = createRoute({ getParentRoute: () => rootRoute, path: '/auth/callback', component: AuthCallback })
const inviteAcceptRoute = createRoute({ getParentRoute: () => rootRoute, path: '/invite/accept', component: InviteAccept })
const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/onboarding',
  component: () => (
    <OnboardingPageGuard>
      <OnboardingPage />
    </OnboardingPageGuard>
  ),
})

// Payment
const paymentSuccessRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/payment-success',
  component: () => (
    <ProtectedRoute>
      <ErrorBoundary fallback={<PaymentSuccessErrorFallback />}>
        <PaymentSuccess />
      </ErrorBoundary>
    </ProtectedRoute>
  ),
})
const paymentCancelledRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/payment-cancelled',
  component: () => (
    <ProtectedRoute>
      <PaymentCancelled />
    </ProtectedRoute>
  ),
})

// Suite
const suiteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/suite',
  component: () => (
    <ProtectedRoute>
      <SuiteDashboard />
    </ProtectedRoute>
  ),
})

// Dashboard layout
const dashboardLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: () => (
    <ProtectedRoute>
      <OnboardingGuard>
        <DashboardLayout />
      </OnboardingGuard>
    </ProtectedRoute>
  ),
})

const dashboardIndexRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: '/', component: ApplicationPage })
const dashboardApplicationsRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: '/applications', component: ApplicationPage })
const dashboardAppDetailRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: '/applications/$appId', component: ApplicationDetailsPage })
const dashboardUsersInviteRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/users/invite',
  component: () => <AdminRoute><UserManagementProvider><InviteUserPage /></UserManagementProvider></AdminRoute>,
})
const dashboardUserDetailRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: '/users/$userId', component: () => <AdminRoute><UserDetailsPage /></AdminRoute> })
const dashboardUsersRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: '/users', component: () => <AdminRoute><UserManagementDashboard /></AdminRoute> })
const dashboardOrganizationRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: '/organization', component: () => <AdminRoute><OrganizationPage /></AdminRoute> })
const dashboardOrganizationCreateRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: '/organization/create', component: () => <AdminRoute><OrganizationCreatePage /></AdminRoute> })
const dashboardRolesNewRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: '/roles/new', component: () => <AdminRoute><RoleBuilderPage /></AdminRoute> })
const dashboardRolesEditRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: '/roles/$roleId/edit', component: () => <AdminRoute><RoleBuilderPage /></AdminRoute> })
const dashboardRoleDetailRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: '/roles/$roleId', component: () => <AdminRoute><RoleDetailsPage /></AdminRoute> })
const dashboardRolesRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: '/roles', component: () => <AdminRoute><RolesPage /></AdminRoute> })
const dashboardUserAppsRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: '/user-apps', component: UserApplicationAccessPage })
const dashboardBillingPaymentRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: '/billing/payments/$paymentId', component: () => <AdminRoute><PaymentDetailsPage /></AdminRoute> })
const dashboardBillingUpgradeRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: '/billing/upgrade', component: () => <AdminRoute><BillingUpgradePage /></AdminRoute> })
const dashboardBillingRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: '/billing', component: () => <AdminRoute><Billing /></AdminRoute> })
const dashboardPermissionsRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: '/permissions', component: () => <AdminRoute><Permissions /></AdminRoute> })
const dashboardSettingsRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: '/settings', component: () => <AdminRoute><Settings /></AdminRoute> })
const dashboardActivityRoute = createRoute({ getParentRoute: () => dashboardLayoutRoute, path: '/activity', component: () => <AdminRoute><ActivityDashboard /></AdminRoute> })

// Company Admin
const companyAdminTenantRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/company-admin/tenants/$tenantId',
  component: () => (
    <ProtectedRoute skipOnboardingCheck>
      <PermissionGuard requiredPermission="company:admin:access">
        <TenantDetailsPage />
      </PermissionGuard>
    </ProtectedRoute>
  ),
})
const companyAdminCampaignRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/company-admin/campaigns/$campaignId',
  component: () => (
    <ProtectedRoute skipOnboardingCheck>
      <PermissionGuard requiredPermission="company:admin:access">
        <CampaignDetailsPage />
      </PermissionGuard>
    </ProtectedRoute>
  ),
})
const companyAdminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/company-admin',
  component: () => (
    <ProtectedRoute skipOnboardingCheck>
      <PermissionGuard requiredPermission="company:admin:access">
        <AdminDashboardPage />
      </PermissionGuard>
    </ProtectedRoute>
  ),
})

// ---------------------------------------------------------------------------
// Route tree assembly
// ---------------------------------------------------------------------------

const routeTree = rootRoute.addChildren([
  indexRoute,
  landingRoute,
  productRoute,
  industryRoute,
  privacyRoute,
  termsRoute,
  cookiesRoute,
  securityRoute,
  pricingRoute,
  loginRoute,
  authCallbackRoute,
  inviteAcceptRoute,
  onboardingRoute,
  paymentSuccessRoute,
  paymentCancelledRoute,
  suiteRoute,
  dashboardLayoutRoute.addChildren([
    dashboardIndexRoute,
    dashboardApplicationsRoute,
    dashboardAppDetailRoute,
    dashboardUsersInviteRoute,
    dashboardUserDetailRoute,
    dashboardUsersRoute,
    dashboardOrganizationRoute,
    dashboardOrganizationCreateRoute,
    dashboardRolesNewRoute,
    dashboardRolesEditRoute,
    dashboardRoleDetailRoute,
    dashboardRolesRoute,
    dashboardUserAppsRoute,
    dashboardBillingPaymentRoute,
    dashboardBillingUpgradeRoute,
    dashboardBillingRoute,
    dashboardPermissionsRoute,
    dashboardSettingsRoute,
    dashboardActivityRoute,
  ]),
  companyAdminTenantRoute,
  companyAdminCampaignRoute,
  companyAdminRoute,
])

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const router = createRouter({
  routeTree,
  defaultNotFoundComponent: () => (
    <Suspense fallback={<LoadingScreen />}>
      <NotFound />
    </Suspense>
  ),
  defaultPendingComponent: LoadingScreen,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
