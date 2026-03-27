import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from "react"
import { ModernSidebar } from "@/components/layout/ModernSidebar"
import { RouteBreadcrumb } from "@/components/route-breadcrumb"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/theme/ThemeToggle"
import { BreadcrumbLabelProvider } from "@/contexts/BreadcrumbLabelContext"
import { ErrorBoundary } from "@/errors/ErrorBoundary"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { BillingStatusNavbar } from "@/components/common/billing/BillingStatusNavbar"
import { useSeasonalCreditsCongratulatory } from "@/hooks/useSeasonalCreditsCongratulatory"
import { Home, Building2, Users, Crown, Shield, Activity, CreditCard, Clock, X, Zap, ChevronRight, Settings, BookOpen } from "lucide-react"
import { useNavigate, useLocation, useSearch, useParams, Outlet, Link } from "@tanstack/react-router"
import { useOrganizationHierarchy } from "@/hooks/useOrganizationHierarchy"
import { Button } from "@/components/ui/button"
import { PearlButton } from "@/components/ui/pearl-button"
import Pattern from "@/components/ui/pattern-background"
import { cn } from "@/lib/utils"
import { useTheme } from "@/components/theme/ThemeProvider"
import { useUserContextSafe } from "@/contexts/UserContextProvider"
import { useKindeAuth } from "@kinde-oss/kinde-auth-react"

const DashboardFeatureTour = React.lazy(() =>
  import("@/features/dashboard/DashboardFeatureTour").then(m => ({ default: m.DashboardFeatureTour }))
)
const NotificationManager = React.lazy(() =>
  import("@/features/notifications/NotificationManager").then(m => ({ default: m.NotificationManager }))
)
const SeasonalCreditsCongratulatoryModal = React.lazy(() =>
  import("@/features/notifications/SeasonalCreditsCongratulatoryModal").then(m => ({ default: m.SeasonalCreditsCongratulatoryModal }))
)
const FloatingDock = React.lazy(() =>
  import("@/components/ui/floating-dock").then(m => ({ default: m.FloatingDock }))
)

interface TrialInfo {
  plan: string
  endDate: Date
  daysRemaining: number
  checkoutUrl?: string
}

interface NavItem {
  name: string
  href: string
  icon: any
  children?: NavItem[]
}

const getDashboardNavigation = (): NavItem[] => [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: Home,
    children: [
      { name: 'Applications', href: '/dashboard/applications', icon: Building2 },
      { name: 'Team', href: '/dashboard/users', icon: Users },
      { name: 'Roles', href: '/dashboard/roles', icon: Crown },

      { name: 'App Management', href: '/dashboard/user-application-management', icon: Shield },

      { name: 'Analytics', href: '/dashboard/analytics', icon: Activity },
    ]
  },
  { name: 'Billing', href: '/dashboard/billing', icon: CreditCard },
  { name: 'Usage', href: '/dashboard/usage', icon: Activity },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

const getOrganizationNavigation = (orgCode: string): NavItem[] => [
  {
    name: 'Dashboard',
    href: `/org/${orgCode}`,
    icon: Home,
    children: [
      { name: 'Analytics', href: `/org/${orgCode}/analytics`, icon: Activity },
      { name: 'Users', href: `/org/${orgCode}/users`, icon: Users },
      { name: 'Roles', href: `/org/${orgCode}/permissions`, icon: Crown },
      { name: 'App Management', href: `/org/${orgCode}/user-application-management`, icon: Shield },
    ]
  },
  { name: 'Billing', href: `/org/${orgCode}/billing`, icon: CreditCard },
  { name: 'Usage', href: `/org/${orgCode}/usage`, icon: Activity },
  { name: 'Settings', href: `/org/${orgCode}/settings`, icon: Settings },
]

