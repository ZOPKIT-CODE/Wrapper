import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/lib/auth/cognito-auth'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, LayoutDashboard, Menu, Rocket, X } from 'lucide-react'
import {
  Navbar,
  NavBody,
  MobileNav,
  NavbarLogo,
  NavbarButton,
  MobileNavHeader,
  MobileNavMenu,
} from '@/components/ui/resizable-navbar'
import { DynamicIcon } from '@/features/landing/components/Icons'
import { getAllIndustries } from '@/data/industryPages'
import api, { createCancelableRequest } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  isLandingPath,
  isLandingSectionId,
  scrollToLandingSection,
  scrollToLandingSectionWhenReady,
  writeLandingHash,
} from '@/features/landing/landing-scroll'

/** Same slugs + labels as landing `/landing` — matches `productPages` routes */
const MARKETING_NAV_PRODUCTS = [
  { id: 'operations-management', name: 'Operations Management', icon: 'Box' },
  { id: 'b2b-crm', name: 'B2B CRM', icon: 'Briefcase' },
  {
    id: 'financial-accounting',
    name: 'Financial Accounting',
    icon: 'Landmark',
  },
  {
    id: 'project-management',
    name: 'Project Management',
    icon: 'ClipboardList',
  },
  { id: 'hrms', name: 'HRMS', icon: 'UserCheck' },
  { id: 'esop-system', name: 'ESOP System', icon: 'Award' },
  { id: 'affiliate-connect', name: 'Affiliate Connect', icon: 'Link' },
  { id: 'flowtilla', name: 'Flowtilla', icon: 'GitBranch' },
  { id: 'zopkit-academy', name: 'Zopkit Academy', icon: 'GraduationCap' },
  { id: 'zopkit-itsm', name: 'Zopkit ITSM', icon: 'Wrench' },
  { id: 'b2c-crm', name: 'B2C CRM', icon: 'ShoppingCart' },
] as const

export const LANDING_SECTION_NAV_ITEMS = [
  { name: 'Workflows', link: '/#workflows' },
  { name: 'Industries', link: '/#industries' },
  { name: 'Resources', link: '/#resources' },
] as const

export const DEFAULT_MARKETING_NAV_ITEMS = [
  { name: 'Pricing', link: '/pricing' },
  { name: 'Blog', link: '/blog' },
  { name: 'Contact', link: '/#contact' },
] as const

export type MarketingNavbarProps = {
  /** Flat Vercel-minimal nav styling (used on landing v2 and marketing shell pages). */
  minimal?: boolean
  /** Scroll to the landing contact form (shows Book a demo for signed-out visitors). */
  onBookDemo?: () => void
  /** Override the right-side desktop CTA. Omit to use the built-in auth-aware button. */
  desktopRight?: React.ReactNode
  /** Override the mobile sheet footer CTA. Omit to use the built-in auth-aware button. */
  mobileFooter?: React.ReactNode
}

interface CtaConfig {
  label: string
  icon: React.ReactNode
  action: () => void
  disabled: boolean
  variant: 'primary' | 'gradient'
}

