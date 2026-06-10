import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  Navigate,
  useNavigate,
} from '@tanstack/react-router'
import { Suspense, useMemo } from 'react'
import { useAuth } from '@/lib/auth/cognito-auth'
import { useUserContextSafe } from '@/contexts/UserContextProvider'

import { ZopkitRoundLoader } from '@/components/common/feedback/ZopkitRoundLoader'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { OnboardingGuard, OnboardingPageGuard } from '@/features/onboarding'
import { ErrorBoundary } from '@/errors/ErrorBoundary'
import SilentAuthGuard from '@/components/auth/SilentAuthGuard'
import { UserContextProvider } from '@/contexts/UserContextProvider'
import { EntityScopeProvider } from '@/contexts/EntityScopeContext'

import { RootRedirect } from './RootRedirect'
import { OnboardingHintBanner } from '@/components/OnboardingHintBanner'
import {
  Landing,
  ProductPage,
  IndustryPage,
  PrivacyPolicy,
  TermsOfService,
  CookiePolicy,
  RefundPolicy,
  Security,
  Pricing,
  Login,
  AuthCallback,
  InviteAccept,
  OnboardingPage,
  PaymentSuccess,
  PaymentCancelled,
  PaymentDetailsPage,
  BillingUpgradePage,
  Billing,
  SuiteDashboard,
  ActivityPage,
  ApplicationPage,
  ApplicationDetailsPage,
  RolesPage,
  RoleDetailsPage,
  RoleBuilderPage,
  UserManagementPage,
  OrganizationPage,
  OrganizationCreatePage,
  Permissions,
  Settings,
  AdminDashboardPage,
  TenantDetailsPage,
  CampaignDetailsPage,
  CreateCampaignPage,
  EmailPreviewPage,
  InviteAcceptDemo,
  NotFound,
  PublicBlogListPage,
  PublicBlogPostPage,
  PublicBlogTagPage,
  PublicBlogSeriesPage,
  BlogEditorPage,
} from './lazyPages'

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="flex flex-col items-center text-center">
        <ZopkitRoundLoader size="page" className="mb-6" />
        <p className="text-base font-medium text-gray-600 dark:text-gray-300">
          Your data is loading...
        </p>
      </div>
    </div>
  )
}

function PaymentSuccessErrorFallback() {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-xl">
        <p className="mb-2 font-bold text-slate-900">Something went wrong</p>
        <p className="mb-6 text-sm text-slate-600">
          The payment success page could not load. Your payment may still have
          gone through.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => navigate({ to: '/dashboard/billing' })}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700"
          >
            Return to Billing
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full rounded-lg border border-slate-300 px-4 py-3 font-medium text-slate-700 hover:bg-slate-50"
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

/** `/dashboard` should land on the applications hub (same as `/dashboard/applications`). */
function DashboardIndexRedirect() {
  return <Navigate to="/dashboard/applications" replace />
}

function RootLayout() {
  const { isAuthenticated, isLoading } = useAuth()

  const authState = useMemo(
    () => ({ isAuthenticated: !!isAuthenticated, isLoading: !!isLoading }),
    [isAuthenticated, isLoading]
  )

  if (authState.isLoading) {
    return <LoadingScreen />
  }

  return (
    <SilentAuthGuard>
      <UserContextProvider>
        <EntityScopeProvider>
          <OnboardingHintBanner />
          <div className="App">
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
  const { isAuthenticated } = useAuth()
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
const landingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/landing',
  component: AuthRedirectLanding,
})
const productRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/products/$productId',
  component: ProductPage,
})
const industryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/industries/$industrySlug',
  component: IndustryPage,
})
const privacyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/privacy',
  component: PrivacyPolicy,
})
const termsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/terms',
  component: TermsOfService,
})
const cookiesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cookies',
  component: CookiePolicy,
})
const refundPolicyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/refund-policy',
  component: RefundPolicy,
})
const securityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/security',
  component: Security,
})
const pricingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/pricing',
  component: Pricing,
})

// Auth
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: RootRedirect,
})
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: Login,
})
const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/auth/callback',
  component: AuthCallback,
})
const inviteAcceptRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/invite/accept',
  component: InviteAccept,
})
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

const dashboardIndexRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/',
  component: DashboardIndexRedirect,
})
const dashboardApplicationsRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/applications',
  component: ApplicationPage,
})
const dashboardAppDetailRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/applications/$appId',
  component: ApplicationDetailsPage,
})
const dashboardOrganizationRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/organization',
  component: () => (
    <AdminRoute>
      <OrganizationPage />
    </AdminRoute>
  ),
})
const dashboardOrganizationCreateRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/organization/create',
  component: () => (
    <AdminRoute>
      <OrganizationCreatePage />
    </AdminRoute>
  ),
})
const dashboardRolesNewRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/roles/new',
  component: () => (
    <AdminRoute>
      <RoleBuilderPage />
    </AdminRoute>
  ),
})
const dashboardRolesEditRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/roles/$roleId/edit',
  component: () => (
    <AdminRoute>
      <RoleBuilderPage />
    </AdminRoute>
  ),
})
const dashboardRoleDetailRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/roles/$roleId',
  component: () => (
    <AdminRoute>
      <RoleDetailsPage />
    </AdminRoute>
  ),
})
const dashboardRolesRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/roles',
  component: () => (
    <AdminRoute>
      <RolesPage />
    </AdminRoute>
  ),
})
const dashboardBillingPaymentRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/billing/payments/$paymentId',
  component: () => (
    <AdminRoute>
      <PaymentDetailsPage />
    </AdminRoute>
  ),
})
const dashboardBillingUpgradeRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/billing/upgrade',
  component: () => (
    <AdminRoute>
      <BillingUpgradePage />
    </AdminRoute>
  ),
})
const dashboardBillingRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/billing',
  component: () => (
    <AdminRoute>
      <Billing />
    </AdminRoute>
  ),
})
const dashboardPermissionsRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/permissions',
  component: () => (
    <AdminRoute>
      <Permissions />
    </AdminRoute>
  ),
})
const dashboardSettingsRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/settings',
  component: () => (
    <AdminRoute>
      <Settings />
    </AdminRoute>
  ),
})
const dashboardUsersRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/users',
  component: () => (
    <AdminRoute>
      <UserManagementPage />
    </AdminRoute>
  ),
})
const dashboardActivityRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/activity',
  component: () => (
    <AdminRoute>
      <ActivityPage />
    </AdminRoute>
  ),
})

// Public blog READER on the marketing site (read-only).
const blogListRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/blog',
  component: PublicBlogListPage,
})
const blogTagRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/blog/tag/$tag',
  component: PublicBlogTagPage,
})
const blogSeriesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/blog/series/$slug',
  component: PublicBlogSeriesPage,
})
const blogPostRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/blog/$slug',
  component: PublicBlogPostPage,
})
// Blog AUTHORING lives in the company admin area (list is a tab in AdminDashboard).
const companyAdminBlogNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/company-admin/blog/new',
  component: BlogEditorPage,
})
const companyAdminBlogEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/company-admin/blog/$postId/edit',
  component: BlogEditorPage,
})

// Company Admin (auth wrappers commented out for local/dev access — restore before production)
const companyAdminTenantRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/company-admin/tenants/$tenantId',
  component: () => (
    // <ProtectedRoute skipOnboardingCheck>
    //   <PermissionGuard requiredPermission="company:admin:access">
    <TenantDetailsPage />
    //   </PermissionGuard>
    // </ProtectedRoute>
  ),
})
const companyAdminCampaignRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/company-admin/campaigns/$campaignId',
  component: () => (
    // <ProtectedRoute skipOnboardingCheck>
    //   <PermissionGuard requiredPermission="company:admin:access">
    <CampaignDetailsPage />
    //   </PermissionGuard>
    // </ProtectedRoute>
  ),
})
const companyAdminCreateCampaignRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/company-admin/seasonal-credits/new',
  component: () => <CreateCampaignPage />,
})
const companyAdminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/company-admin',
  component: () => (
    // <ProtectedRoute skipOnboardingCheck>
    //   <PermissionGuard requiredPermission="company:admin:access">
    <AdminDashboardPage />
    //   </PermissionGuard>
    // </ProtectedRoute>
  ),
})

// Dev tools
const devEmailPreviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dev/email-preview',
  component: EmailPreviewPage,
})
const devInvitePreviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dev/invite-preview',
  component: InviteAcceptDemo,
})

// ---------------------------------------------------------------------------
// Route tree assembly
// ---------------------------------------------------------------------------

const routeTree = rootRoute.addChildren([
  indexRoute,
  landingRoute,
  landingV2Route,
  productRoute,
  industryRoute,
  privacyRoute,
  termsRoute,
  cookiesRoute,
  refundPolicyRoute,
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
    dashboardOrganizationRoute,
    dashboardOrganizationCreateRoute,
    dashboardRolesNewRoute,
    dashboardRolesEditRoute,
    dashboardRoleDetailRoute,
    dashboardRolesRoute,
    dashboardBillingPaymentRoute,
    dashboardBillingUpgradeRoute,
    dashboardBillingRoute,
    dashboardPermissionsRoute,
    dashboardSettingsRoute,
    dashboardUsersRoute,
    dashboardActivityRoute,
  ]),
  blogListRoute,
  blogTagRoute,
  blogSeriesRoute,
  blogPostRoute,
  companyAdminBlogNewRoute,
  companyAdminBlogEditRoute,
  companyAdminTenantRoute,
  companyAdminCampaignRoute,
  companyAdminCreateCampaignRoute,
  companyAdminRoute,
  devEmailPreviewRoute,
  devInvitePreviewRoute,
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