// Transform organization hierarchy into sidebar navigation items
const transformHierarchyToNavItems = (hierarchy: any[], baseUrl: string = '/dashboard/organization') => {
  if (!hierarchy || hierarchy.length === 0) return [];

  const transformEntity = (entity: any): any => {
    const getEntityIcon = () => {
      switch (entity.entityType) {
        case 'organization': return Building2;
        case 'location': return Building2;
        case 'department': return Users;
        case 'team': return Users;
        default: return Building2;
      }
    };

    const navItem: any = {
      title: entity.entityName,
      url: `${baseUrl}?entity=${entity.entityId}`,
      icon: getEntityIcon(),
    };

    // Add children as nested items if they exist
    if (entity.children && entity.children.length > 0) {
      navItem.items = entity.children.map(transformEntity);
    }

    return navItem;
  };

  return hierarchy.map(transformEntity);
};

const getOrganizationSidebarData = (
  orgCode: string,
  hierarchy?: any[],
  userData?: { name: string; email: string; avatar?: string },
  tenantData?: { tenantId: string; companyName: string; subdomain?: string; industry?: string }
) => {
  const hierarchyNavItems = hierarchy ? transformHierarchyToNavItems(hierarchy, `/org/${orgCode}`) : [];

  // Use real user data or fallback to defaults
  const user = userData || {
    name: "User",
    email: "user@example.com",
    avatar: "/avatars/user.jpg",
  };

  // Use real tenant data or fallback to defaults
  const teamName = tenantData?.companyName || orgCode;
  const plan = tenantData?.industry || "Organization";

  return {
    user: {
      name: user.name,
      email: user.email,
      avatar: user.avatar || "/avatars/user.jpg",
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
        title: "Organization Hierarchy",
        url: `/org/${orgCode}`,
        icon: Building2,
        items: hierarchyNavItems.length > 0 ? hierarchyNavItems : undefined,
      },
      {
        title: "Analytics",
        url: `/org/${orgCode}/analytics`,
        icon: Activity,
      },
      {
        title: "Team",
        url: `/org/${orgCode}/users`,
        icon: Users,
      },
      {
        title: "Roles",
        url: `/org/${orgCode}/permissions`,
        icon: Crown,
      },
      {
        title: "App Management",
        url: `/org/${orgCode}/user-application-management`,
        icon: Shield,
      },
    ],
    projects: [],
    bottomNav: [
      {
        name: "Billing",
        url: `/org/${orgCode}/billing`,
        icon: CreditCard,
      },
      {
        name: "Usage",
        url: `/org/${orgCode}/usage`,
        icon: Activity,
      },
      {
        name: "Settings",
        url: `/org/${orgCode}/settings`,
        icon: Settings,
      },
    ],
  };
}

const getFloatingDockNavigation = (isOrganizationRoute: boolean, orgCode?: string, onNavigate?: (href: string) => void) => {
  const navItems: NavItem[] = isOrganizationRoute && orgCode
    ? getOrganizationNavigation(orgCode)
    : getDashboardNavigation()

  // Flatten navigation items for FloatingDock (exclude nested children for simplicity)
  const flattenedItems = navItems.flatMap((item: NavItem) => {
    const baseItem = {
      title: item.name,
      icon: (
        <item.icon className="h-full w-full text-neutral-500 dark:text-neutral-300" />
      ),
      href: item.href,
      onClick: onNavigate ? () => onNavigate(item.href) : undefined,
    }

    // If item has children, include them as separate items
    if (item.children && item.children.length > 0) {
      return [
        baseItem,
        ...item.children.map((child: NavItem) => ({
          title: child.name,
          icon: (
            <child.icon className="h-full w-full text-neutral-500 dark:text-neutral-300" />
          ),
          href: child.href,
          onClick: onNavigate ? () => onNavigate(child.href) : undefined,
        }))
      ]
    }

    return [baseItem]
  })

  return flattenedItems
}

const defaultSidebarData = {
  navMain: [
    {
      title: "Applications",
      url: "/dashboard/applications",
      icon: Building2,
    },
    {
      title: "Team",
      url: "/dashboard/users",
      icon: Users,
    },
    {
      title: "Organization",
      url: "/dashboard/organization",
      icon: Building2,
    },
    {
      title: "Roles",
      url: "/dashboard/roles",
      icon: Crown,
    },
    {
      title: "Activity",
      url: "/dashboard/activity",
      icon: Activity,
    },
  ],
  bottomNav: [
    {
      name: "Billing",
      url: "/dashboard/billing",
      icon: CreditCard,
    },
    {
      name: "Tour",
      url: "", // Will be set dynamically
      icon: BookOpen,
    },
    {
      name: "Settings",
      url: "/dashboard/settings",
      icon: Settings,
    },
  ]
};

