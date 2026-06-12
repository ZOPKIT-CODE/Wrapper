import React from 'react'
import { useLocation, Link } from '@tanstack/react-router'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { cn } from '@/lib/utils'
import { useBreadcrumbLabel } from '@/contexts/BreadcrumbLabelContext'

// Route mapping configuration
const routeMap: Record<string, string> = {
  // Main routes
  '/': 'Home',
  '/dashboard': 'Dashboard',
  '/dashboard/overview': 'Overview',
  '/dashboard/applications': 'Applications',
  '/dashboard/billing': 'Billing',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/usage': 'Usage',
  '/dashboard/permissions': 'Permissions',

  // Organization routes
  '/org': 'Organization',

  // Admin routes
  '/admin': 'Admin',

  // Public routes
  '/landing': 'Landing',
  '/login': 'Login',
  '/onboarding': 'Onboarding',
  '/auth/callback': 'Authentication',
  '/invite/accept': 'Accept Invitation',

  // Demo routes
  '/design-system': 'Design System',
  '/form-demo': 'Form Demo',
  '/context-demo': 'Context Demo',
  '/perfect-form': 'Perfect Form',
  '/form-layout-test': 'Form Layout Test',
  '/form-error-test': 'Form Error Test',
  '/breadcrumb-demo': 'Breadcrumb Demo',
}

// Special handling for organization routes
const getOrgRouteLabel = (pathname: string): string | null => {
  const orgMatch = pathname.match(/^\/org\/([^/]+)(?:\/(.*))?$/)
  if (orgMatch) {
    const [, orgCode, subPath] = orgMatch
    if (subPath) {
      return (
        routeMap[`/dashboard/${subPath}`] ||
        subPath.charAt(0).toUpperCase() + subPath.slice(1)
      )
    }
    return `Organization (${orgCode})`
  }
  return null
}

// Special handling for dashboard with query parameters
const getDashboardTabLabel = (
  pathname: string,
  search: string | Record<string, unknown>
): string | null => {
  if (pathname === '/dashboard' || pathname === '/dashboard/applications') {
    // `search` is a raw query string from `location.searchStr` or the parsed
    // search object from `location.search`; read `tab` from whichever shape.
    const tab =
      typeof search === 'string'
        ? new URLSearchParams(search).get('tab')
        : typeof search.tab === 'string'
          ? search.tab
          : null
    if (tab) {
      const tabLabels: Record<string, string> = {
        overview: 'Overview',
        applications: 'Applications',
        users: 'Users',
        roles: 'Roles',
        analytics: 'Analytics',
      }
      return tabLabels[tab] || tab.charAt(0).toUpperCase() + tab.slice(1)
    }
  }
  return null
}

interface RouteBreadcrumbProps {
  className?: string
  showHome?: boolean
  maxItems?: number
}

