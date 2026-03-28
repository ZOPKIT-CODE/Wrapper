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
import { Home, Building2, Users, Crown, Shield, Activity, CreditCard, X, ChevronRight, Settings, BookOpen } from "lucide-react"
import { useNavigate, useLocation, useSearch, useParams, Outlet, Link } from "@tanstack/react-router"
import { useOrganizationHierarchy } from "@/hooks/useOrganizationHierarchy"
import { Button } from "@/components/ui/button"
import { PearlButton } from "@/components/ui/pearl-button"
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
                  : 'bg-[#1B2E5A]/10 text-[#1B2E5A] border border-[#1B2E5A]/20'
                : actualTheme === 'monochrome'
                  ? 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  : 'text-slate-600 hover:bg-[#1B2E5A]/5 hover:text-[#1B2E5A]'
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
    <SidebarProvider className="bg-[#1B2E5A]">
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
            <BookOpen className="w-5 h-5 text-[#1B2E5A] mt-0.5 flex-shrink-0" />
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
                  className="text-xs bg-[#1B2E5A] hover:bg-[#162447] text-white"
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
