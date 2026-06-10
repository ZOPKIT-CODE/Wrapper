import React, { useState, useEffect, useMemo, Suspense } from 'react'
import { ModernSidebar } from '@/components/layout/ModernSidebar'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { BreadcrumbLabelProvider } from '@/contexts/BreadcrumbLabelContext'
import { ErrorBoundary } from '@/errors/ErrorBoundary'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { BillingStatusNavbar } from '@/components/common/billing/BillingStatusNavbar'
import { useSeasonalCreditsCongratulatory } from '@/hooks/useSeasonalCreditsCongratulatory'
import {
  useSubscriptionCurrent,
  useTenantApplications,
} from '@/hooks/useSharedQueries'
import {
  Building2,
  Users,
  Crown,
  Shield,
  Activity,
  CreditCard,
  ChevronRight,
  Settings,
  AlertTriangle,
  LayoutGrid,
} from 'lucide-react'
import {
  useNavigate,
  useLocation,
  useSearch,
  useParams,
  Outlet,
} from '@tanstack/react-router'
import { useOrganizationHierarchy } from '@/hooks/useOrganizationHierarchy'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { useUserContextSafe } from '@/contexts/UserContextProvider'
import { useAuth } from '@/lib/auth/cognito-auth'

const NotificationManager = React.lazy(() =>
  import('@/features/notifications/NotificationManager').then((m) => ({
    default: m.NotificationManager,
  }))
)
const SeasonalCreditsCongratulatoryModal = React.lazy(() =>
  import('@/features/notifications/SeasonalCreditsCongratulatoryModal').then(
    (m) => ({ default: m.SeasonalCreditsCongratulatoryModal })
  )
)

interface TrialInfo {
  plan: string
  endDate: Date
  daysRemaining: number
  checkoutUrl?: string
}

// Minimal shape of an organization-hierarchy entity used by the sidebar transform.
interface HierarchyEntity {
  entityId: string
  entityName: string
  entityType: 'organization' | 'location' | 'department' | 'team' | string
  children?: HierarchyEntity[]
}

interface HierarchyNavItem {
  title: string
  url: string
  icon: React.ElementType
  items?: HierarchyNavItem[]
}

// Transform organization hierarchy into sidebar navigation items
const transformHierarchyToNavItems = (
  hierarchy: HierarchyEntity[],
  baseUrl: string = '/dashboard/organization'
): HierarchyNavItem[] => {
  if (!hierarchy || hierarchy.length === 0) return []

  const transformEntity = (entity: HierarchyEntity): HierarchyNavItem => {
    const getEntityIcon = () => {
      switch (entity.entityType) {
        case 'organization':
          return Building2
        case 'location':
          return Building2
        case 'department':
          return Users
        case 'team':
          return Users
        default:
          return Building2
      }
    }

    const navItem: HierarchyNavItem = {
      title: entity.entityName,
      url: `${baseUrl}?entity=${entity.entityId}`,
      icon: getEntityIcon(),
    }

    // Add children as nested items if they exist
    if (entity.children && entity.children.length > 0) {
      navItem.items = entity.children.map(transformEntity)
    }

    return navItem
  }

  return hierarchy.map(transformEntity)
}

const getOrganizationSidebarData = (
  orgCode: string,
  hierarchy?: HierarchyEntity[],
  userData?: { name: string; email: string; avatar?: string },
  tenantData?: {
    tenantId: string
    companyName: string
    subdomain?: string
    industry?: string
  }
) => {
  const hierarchyNavItems = hierarchy
    ? transformHierarchyToNavItems(hierarchy, `/org/${orgCode}`)
    : []

  // Use real user data or fallback to defaults
  const user = userData || {
    name: 'User',
    email: 'user@example.com',
    avatar: '/avatars/user.jpg',
  }

  // Use real tenant data or fallback to defaults
  const teamName = tenantData?.companyName || orgCode
  const plan = tenantData?.industry || 'Organization'

  return {
    user: {
      name: user.name,
      email: user.email,
      avatar: user.avatar || '/avatars/user.jpg',
    },
    teams: [
      {
        name: teamName,
        logo: Building2,
        plan: plan,
      },
    ],
    navMain: [
      {
        title: 'Organization Hierarchy',
        url: `/org/${orgCode}`,
        icon: Building2,
        items: hierarchyNavItems.length > 0 ? hierarchyNavItems : undefined,
      },
      {
        title: 'Analytics',
        url: `/org/${orgCode}/analytics`,
        icon: Activity,
      },
      {
        title: 'Roles',
        url: `/org/${orgCode}/permissions`,
        icon: Crown,
      },
    ],
    projects: [],
    bottomNav: [
      {
        name: 'Billing',
        url: `/org/${orgCode}/billing`,
        icon: CreditCard,
      },
      {
        name: 'Usage',
        url: `/org/${orgCode}/usage`,
        icon: Activity,
      },
      {
        name: 'Settings',
        url: `/org/${orgCode}/settings`,
        icon: Settings,
      },
    ],
  }
}

