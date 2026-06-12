import { useEffect } from 'react'
import { Outlet, useLocation } from '@tanstack/react-router'
import { MarketingContentLayout } from '@/components/layout/MarketingContentLayout'

/**
 * Pathless marketing layout — shared navbar, footer, and `data-landing` shell
 * for blog, industry, and other public content routes.
 */
export function MarketingRouteLayout() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return (
    <MarketingContentLayout scrollToTopOnMount={false}>
      <Outlet />
    </MarketingContentLayout>
  )
}