export function DashboardLayout() {
  const { actualTheme } = useTheme()
  const [expandedItems, setExpandedItems] = useState<string[]>(['Dashboard'])
  const [trialInfo, setTrialInfo] = useState<TrialInfo | null>(null)
  const [showTrialBanner, setShowTrialBanner] = useState(false)
  const [showTour, setShowTour] = useState(false)
  const [showResumePrompt, setShowResumePrompt] = useState(false)
  const [navigationMode] = useState<'traditional' | 'dock'>(
    (localStorage.getItem('navigation-mode') as 'traditional' | 'dock') || 'traditional'
  )
  const { glassmorphismEnabled } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const searchParams = useSearch({ strict: false }) as Record<string, string>
  const params = useParams({ strict: false })

  // Compute initial step from pathname for contextual start
  const getInitialStep = useCallback(() => {
    const path = location.pathname;
    if (path.includes('/dashboard/billing')) return 3; // Billing & Credits
    if (path.includes('/dashboard/users')) return 1; // Team
    if (path.includes('/dashboard/roles')) return 2; // Roles & Permissions
    return 0; // Applications (default)
  }, [location.pathname]);

  // Show dashboard feature tour after onboarding (user guide) or replay
  useEffect(() => {
    const tourCompleted = localStorage.getItem('dashboard-tour-completed');
    const onboardingComplete = searchParams['onboarding'] === 'complete';
    const tourReplay = searchParams['tour'] === 'replay';
    
    if (tourReplay) {
      // Clear completion flag and show tour
      localStorage.removeItem('dashboard-tour-completed');
      localStorage.removeItem('dashboard-tour-dismissed');
      localStorage.removeItem('dashboard-tour-step');
      setShowTour(true);
      // Remove tour param from URL
      const prev = (location.search || {}) as Record<string, string>;
      const next = { ...prev };
      delete next.tour;
      navigate({ to: location.pathname, search: next, replace: true });
    } else if (!tourCompleted && onboardingComplete) {
      setShowTour(true);
    }
  }, [searchParams, location, navigate]);

  // Check for resume prompt
  useEffect(() => {
    const tourCompleted = localStorage.getItem('dashboard-tour-completed');
    const tourDismissed = localStorage.getItem('dashboard-tour-dismissed');
    const onboardingComplete = searchParams['onboarding'] === 'complete';
    const tourReplay = searchParams['tour'] === 'replay';
    
    if (!tourCompleted && tourDismissed && !onboardingComplete && !tourReplay && !showTour) {
      setShowResumePrompt(true);
    }
  }, [searchParams, showTour]);

  const handleTourComplete = useCallback(() => {
    setShowTour(false);
    const prev = (location.search || {}) as Record<string, string>;
    const next = { ...prev };
    delete next.onboarding;
    navigate({ to: location.pathname, search: next, replace: true });
  }, [location, navigate]);

  const handleTourSkip = useCallback(() => {
    setShowTour(false);
    const prev = (location.search || {}) as Record<string, string>;
    const next = { ...prev };
    delete next.onboarding;
    navigate({ to: location.pathname, search: next, replace: true });
  }, [location, navigate]);

  const handleTourDismiss = useCallback((stepIndex: number) => {
    // Already handled in DashboardFeatureTour (saves to localStorage)
    setShowTour(false);
    handleTourSkip();
  }, [handleTourSkip]);

  const handleResumeChoice = useCallback((action: 'resume' | 'restart' | 'dismiss') => {
    setShowResumePrompt(false);
    
    if (action === 'resume') {
      // Keep saved step, tour will read it
      localStorage.removeItem('dashboard-tour-dismissed');
      setShowTour(true);
    } else if (action === 'restart') {
      localStorage.removeItem('dashboard-tour-step');
      localStorage.removeItem('dashboard-tour-dismissed');
      setShowTour(true);
    } else if (action === 'dismiss') {
      localStorage.setItem('dashboard-tour-completed', 'true');
      localStorage.removeItem('dashboard-tour-step');
      localStorage.removeItem('dashboard-tour-dismissed');
    }
  }, []);

  // Fetch user and tenant data from context (safe: returns null during HMR/init)
  const ctx = useUserContextSafe()
  const user = ctx?.user ?? null
  const tenant = ctx?.tenant ?? null
  const { user: kindeUser } = useKindeAuth()

  // Seasonal credits congratulatory popup
  const {
    shouldShowCongratulatory,
    seasonalCreditsData,
    dismissCongratulatory
  } = useSeasonalCreditsCongratulatory()

  // Handle organization switching for tenant admins
  const handleOrganizationSwitch = (organizationId: string) => {
    // TODO: Implement organization switching logic
    // This would typically involve updating the user context or redirecting to the new organization
  };

  // Debug user context

  // Handle navigation for dock/sidebar modes to avoid full page reloads
  const handleDockNavigation = (href: string) => {
    navigate({ to: href })
  }

  // Determine which navigation to use based on current route
  const isOrganizationRoute = location.pathname.startsWith('/org/')
  const orgCode = params.orgCode

  // Get tenant ID from context or use default
  const tenantId = user?.tenantId || tenant?.tenantId

  // Fetch organization hierarchy for sidebar when on organization routes
  const { hierarchy: orgHierarchy } = useOrganizationHierarchy(
    isOrganizationRoute ? tenantId : undefined
  )

  // Prepare user data for sidebar
  const userData = useMemo(() => {
    if (!user && !kindeUser) return undefined;

    return {
      name: user?.name || kindeUser?.givenName || kindeUser?.email || 'User',
      email: user?.email || kindeUser?.email || 'user@example.com',
      avatar: kindeUser?.picture,
    };
  }, [user, kindeUser])

  // Prepare tenant data for sidebar
  const tenantData = useMemo(() => {
    if (!tenant && !user) return undefined;

    return {
      tenantId: tenant?.tenantId || user?.tenantId || '',
      companyName: tenant?.companyName || 'Organization',
      subdomain: tenant?.subdomain,
      industry: tenant?.industry,
    };
  }, [tenant, user])

  // Check for trial information from URL params or localStorage
  useEffect(() => {
    const isTrial = searchParams['trial'] === 'true'
    const plan = searchParams['plan']
    const trialEndDate = localStorage.getItem('trialEndDate')
    const pendingCheckoutUrl = localStorage.getItem('pendingCheckoutUrl')

    if (isTrial || trialEndDate) {
      const endDate = trialEndDate ? new Date(trialEndDate) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))

      setTrialInfo({
        plan: plan || 'free', // Changed from 'professional' to 'free' for consistency
        endDate,
        daysRemaining,
        checkoutUrl: pendingCheckoutUrl || undefined
      })
      setShowTrialBanner(true)
    }
  }, [searchParams])

  // Force component re-mounting when navigation changes to prevent stale state
  const navigationKey = useRef(0)
  useEffect(() => {
    // Increment key to force re-mounting of child components
    navigationKey.current += 1

    // Clear any potential stale state by triggering garbage collection hint
    if (window.gc && typeof window.gc === 'function') {
      window.gc()
    }
  }, [location.pathname, location.searchStr])

  const handleUpgradeNow = () => {
    const checkoutUrl = localStorage.getItem('pendingCheckoutUrl')
    if (checkoutUrl) {
      window.location.href = checkoutUrl
    } else {
      navigate({ to: '/dashboard/billing' })
    }
  }

  const dismissTrialBanner = () => {
    setShowTrialBanner(false)
  }

  const toggleExpanded = (itemName: string) => {
    setExpandedItems(prev =>
      prev.includes(itemName)
        ? prev.filter(name => name !== itemName)
        : [...prev, itemName]
    )
  }

  const isActive = (href: string) => {
    // For dashboard children, check if the current path starts with the parent path
    // and the specific child path matches
    if (href.startsWith('/dashboard/') || href.startsWith('/org/')) {
      return location.pathname === href
    }
    return location.pathname === href
  }

  const renderNavigationItem = (item: NavItem, isChild = false) => {
    const active = isActive(item.href)
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedItems.includes(item.name)

    return (
      <div key={item.name}>
        <div className="flex items-center">
          <Link
            to={item.href}
            className={cn(
              'group flex items-center flex-1 text-sm font-medium rounded-md transition-colors',
              isChild ? 'pl-8 py-1.5' : 'px-2 py-2',
              active
                ? actualTheme === 'monochrome'
                  ? 'bg-gray-200 text-gray-900'
                  : 'bg-gradient-to-r from-violet-100 to-purple-100 text-purple-900 border border-purple-200/50'
                : actualTheme === 'monochrome'
                  ? 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  : 'text-slate-600 hover:bg-gradient-to-r hover:from-violet-50 hover:to-purple-50 hover:text-purple-900 hover:border hover:border-purple-200/30'
            )}
          >
            <item.icon className="h-4 w-4 mr-3" />
            {item.name}
          </Link>
          {hasChildren && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 mr-2"
              onClick={() => toggleExpanded(item.name)}
            >
              {isExpanded ? (
                <ChevronRight className="h-3 w-3 rotate-90 transition-transform" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div className="mt-1 space-y-1">
            {item.children!.map((child: NavItem) => renderNavigationItem(child, true))}
          </div>
        )}
      </div>
    )
  }
  const floatingDockItems = getFloatingDockNavigation(isOrganizationRoute, orgCode, handleDockNavigation)

  if (navigationMode !== 'traditional') {
    return (
      <div className="min-h-screen relative overflow-hidden">
        {showTour && (
          <Suspense fallback={null}>
            <DashboardFeatureTour
              onComplete={handleTourComplete}
              onSkip={handleTourSkip}
              onDismiss={handleTourDismiss}
              initialStep={getInitialStep()}
            />
          </Suspense>
        )}
        {/* Beautiful gradient background for dock mode */}
        <div className={`absolute inset-0 ${glassmorphismEnabled ? 'bg-gradient-to-br from-violet-100/30 via-purple-100/15 to-indigo-100/10 dark:from-slate-950/40 dark:via-slate-900/25 dark:to-slate-950/40 backdrop-blur-3xl' : 'bg-white dark:bg-black'}`}></div>

        {/* Purple gradient glassy effect */}
        {glassmorphismEnabled && (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-200/12 via-violet-200/8 to-indigo-200/10 dark:from-purple-500/10 dark:via-violet-500/6 dark:to-indigo-500/8 backdrop-blur-3xl"></div>
        )}

        {/* Dark mode pattern background for dock mode */}
        <div className="absolute inset-0 dark:block hidden opacity-20">
          <Pattern />
        </div>

        {/* Floating decorative elements for dock mode */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className={`absolute top-16 left-16 w-48 h-48 rounded-full blur-3xl animate-pulse ${glassmorphismEnabled ? 'bg-gradient-to-r from-purple-200/20 to-violet-200/20 dark:from-purple-400/12 dark:to-violet-400/12 backdrop-blur-3xl border border-purple-300/30 dark:border-purple-600/30' : 'hidden'}`}></div>
          <div className={`absolute top-32 right-32 w-44 h-44 rounded-full blur-3xl animate-pulse ${glassmorphismEnabled ? 'bg-gradient-to-r from-violet-200/20 to-indigo-200/20 dark:from-violet-400/10 dark:to-indigo-400/10 backdrop-blur-3xl border border-violet-300/30 dark:border-violet-600/30' : 'hidden'}`} style={{ animationDelay: '1.5s' }}></div>
          <div className={`absolute bottom-48 left-20 w-36 h-36 rounded-full blur-3xl animate-pulse ${glassmorphismEnabled ? 'bg-gradient-to-r from-indigo-200/20 to-purple-200/20 dark:from-indigo-400/8 dark:to-purple-400/8 backdrop-blur-3xl border border-indigo-300/30 dark:border-indigo-600/30' : 'hidden'}`} style={{ animationDelay: '3s' }}></div>
          <div className={`absolute top-1/2 right-16 w-28 h-28 rounded-full blur-2xl animate-pulse ${glassmorphismEnabled ? 'bg-gradient-to-r from-pink-200/15 to-purple-200/15 dark:from-pink-400/6 dark:to-purple-400/6 backdrop-blur-3xl border border-pink-300/30 dark:border-pink-600/30' : 'hidden'}`} style={{ animationDelay: '4.5s' }}></div>

          {/* Purple gradient glassy floating elements */}
          {glassmorphismEnabled && (
            <>
              <div className="absolute top-1/4 left-1/3 w-32 h-32 rounded-full blur-2xl animate-pulse bg-gradient-to-r from-purple-200/12 to-violet-200/8 dark:from-purple-400/6 dark:to-violet-400/4 backdrop-blur-3xl border border-purple-300/40 dark:border-purple-600/25" style={{ animationDelay: '2s' }}></div>
              <div className="absolute bottom-1/4 right-1/3 w-24 h-24 rounded-full blur-xl animate-pulse bg-gradient-to-r from-violet-200/10 to-indigo-200/6 dark:from-violet-400/5 dark:to-indigo-400/3 backdrop-blur-3xl border border-violet-300/35 dark:border-violet-600/20" style={{ animationDelay: '5.5s' }}></div>
              <div className="absolute top-3/4 left-1/2 w-20 h-20 rounded-full blur-lg animate-pulse bg-gradient-to-r from-indigo-200/8 to-purple-200/6 dark:from-indigo-400/4 dark:to-purple-400/3 backdrop-blur-3xl border border-indigo-300/30 dark:border-indigo-600/15" style={{ animationDelay: '7s' }}></div>
            </>
          )}
        </div>

        {/* Trial Banner */}
        {showTrialBanner && trialInfo && (
          <div className={`${glassmorphismEnabled ? 'backdrop-blur-3xl bg-purple-100/4 dark:bg-purple-900/6 border-b border-purple-300/60 dark:border-purple-600/40 mt-16 shadow-2xl ring-1 ring-purple-300/25 dark:ring-purple-600/15' : 'bg-white dark:bg-black border-b border-gray-200 dark:border-gray-700 mt-16 shadow-lg'}`}>
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className="p-2 bg-gradient-to-r from-violet-500 to-purple-500 dark:from-violet-600 dark:to-purple-600 rounded-lg shadow-md">
                      <Zap className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#1B2E5A] dark:text-slate-100">
                      Free Trial Active
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      {trialInfo.daysRemaining > 0 ? (
                        <>
                          <Clock className="inline h-4 w-4 mr-1 text-emerald-500 dark:text-emerald-400" />
                          {trialInfo.daysRemaining} days remaining on your {trialInfo.plan} trial
                        </>
                      ) : (
                        <span className="text-orange-600 dark:text-orange-400 font-medium">
                          Trial expired - upgrade to continue using all features
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <PearlButton onClick={handleUpgradeNow}>
                    {trialInfo.daysRemaining > 0 ? 'Setup Payment' : 'Upgrade Now'}
                  </PearlButton>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={dismissTrialBanner}
                    className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dock mode - floating navigation */}
        <div className="flex flex-col min-h-screen relative z-10">
          <div className="flex-1 pb-32 overflow-y-auto">
            {/* Main content area with enhanced styling for dock mode */}
            <div className="mx-auto max-w-7xl p-8 sm:p-10 lg:p-14 relative">
              {/* Subtle pattern overlay */}
              <div className="absolute inset-0 opacity-5">
                <div className="absolute inset-0" style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%236366F1' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }}></div>
              </div>

              {/* Content with enhanced glassmorphism card effect */}
              <div className="relative z-10">
                {/* Purple gradient glassy effect */}
                {glassmorphismEnabled && (
                  <div className="absolute inset-0 backdrop-blur-3xl bg-gradient-to-br from-purple-200/8 via-violet-200/5 to-indigo-200/6 dark:from-purple-500/6 dark:via-violet-500/3 dark:to-indigo-500/4 rounded-3xl"></div>
                )}
                <div className={`${glassmorphismEnabled ? 'backdrop-blur-3xl bg-purple-100/4 dark:bg-purple-900/6 border border-purple-300/60 dark:border-purple-600/50 rounded-3xl shadow-2xl ring-1 ring-purple-300/35 dark:ring-purple-600/25' : 'bg-white dark:bg-black border border-gray-200 dark:border-gray-700 rounded-3xl shadow-lg'}`}>
                  <div className="p-8 sm:p-10 lg:p-12">
                    <Outlet key={location.pathname + location.searchStr} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
            <Suspense fallback={null}>
              <FloatingDock
                items={floatingDockItems}
                mode="dock"
                glassy={glassmorphismEnabled}
                desktopClassName="mx-auto"
              />
            </Suspense>
          </div>
        </div>
      </div>
    )
  }

  // Determine sidebar navigation data based on current route with Tour entry
  const sidebarNavData = useMemo(() => {
    const baseData = isOrganizationRoute && orgCode
      ? getOrganizationSidebarData(orgCode, orgHierarchy || [], userData, tenantData)
      : defaultSidebarData;
    
    // Add Tour entry to bottomNav with dynamic URL
    const tourUrl = `${location.pathname}?tour=replay`;
    const bottomNavWithTour = [
      ...(baseData.bottomNav || []).slice(0, -1), // All except last (Settings)
      { name: "Tour", url: tourUrl, icon: BookOpen },
      ...(baseData.bottomNav || []).slice(-1) // Settings as last
    ];
    
    return {
      ...baseData,
      bottomNav: bottomNavWithTour
    };
  }, [isOrganizationRoute, orgCode, orgHierarchy, userData, tenantData, location.pathname]);

  return (
    <SidebarProvider className="bg-[#2563EB]">
      {showTour && (
        <Suspense fallback={null}>
          <DashboardFeatureTour
            onComplete={handleTourComplete}
            onSkip={handleTourSkip}
            onDismiss={handleTourDismiss}
            initialStep={getInitialStep()}
          />
        </Suspense>
      )}

      {/* Resume prompt */}
      {showResumePrompt && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[120] bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-4 max-w-md">
          <div className="flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-[#1B2E5A] dark:text-slate-100 mb-1">
                Resume your guide?
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                You were on step {parseInt(localStorage.getItem('dashboard-tour-step') || '0', 10) + 1}. Would you like to continue?
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleResumeChoice('resume')}
                  className="text-xs bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-600 hover:to-violet-600 text-white"
                >
                  Resume
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleResumeChoice('restart')}
                  className="text-xs"
                >
                  Start from beginning
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleResumeChoice('dismiss')}
                  className="text-xs text-slate-500"
                >
                  Don't show again
                </Button>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleResumeChoice('dismiss')}
              className="h-6 w-6 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <ModernSidebar
        navData={sidebarNavData}
        userData={userData}
        tenantData={tenantData}
        isTenantAdmin={user?.isTenantAdmin || false}
        onOrganizationSwitch={handleOrganizationSwitch}
      />
      <BreadcrumbLabelProvider>
        <SidebarInset className="md:peer-data-[variant=inset]:m-0 md:peer-data-[variant=inset]:rounded-none md:peer-data-[variant=inset]:shadow-none bg-white dark:bg-slate-950 rounded-tl-[30px] rounded-bl-[30px] flex flex-col h-screen overflow-hidden">
          <header className="flex h-16 shrink-0 items-center gap-2 px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800" />
              <Separator
                orientation="vertical"
                className="mr-2 h-4 bg-slate-300 dark:bg-slate-600"
              />
              <RouteBreadcrumb className="mt-0" />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Suspense fallback={null}>
                <NotificationManager />
              </Suspense>
              <BillingStatusNavbar />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 relative overflow-y-auto bg-slate-50 dark:bg-slate-900 p-6 min-h-0">
            <ErrorBoundary>
              <Outlet key={location.pathname + location.searchStr} />
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
          />
        </Suspense>
      )}
    </SidebarProvider>
  )
}