const defaultSidebarData = {
  navMain: [
    {
      title: 'Applications',
      url: '/dashboard/applications',
      icon: LayoutGrid,
    },
    {
      title: 'Organization',
      url: '/dashboard/organization',
      icon: Building2,
    },
    {
      title: 'Team',
      url: '/dashboard/users',
      icon: Users,
    },
    {
      title: 'Roles',
      url: '/dashboard/roles',
      icon: Shield,
    },
    {
      title: 'Activity',
      url: '/dashboard/activity',
      icon: Activity,
    },
  ],
  bottomNav: [
    {
      title: 'Billing',
      url: '/dashboard/billing',
      icon: CreditCard,
    },
    {
      title: 'Settings',
      url: '/dashboard/settings',
      icon: Settings,
    },
  ],
}

export function DashboardLayout() {
  const [, setTrialInfo] = useState<TrialInfo | null>(null)
  const [, setShowTrialBanner] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const searchParams = useSearch({ strict: false }) as Record<string, string>
  const params = useParams({ strict: false })

  // Fetch user and tenant data from context (safe: returns null during HMR/init)
  const ctx = useUserContextSafe()
  const user = ctx?.user ?? null
  const tenant = ctx?.tenant ?? null
  const { user: idpUser } = useAuth()

  // Seasonal credits congratulatory popup
  const {
    shouldShowCongratulatory,
    seasonalCreditsData,
    dismissCongratulatory,
  } = useSeasonalCreditsCongratulatory()

  // Subscription status for cancellation banner
  const { data: subscription } = useSubscriptionCurrent()
  const isCancelScheduled =
    subscription?.status === 'active' && !!subscription?.cancelAt
  const isCanceled = subscription?.status === 'canceled'

  // Handle organization switching for tenant admins
  const handleOrganizationSwitch = (_organizationId: string) => {
    // TODO: Implement organization switching logic
    // This would typically involve updating the user context or redirecting to the new organization
  }

  // Debug user context

  // Determine which navigation to use based on current route
  const isOrganizationRoute = location.pathname.startsWith('/org/')
  const orgCode = (params as { orgCode?: string }).orgCode

  // Get tenant ID from context or use default
  const tenantId = user?.tenantId || tenant?.tenantId

  // Fetch organization hierarchy for sidebar when on organization routes
  const { hierarchy: orgHierarchy } = useOrganizationHierarchy(
    isOrganizationRoute ? tenantId : undefined
  )

  const { data: tenantApps } = useTenantApplications(tenantId)

  // Prepare user data for sidebar
  const userData = useMemo(() => {
    if (!user && !idpUser) return undefined

    const idpGivenName = idpUser?.givenName as string | undefined
    const idpEmail = idpUser?.email as string | undefined
    const idpPicture = idpUser?.picture as string | undefined

    return {
      name: user?.name || idpGivenName || idpEmail || 'User',
      email: user?.email || idpEmail || 'user@example.com',
      avatar: idpPicture,
    }
  }, [user, idpUser])

  // Prepare tenant data for sidebar.
  // Only populated once the tenant object arrives — avoids showing the misleading
  // 'Organization' placeholder while auth/tenant queries are still in flight.
  // ModernSidebar falls back to 'Zopkit' when tenantData is undefined.
  const tenantData = useMemo(() => {
    if (!tenant) return undefined

    return {
      tenantId: tenant.tenantId,
      companyName: tenant.companyName || '',
      subdomain: tenant.subdomain,
      industry: tenant.industry,
      logoUrl: tenant.logoUrl,
    }
  }, [tenant])

  // Check for trial information from URL params or localStorage
  useEffect(() => {
    const isTrial = searchParams['trial'] === 'true'
    const plan = searchParams['plan']
    const trialEndDate = localStorage.getItem('trialEndDate')
    const pendingCheckoutUrl = localStorage.getItem('pendingCheckoutUrl')

    if (isTrial || trialEndDate) {
      const endDate = trialEndDate
        ? new Date(trialEndDate)
        : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      const daysRemaining = Math.max(
        0,
        Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      )

      setTrialInfo({
        plan: plan || 'free', // Changed from 'professional' to 'free' for consistency
        endDate,
        daysRemaining,
        checkoutUrl: pendingCheckoutUrl || undefined,
      })
      setShowTrialBanner(true)
    }
  }, [searchParams])

  const sidebarNavData = useMemo(() => {
    if (isOrganizationRoute && orgCode) {
      return getOrganizationSidebarData(
        orgCode,
        orgHierarchy || [],
        userData,
        tenantData
      )
    }
    const appCount = Array.isArray(tenantApps) ? tenantApps.length : undefined
    return {
      ...defaultSidebarData,
      navMain: defaultSidebarData.navMain.map((item) =>
        item.url === '/dashboard/applications'
          ? { ...item, badge: appCount }
          : item
      ),
    }
  }, [
    isOrganizationRoute,
    orgCode,
    orgHierarchy,
    userData,
    tenantData,
    tenantApps,
  ])

  // Applications tab is always the full-page marketplace for every user — admin or
  // member. Admin console features (Organization, Team, Roles…) remain accessible
  // on all other /dashboard/* routes where the sidebar renders normally.
  if (location.pathname === '/dashboard/applications') {
    return (
      <BreadcrumbLabelProvider>
        <ErrorBoundary>
          <Outlet key={location.pathname} />
        </ErrorBoundary>
      </BreadcrumbLabelProvider>
    )
  }

  return (
    <SidebarProvider
      className="dashboard-actionable-cursors dashboard-instant-scroll"
      style={{ background: 'var(--zk-bg)' }}
    >
      <ModernSidebar
        navData={sidebarNavData}
        userData={userData}
        tenantData={tenantData}
        isTenantAdmin={user?.isTenantAdmin || false}
        onOrganizationSwitch={handleOrganizationSwitch}
      />
      <BreadcrumbLabelProvider>
        <SidebarInset
          className="flex h-screen flex-col overflow-hidden md:peer-data-[variant=inset]:m-0 md:peer-data-[variant=inset]:rounded-none md:peer-data-[variant=inset]:shadow-none"
          style={{ background: 'var(--zk-bg)' }}
        >
          <header
            className="flex shrink-0 items-center gap-2 px-6 group-has-data-[collapsible=icon]/sidebar-wrapper:h-12"
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 30,
              height: 60,
              background: 'rgba(248,250,252,0.85)',
              backdropFilter: 'saturate(1.5) blur(14px)',
              WebkitBackdropFilter: 'saturate(1.5) blur(14px)',
              borderBottom: '1px solid var(--zk-line)',
              fontFamily: 'var(--zk-font)',
            }}
          >
            <div className="flex items-center gap-2">
              <SidebarTrigger
                className="-ml-1"
                style={{
                  color: 'var(--zk-muted)',
                  borderRadius: 8,
                  transition: 'all 140ms ease',
                }}
              />
              <nav
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  fontSize: 13,
                  color: 'var(--zk-muted)',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--zk-mono)',
                    fontSize: 11,
                    color: 'var(--zk-muted-2)',
                  }}
                >
                  ~/
                </span>
                <span>workspace</span>
                <ChevronRight
                  size={11}
                  style={{ color: 'var(--zk-muted-2)' }}
                />
                <span style={{ color: 'var(--zk-ink)', fontWeight: 500 }}>
                  {location.pathname.split('/').pop()?.toLowerCase() ||
                    'dashboard'}
                </span>
              </nav>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <Suspense fallback={null}>
                <NotificationManager />
              </Suspense>
              {user?.isTenantAdmin && <BillingStatusNavbar />}
              <ThemeToggle />
            </div>
          </header>

          {/* Subscription cancellation banners */}
          {isCancelScheduled && (
            <div className="flex items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
              <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  Your subscription is scheduled to end on{' '}
                  <strong>{formatDate(subscription.cancelAt)}</strong>. You will
                  retain full access until then.
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900"
                onClick={() =>
                  navigate({
                    to: '/dashboard/billing',
                    search: { tab: 'plans' },
                  })
                }
              >
                Resubscribe
              </Button>
            </div>
          )}
          {isCanceled && (
            <div className="flex items-center justify-between gap-3 border-b border-red-200 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-950/30">
              <div className="flex items-center gap-2 text-sm text-red-800 dark:text-red-200">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  Your subscription has expired. Your data is safe but write
                  access is restricted.
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 border-red-300 text-red-800 hover:bg-red-100 dark:border-red-700 dark:text-red-200 dark:hover:bg-red-900"
                onClick={() =>
                  navigate({
                    to: '/dashboard/billing',
                    search: { tab: 'plans' },
                  })
                }
              >
                Resubscribe Now
              </Button>
            </div>
          )}

          <main
            className="relative min-h-0 flex-1 overflow-y-auto p-7"
            style={{ background: 'var(--zk-bg)' }}
          >
            <ErrorBoundary>
              {/* pathname only: ?tab= and other search updates must not remount the route (e.g. Account Settings tabs). */}
              <Outlet key={location.pathname} />
            </ErrorBoundary>
          </main>
        </SidebarInset>
      </BreadcrumbLabelProvider>

      {shouldShowCongratulatory && (
        <Suspense fallback={null}>
          <SeasonalCreditsCongratulatoryModal
            isOpen={shouldShowCongratulatory}
            onClose={dismissCongratulatory}
            creditsAmount={seasonalCreditsData.totalCredits}
            campaignName={seasonalCreditsData.campaignName}
            modalConfig={seasonalCreditsData.modalConfig}
          />
        </Suspense>
      )}
    </SidebarProvider>
  )
}