function useMarketingCta(): CtaConfig & {
  isGuest: boolean
  authChecked: boolean
} {
  const navigate = useNavigate()
  const { login, isAuthenticated } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [onboardingCompleted, setOnboardingCompleted] = useState(false)
  const [backendAuthenticated, setBackendAuthenticated] = useState<
    boolean | null
  >(null)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    const { signal, cancel } = createCancelableRequest()
    const timer = setTimeout(async () => {
      try {
        const response = await api.get('/admin/auth-status', { signal })
        const auth = response.data?.authStatus
        const isBackendAuth = auth?.isAuthenticated === true
        setBackendAuthenticated(isBackendAuth)
        setOnboardingCompleted(
          isBackendAuth &&
            (auth?.onboardingCompleted === true ||
              auth?.needsOnboarding === false)
        )
      } catch {
        setBackendAuthenticated(null)
      }
      setAuthChecked(true)
    }, 100)

    return () => {
      clearTimeout(timer)
      cancel()
    }
  }, [isAuthenticated])

  const handleLogin = async () => {
    setIsLoading(true)
    try {
      // Cognito: route straight to Google federation (skips the hosted-UI selector).
      await login({ provider: 'google' })
    } catch {
      // ignore
    } finally {
      setIsLoading(false)
    }
  }

  const hasSession = authChecked && (backendAuthenticated ?? isAuthenticated)

  if (!authChecked) {
    return {
      label: 'Loading...',
      icon: null,
      action: () => undefined,
      disabled: true,
      variant: 'primary',
      isGuest: false,
      authChecked: false,
    }
  }
  if (!hasSession) {
    return {
      label: isLoading ? 'Loading...' : 'Sign In',
      icon: null,
      action: handleLogin,
      disabled: isLoading,
      variant: 'primary',
      isGuest: true,
      authChecked: true,
    }
  }
  if (onboardingCompleted) {
    return {
      label: 'Go to Workspace',
      icon: <LayoutDashboard className="mr-2 inline h-4 w-4" />,
      action: () => navigate({ to: '/dashboard/applications' }),
      disabled: false,
      variant: 'primary',
      isGuest: false,
      authChecked: true,
    }
  }
  return {
    label: 'Complete onboarding',
    icon: <Rocket className="mr-2 inline h-4 w-4" />,
    action: () => navigate({ to: '/onboarding' }),
    disabled: false,
    variant: 'primary',
    isGuest: false,
    authChecked: true,
  }
}

/**
 * Shared marketing site navbar used across all public pages.
 * Renders a built-in auth-aware CTA by default; pass desktopRight/mobileFooter
 * only if a page needs a one-off override.
 */
