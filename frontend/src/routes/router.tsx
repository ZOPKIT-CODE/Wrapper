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

import { PageLoading } from '@/components/common/feedback/LoadingStates'
import { LegacyLandingRedirect } from './LegacyLandingRedirect'
import { DevOnlyRoute } from './DevOnlyRoute'
import { CompanyAdminGate } from '@/components/auth/CompanyAdminGate'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { MarketingRouteLayout } from '@/components/layout/MarketingRouteLayout'
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
  return <PageLoading message="Your data is loading..." />
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

function TenantAdminRoute({ children }: { children: React.ReactNode }) {
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
const landingV2Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/landing/v2',
  component: LegacyLandingRedirect,
})
const landingClassicRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/landing/classic',
  component: LegacyLandingRedirect,
})
const landingV3Route = createRoute({
  getParentRoute: () => rootRoute,
  path: '/landing/v3',
  component: LegacyLandingRedirect,
})
const marketingLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'marketing',
  component: MarketingRouteLayout,
})

const productRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/products/$productId',
  component: ProductPage,
})
const industryRoute = createRoute({
  getParentRoute: () => marketingLayoutRoute,
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

// Legacy suite launcher — applications hub replaced SuiteDashboard
const suiteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/suite',
  component: () => <Navigate to="/dashboard/applications" replace />,
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
    <TenantAdminRoute>
      <OrganizationPage />
    </TenantAdminRoute>
  ),
})
const dashboardOrganizationCreateRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/organization/create',
  component: () => (
    <TenantAdminRoute>
      <OrganizationCreatePage />
    </TenantAdminRoute>
  ),
})
const dashboardRolesNewRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/roles/new',
  component: () => (
    <TenantAdminRoute>
      <RoleBuilderPage />
    </TenantAdminRoute>
  ),
})
const dashboardRolesEditRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/roles/$roleId/edit',
  component: () => (
    <TenantAdminRoute>
      <RoleBuilderPage />
    </TenantAdminRoute>
  ),
})
const dashboardRoleDetailRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/roles/$roleId',
  component: () => (
    <TenantAdminRoute>
      <RoleDetailsPage />
    </TenantAdminRoute>
  ),
})
const dashboardRolesRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/roles',
  component: () => (
    <TenantAdminRoute>
      <RolesPage />
    </TenantAdminRoute>
  ),
})
const dashboardBillingPaymentRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/billing/payments/$paymentId',
  component: () => (
    <TenantAdminRoute>
      <PaymentDetailsPage />
    </TenantAdminRoute>
  ),
})
const dashboardBillingUpgradeRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/billing/upgrade',
  component: () => (
    <TenantAdminRoute>
      <BillingUpgradePage />
    </TenantAdminRoute>
  ),
})
const dashboardBillingRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/billing',
  component: () => (
    <TenantAdminRoute>
      <Billing />
    </TenantAdminRoute>
  ),
})
const dashboardPermissionsRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/permissions',
  component: () => (
    <TenantAdminRoute>
      <Permissions />
    </TenantAdminRoute>
  ),
})
const dashboardSettingsRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/settings',
  component: () => (
    <TenantAdminRoute>
      <Settings />
    </TenantAdminRoute>
  ),
})
const dashboardUsersRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/users',
  component: () => (
    <TenantAdminRoute>
      <UserManagementPage />
    </TenantAdminRoute>
  ),
})
const dashboardActivityRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/activity',
  component: () => (
    <TenantAdminRoute>
      <ActivityPage />
    </TenantAdminRoute>
  ),
})

// Public blog READER on the marketing site (read-only).
const blogListRoute = createRoute({
  getParentRoute: () => marketingLayoutRoute,
  path: '/blog',
  component: PublicBlogListPage,
})
const blogTagRoute = createRoute({
  getParentRoute: () => marketingLayoutRoute,
  path: '/blog/tag/$tag',
  component: PublicBlogTagPage,
})
const blogSeriesRoute = createRoute({
  getParentRoute: () => marketingLayoutRoute,
  path: '/blog/series/$slug',
  component: PublicBlogSeriesPage,
})
const blogPostRoute = createRoute({
  getParentRoute: () => marketingLayoutRoute,
  path: '/blog/$slug',
  component: PublicBlogPostPage,
})
// Blog AUTHORING lives in the company admin area (list is a tab in AdminDashboard).
const companyAdminBlogNewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/company-admin/blog/new',
  component: () => (
    <CompanyAdminGate>
      <BlogEditorPage />
    </CompanyAdminGate>
  ),
})
const companyAdminBlogEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/company-admin/blog/$postId/edit',
  component: () => (
    <CompanyAdminGate>
      <BlogEditorPage />
    </CompanyAdminGate>
  ),
})

const companyAdminTenantRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/company-admin/tenants/$tenantId',
  component: () => (
    <CompanyAdminGate>
      <TenantDetailsPage />
    </CompanyAdminGate>
  ),
})
const companyAdminCampaignRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/company-admin/campaigns/$campaignId',
  component: () => (
    <CompanyAdminGate>
      <CampaignDetailsPage />
    </CompanyAdminGate>
  ),
})
const companyAdminCreateCampaignRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/company-admin/seasonal-credits/new',
  component: () => (
    <CompanyAdminGate>
      <CreateCampaignPage />
    </CompanyAdminGate>
  ),
})
const companyAdminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/company-admin',
  component: () => (
    <CompanyAdminGate>
      <AdminDashboardPage />
    </CompanyAdminGate>
  ),
})

// Dev tools
const devEmailPreviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dev/email-preview',
  component: () => (
    <DevOnlyRoute>
      <EmailPreviewPage />
    </DevOnlyRoute>
  ),
})
const devInvitePreviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/dev/invite-preview',
  component: () => (
    <DevOnlyRoute>
      <InviteAcceptDemo />
    </DevOnlyRoute>
  ),
})

// ---------------------------------------------------------------------------
// Route tree assembly
// ---------------------------------------------------------------------------

const routeTree = rootRoute.addChildren([
  indexRoute,
  landingRoute,
  landingV2Route,
  landingClassicRoute,
  landingV3Route,
  marketingLayoutRoute.addChildren([
    industryRoute,
    blogListRoute,
    blogTagRoute,
    blogSeriesRoute,
    blogPostRoute,
  ]),
  productRoute,
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