export function RouteBreadcrumb({
  className,
  showHome = true,
  maxItems = 5,
}: RouteBreadcrumbProps) {
  const location = useLocation()
  const { pathname, searchStr: search } = location
  const { lastSegmentLabel } = useBreadcrumbLabel()

  // Generate breadcrumb items
  const generateBreadcrumbs = () => {
    const breadcrumbs: Array<{ label: string; href: string; isLast: boolean }> =
      []

    // Handle special cases first
    const orgRouteLabel = getOrgRouteLabel(pathname)
    if (orgRouteLabel) {
      const orgMatch = pathname.match(/^\/org\/([^/]+)(?:\/(.*))?$/)
      if (orgMatch) {
        const [, orgCode, subPath] = orgMatch
        breadcrumbs.push({
          label: 'Organizations',
          href: '/org',
          isLast: false,
        })
        breadcrumbs.push({
          label: orgCode,
          href: `/org/${orgCode}`,
          isLast: !subPath,
        })
        if (subPath) {
          breadcrumbs.push({
            label: orgRouteLabel,
            href: pathname,
            isLast: true,
          })
        }
        return breadcrumbs
      }
    }

    // Handle dashboard with tabs
    const dashboardTabLabel = getDashboardTabLabel(pathname, search)
    if (dashboardTabLabel) {
      breadcrumbs.push({
        label: 'Dashboard',
        href: '/dashboard/applications',
        isLast: false,
      })
      breadcrumbs.push({
        label: dashboardTabLabel,
        href: pathname + search,
        isLast: true,
      })
      return breadcrumbs
    }

    // Split pathname into segments
    const pathSegments = pathname.split('/').filter(Boolean)

    // Add home if requested and not already at root
    if (showHome && pathname !== '/') {
      breadcrumbs.push({
        label: 'Home',
        href: '/',
        isLast: false,
      })
    }

    // Build breadcrumbs from path segments
    let currentPath = ''
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`
      const isLast = index === pathSegments.length - 1

      // Get label from route map or format segment
      // Use custom label from context if available for the last segment
      let label =
        routeMap[currentPath] ||
        segment.charAt(0).toUpperCase() + segment.slice(1)

      // Override last segment label if context provides one
      if (isLast && lastSegmentLabel) {
        label = lastSegmentLabel
      }

      breadcrumbs.push({
        label,
        href: currentPath,
        isLast,
      })
    })

    // If no segments and showHome is true, add home
    if (pathSegments.length === 0 && showHome) {
      breadcrumbs.push({
        label: 'Home',
        href: '/',
        isLast: true,
      })
    }

    return breadcrumbs
  }

  const breadcrumbs = generateBreadcrumbs()

  // Limit number of items if maxItems is specified
  const displayBreadcrumbs =
    maxItems && breadcrumbs.length > maxItems
      ? [
          ...breadcrumbs.slice(0, 1), // Keep first item
          ...breadcrumbs.slice(-(maxItems - 1)), // Keep last items
        ]
      : breadcrumbs

  if (breadcrumbs.length <= 1 && !showHome) {
    return null
  }

  return (
    <Breadcrumb className={cn('mb-4', className)}>
      <BreadcrumbList>
        {displayBreadcrumbs.map((breadcrumb) => (
          <React.Fragment key={breadcrumb.href}>
            <BreadcrumbItem>
              {breadcrumb.isLast ? (
                <BreadcrumbPage>{breadcrumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link to={breadcrumb.href}>{breadcrumb.label}</Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {!breadcrumb.isLast && <BreadcrumbSeparator />}
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

// Hook for getting current breadcrumb data
export function useRouteBreadcrumbs() {
  const location = useLocation()
  const { pathname, search } = location
  const { lastSegmentLabel } = useBreadcrumbLabel()

  const getCurrentBreadcrumbs = () => {
    const breadcrumbs: Array<{ label: string; href: string; isLast: boolean }> =
      []

    // Handle special cases first
    const orgRouteLabel = getOrgRouteLabel(pathname)
    if (orgRouteLabel) {
      const orgMatch = pathname.match(/^\/org\/([^/]+)(?:\/(.*))?$/)
      if (orgMatch) {
        const [, orgCode, subPath] = orgMatch
        breadcrumbs.push({
          label: 'Organizations',
          href: '/org',
          isLast: false,
        })
        breadcrumbs.push({
          label: orgCode,
          href: `/org/${orgCode}`,
          isLast: !subPath,
        })
        if (subPath) {
          breadcrumbs.push({
            label: orgRouteLabel,
            href: pathname,
            isLast: true,
          })
        }
        return breadcrumbs
      }
    }

    // Handle dashboard with tabs
    const dashboardTabLabel = getDashboardTabLabel(pathname, search)
    if (dashboardTabLabel) {
      breadcrumbs.push({
        label: 'Dashboard',
        href: '/dashboard/applications',
        isLast: false,
      })
      breadcrumbs.push({
        label: dashboardTabLabel,
        href: pathname + search,
        isLast: true,
      })
      return breadcrumbs
    }

    // Split pathname into segments
    const pathSegments = pathname.split('/').filter(Boolean)

    // Add home
    breadcrumbs.push({
      label: 'Home',
      href: '/',
      isLast: false,
    })

    // Build breadcrumbs from path segments
    let currentPath = ''
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`
      const isLast = index === pathSegments.length - 1

      // Get label from route map or format segment
      // Use custom label from context if available for the last segment
      let label =
        routeMap[currentPath] ||
        segment.charAt(0).toUpperCase() + segment.slice(1)

      // Override last segment label if context provides one
      if (isLast && lastSegmentLabel) {
        label = lastSegmentLabel
      }

      breadcrumbs.push({
        label,
        href: currentPath,
        isLast,
      })
    })

    return breadcrumbs
  }

  return {
    breadcrumbs: getCurrentBreadcrumbs(),
    currentPath: pathname,
    currentSearch: search,
  }
}