export function MarketingNavbar({
  minimal = false,
  onBookDemo,
  desktopRight,
  mobileFooter,
}: MarketingNavbarProps) {
  const navigate = useNavigate()
  const { isGuest, authChecked, ...cta } = useMarketingCta()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showProductsDropdown, setShowProductsDropdown] = useState(false)
  const [showIndustriesDropdown, setShowIndustriesDropdown] = useState(false)
  const productsDropdownTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null)
  const industriesDropdownTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null)

  const allIndustries = getAllIndustries()

  const handleProductsMouseEnter = useCallback(() => {
    if (productsDropdownTimeoutRef.current)
      clearTimeout(productsDropdownTimeoutRef.current)
    setShowProductsDropdown(true)
  }, [])

  const handleProductsMouseLeave = useCallback(() => {
    productsDropdownTimeoutRef.current = setTimeout(
      () => setShowProductsDropdown(false),
      300
    )
  }, [])

  const handleIndustriesMouseEnter = useCallback(() => {
    if (industriesDropdownTimeoutRef.current)
      clearTimeout(industriesDropdownTimeoutRef.current)
    setShowIndustriesDropdown(true)
  }, [])

  const handleIndustriesMouseLeave = useCallback(() => {
    industriesDropdownTimeoutRef.current = setTimeout(
      () => setShowIndustriesDropdown(false),
      300
    )
  }, [])

  const closeNavDropdowns = useCallback(() => {
    if (productsDropdownTimeoutRef.current)
      clearTimeout(productsDropdownTimeoutRef.current)
    if (industriesDropdownTimeoutRef.current)
      clearTimeout(industriesDropdownTimeoutRef.current)
    setShowProductsDropdown(false)
    setShowIndustriesDropdown(false)
  }, [])

  useEffect(() => {
    const onScroll = () => closeNavDropdowns()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeNavDropdowns()
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [closeNavDropdowns])

  const handleAnchorClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      e.preventDefault()

      const hashIdx = href.indexOf('#')
      if (hashIdx !== -1) {
        const path = href.slice(0, hashIdx) || '/'
        const hash = href.slice(hashIdx + 1)
        const currentPath = window.location.pathname

        if (isLandingSectionId(hash) && (isLandingPath(path) || path === '/')) {
          const targetPath = path === '/' ? currentPath : path

          if (!isLandingPath(currentPath)) {
            navigate({ to: '/', hash })
            return
          }

          if (targetPath !== currentPath) {
            navigate({
              to: targetPath as
                | '/'
                | '/landing'
                | '/landing/classic'
                | '/landing/v2'
                | '/landing/v3',
            })
          }

          scrollToLandingSectionWhenReady(hash, 'smooth')
          writeLandingHash(hash, isLandingPath(currentPath) ? currentPath : '/')
          closeNavDropdowns()
          setIsMobileMenuOpen(false)
          return
        }

        closeNavDropdowns()
        navigate({ to: path as '/', hash })
        return
      }

      if (href.startsWith('/')) {
        closeNavDropdowns()
        navigate({ to: href })
        return
      }

      const targetId = href.replace('#', '')
      if (isLandingSectionId(targetId)) {
        closeNavDropdowns()
        scrollToLandingSection(targetId)
        writeLandingHash(targetId)
      }
    },
    [navigate, closeNavDropdowns]
  )

  const navItems = minimal
    ? [...LANDING_SECTION_NAV_ITEMS, ...DEFAULT_MARKETING_NAV_ITEMS]
    : DEFAULT_MARKETING_NAV_ITEMS

  const linkClass = minimal
    ? 'marketing-nav-link px-3 py-2 font-medium transition-colors duration-150 cursor-pointer'
    : 'px-3 py-2 text-primary hover:text-primary-hover font-medium transition-colors duration-150 cursor-pointer'

  const showBookDemoCta = Boolean(onBookDemo && isGuest && authChecked)

  const bookDemoDesktop = showBookDemoCta ? (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={cta.action}
        disabled={cta.disabled}
        className={cn(
          'cursor-pointer text-[13px] font-medium transition-colors',
          minimal
            ? 'marketing-nav-link marketing-nav-sign-in px-2 py-1'
            : 'text-primary hover:text-primary-hover px-2 py-1'
        )}
      >
        Sign In
      </button>
      <NavbarButton
        variant="primary"
        onClick={() => {
          closeNavDropdowns()
          onBookDemo?.()
        }}
        as="button"
        className={cn(minimal && 'marketing-nav-cta', 'text-[13px]')}
      >
        Book a demo
      </NavbarButton>
    </div>
  ) : null

  const bookDemoMobile = showBookDemoCta ? (
    <div className="flex w-full flex-col gap-2">
      <NavbarButton
        variant="primary"
        onClick={() => {
          closeNavDropdowns()
          setIsMobileMenuOpen(false)
          onBookDemo?.()
        }}
        as="button"
        className={cn(minimal && 'marketing-nav-cta', 'w-full justify-center')}
      >
        Book a demo
      </NavbarButton>
      <NavbarButton
        variant="ghost"
        onClick={cta.action}
        disabled={cta.disabled}
        as="button"
        className={cn(
          minimal && 'marketing-nav-sign-in',
          'w-full justify-center'
        )}
      >
        {cta.icon}
        {cta.label}
      </NavbarButton>
    </div>
  ) : null

  const defaultDesktopCta = bookDemoDesktop ?? (
    <NavbarButton
      variant={cta.variant}
      onClick={cta.action}
      disabled={cta.disabled}
      as="button"
      className={cn(minimal && 'marketing-nav-cta', 'text-[13px]')}
    >
      {cta.icon}
      {cta.label}
    </NavbarButton>
  )

  const defaultMobileCta = bookDemoMobile ?? (
    <NavbarButton
      variant={cta.variant}
      onClick={cta.action}
      disabled={cta.disabled}
      as="button"
      className={cn(minimal && 'marketing-nav-cta', 'w-full justify-center')}
    >
      {cta.icon}
      {cta.label}
    </NavbarButton>
  )

  return (
    <Navbar>
      <NavBody className={cn(minimal && 'marketing-nav-bar')}>
        <NavbarLogo />
        <div className="flex min-w-0 flex-1 flex-row items-center justify-center gap-0.5 px-6 text-[13px] font-medium">
          <div
            className="relative shrink-0"
            onMouseEnter={handleProductsMouseEnter}
            onMouseLeave={handleProductsMouseLeave}
          >
            <button
              type="button"
              className={cn(
                linkClass,
                'flex items-center gap-1 whitespace-nowrap'
              )}
            >
              Products
              <ChevronRight
                size={14}
                className={`transition-transform duration-200 ${showProductsDropdown ? 'rotate-90' : ''}`}
              />
            </button>
            <AnimatePresence>
              {showProductsDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="marketing-nav-dropdown absolute top-full left-0 z-50 mt-2 w-[280px]"
                >
                  <div
                    className={cn(
                      'overflow-hidden',
                      minimal
                        ? 'bg-background border-border rounded-lg border shadow-sm'
                        : 'rounded-xl border border-slate-200 bg-white shadow-[0_12px_40px_-8px_rgba(0,0,0,0.12)]'
                    )}
                  >
                    <div className="px-3 pt-3 pb-1.5">
                      <p
                        className={cn(
                          'text-[11px] font-semibold tracking-wider uppercase',
                          minimal ? 'text-muted-foreground' : 'text-slate-400'
                        )}
                      >
                        Products
                      </p>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto px-1.5 pb-1.5">
                      {MARKETING_NAV_PRODUCTS.map((product) => (
                        <button
                          type="button"
                          key={product.id}
                          onClick={() => {
                            closeNavDropdowns()
                            navigate({ to: `/products/${product.id}` })
                          }}
                          className={cn(
                            'flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors duration-100',
                            minimal
                              ? 'text-foreground hover:bg-muted/50 rounded-md'
                              : 'text-primary hover:text-primary-hover rounded-lg hover:bg-slate-50'
                          )}
                        >
                          <span
                            className={cn(
                              'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                              minimal ? 'border-border border' : 'bg-slate-100'
                            )}
                          >
                            <DynamicIcon
                              name={product.icon}
                              className={cn(
                                'h-3.5 w-3.5',
                                minimal
                                  ? 'text-muted-foreground'
                                  : 'text-slate-500'
                              )}
                            />
                          </span>
                          <span className="font-medium">{product.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div
            className="relative shrink-0"
            onMouseEnter={handleIndustriesMouseEnter}
            onMouseLeave={handleIndustriesMouseLeave}
          >
            <button
              type="button"
              className={cn(
                linkClass,
                'flex items-center gap-1 whitespace-nowrap'
              )}
            >
              Industries
              <ChevronRight
                size={14}
                className={`transition-transform duration-200 ${showIndustriesDropdown ? 'rotate-90' : ''}`}
              />
            </button>
            <AnimatePresence>
              {showIndustriesDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  className="marketing-nav-dropdown absolute top-full left-0 z-50 mt-2 w-[240px]"
                >
                  <div
                    className={cn(
                      'overflow-hidden',
                      minimal
                        ? 'bg-background border-border rounded-lg border shadow-sm'
                        : 'rounded-xl border border-slate-200 bg-white shadow-[0_12px_40px_-8px_rgba(0,0,0,0.12)]'
                    )}
                  >
                    <div className="px-3 pt-3 pb-1.5">
                      <p
                        className={cn(
                          'text-[11px] font-semibold tracking-wider uppercase',
                          minimal ? 'text-muted-foreground' : 'text-slate-400'
                        )}
                      >
                        Industries
                      </p>
                    </div>
                    <div className="px-1.5 pb-1.5">
                      {allIndustries.map((industry) => (
                        <button
                          type="button"
                          key={industry.slug}
                          onClick={() => {
                            closeNavDropdowns()
                            navigate({ to: `/industries/${industry.slug}` })
                          }}
                          className={cn(
                            'w-full cursor-pointer px-3 py-2 text-left text-[13px] font-medium transition-colors duration-100',
                            minimal
                              ? 'text-foreground hover:bg-muted/50 rounded-md'
                              : 'text-primary hover:text-primary-hover rounded-lg hover:bg-slate-50'
                          )}
                        >
                          {industry.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {navItems.map((item) => (
            <a
              key={item.name}
              href={item.link}
              onClick={(e) => handleAnchorClick(e, item.link)}
              className={cn(linkClass, 'shrink-0 whitespace-nowrap')}
            >
              {item.name}
            </a>
          ))}
        </div>

        <div className="ml-4 flex shrink-0 items-center gap-2">
          {desktopRight ?? defaultDesktopCta}
        </div>
      </NavBody>

      <MobileNav className={cn(minimal && 'marketing-nav-bar')}>
        <MobileNavHeader>
          <NavbarLogo />
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={cn(
              'flex h-9 w-9 cursor-pointer items-center justify-center transition-all duration-150',
              minimal
                ? 'border-border bg-background hover:bg-muted text-foreground rounded-lg border'
                : 'bg-primary-hover hover:bg-primary rounded-xl active:scale-95'
            )}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? (
              <X className={cn('h-4 w-4', !minimal && 'text-white')} />
            ) : (
              <Menu className={cn('h-4 w-4', !minimal && 'text-white')} />
            )}
          </button>
        </MobileNavHeader>

        <MobileNavMenu
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          className={cn(minimal && 'marketing-nav-mobile-menu')}
        >
          <div className="mb-2">
            <p
              className={cn(
                'mb-1 px-2 text-[10px] font-bold tracking-widest uppercase',
                minimal ? 'text-muted-foreground' : 'text-slate-400'
              )}
            >
              Products
            </p>
            <div
              className={cn(
                'max-h-[220px] divide-y overflow-y-auto',
                minimal
                  ? 'border-border divide-border rounded-lg border'
                  : 'divide-black/[0.04] rounded-xl border border-black/[0.06] bg-white/60'
              )}
            >
              {MARKETING_NAV_PRODUCTS.map((product) => (
                <a
                  key={product.id}
                  href={`/products/${product.id}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-[13px] font-medium transition-colors duration-100',
                    minimal
                      ? 'text-foreground hover:bg-muted/50'
                      : 'text-primary first:rounded-t-xl last:rounded-b-xl hover:bg-white/80 active:bg-white'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                      minimal ? 'border-border border' : 'bg-slate-100'
                    )}
                  >
                    <DynamicIcon
                      name={product.icon}
                      className={cn(
                        'h-3 w-3',
                        minimal ? 'text-muted-foreground' : 'text-slate-500'
                      )}
                    />
                  </span>
                  {product.name}
                </a>
              ))}
            </div>
          </div>

          <div className="mb-2">
            <p
              className={cn(
                'mb-1 px-2 text-[10px] font-bold tracking-widest uppercase',
                minimal ? 'text-muted-foreground' : 'text-slate-400'
              )}
            >
              Industries
            </p>
            <div
              className={cn(
                'divide-y',
                minimal
                  ? 'border-border divide-border rounded-lg border'
                  : 'divide-black/[0.04] rounded-xl border border-black/[0.06] bg-white/60'
              )}
            >
              {allIndustries.map((industry) => (
                <a
                  key={industry.slug}
                  href={`/industries/${industry.slug}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 px-3 py-2.5 text-[13px] font-medium transition-colors duration-100',
                    minimal
                      ? 'text-foreground hover:bg-muted/50'
                      : 'text-primary first:rounded-t-xl last:rounded-b-xl hover:bg-white/80 active:bg-white'
                  )}
                >
                  {!minimal && (
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#3D8FE8]" />
                  )}
                  {industry.name}
                </a>
              ))}
            </div>
          </div>

          <div
            className={cn(
              'mb-3 divide-y',
              minimal
                ? 'border-border divide-border rounded-lg border'
                : 'divide-black/[0.04] rounded-xl border border-black/[0.06] bg-white/60'
            )}
          >
            {navItems.map((item, idx) => (
              <a
                key={`mobile-link-${idx}`}
                href={item.link}
                onClick={(e) => {
                  setIsMobileMenuOpen(false)
                  handleAnchorClick(e, item.link)
                }}
                className={cn(
                  'flex cursor-pointer items-center gap-2 px-3 py-2.5 text-[13px] font-medium transition-colors duration-100',
                  minimal
                    ? 'text-foreground hover:bg-muted/50'
                    : 'text-primary first:rounded-t-xl last:rounded-b-xl hover:bg-white/80 active:bg-white'
                )}
              >
                {!minimal && (
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#6B5BD6]" />
                )}
                {item.name}
              </a>
            ))}
          </div>

          {mobileFooter ?? defaultMobileCta}
        </MobileNavMenu>
      </MobileNav>
    </Navbar>
  )
}
