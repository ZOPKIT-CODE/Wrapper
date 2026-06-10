import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth/cognito-auth';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, LayoutDashboard, Menu, Rocket, X } from 'lucide-react';
import {
  Navbar,
  NavBody,
  MobileNav,
  NavbarLogo,
  NavbarButton,
  MobileNavHeader,
  MobileNavMenu,
} from '@/components/ui/resizable-navbar';
import { DynamicIcon } from '@/features/landing/components/Icons';
import { getAllIndustries } from '@/data/industryPages';
import api, { createCancelableRequest } from '@/lib/api';
import { cn } from '@/lib/utils';

/** Same slugs + labels as landing `/landing` — matches `productPages` routes */
const MARKETING_NAV_PRODUCTS = [
  { id: 'operations-management', name: 'Operations Management', icon: 'Box' },
  { id: 'b2b-crm', name: 'B2B CRM', icon: 'Briefcase' },
  { id: 'financial-accounting', name: 'Financial Accounting', icon: 'Landmark' },
  { id: 'project-management', name: 'Project Management', icon: 'ClipboardList' },
  { id: 'hrms', name: 'HRMS', icon: 'UserCheck' },
  { id: 'esop-system', name: 'ESOP System', icon: 'Award' },
  { id: 'affiliate-connect', name: 'Affiliate Connect', icon: 'Link' },
  { id: 'flowtilla', name: 'Flowtilla', icon: 'GitBranch' },
  { id: 'zopkit-academy', name: 'Zopkit Academy', icon: 'GraduationCap' },
  { id: 'zopkit-itsm', name: 'Zopkit ITSM', icon: 'Wrench' },
  { id: 'b2c-crm', name: 'B2C CRM', icon: 'ShoppingCart' },
] as const;

export const DEFAULT_MARKETING_NAV_ITEMS = [
  { name: 'Pricing', link: '/pricing' },
  { name: 'Blog', link: '/blog' },
  { name: 'Contact Us', link: '/landing#contact' },
] as const;

export type MarketingNavbarProps = {
  /** Flat Vercel-minimal nav styling (used on landing v2 and marketing shell pages). */
  minimal?: boolean;
  /** Override the right-side desktop CTA. Omit to use the built-in auth-aware button. */
  desktopRight?: React.ReactNode;
  /** Override the mobile sheet footer CTA. Omit to use the built-in auth-aware button. */
  mobileFooter?: React.ReactNode;
};

interface CtaConfig {
  label: string;
  icon: React.ReactNode;
  action: () => void;
  disabled: boolean;
  variant: 'primary' | 'gradient';
}

function useMarketingCta(): CtaConfig {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [backendAuthenticated, setBackendAuthenticated] = useState<boolean | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    const { signal, cancel } = createCancelableRequest();
    const timer = setTimeout(async () => {
      try {
        const response = await api.get('/admin/auth-status', { signal });
        const auth = response.data?.authStatus;
        const isBackendAuth = auth?.isAuthenticated === true;
        setBackendAuthenticated(isBackendAuth);
        setOnboardingCompleted(
          isBackendAuth && (auth?.onboardingCompleted === true || auth?.needsOnboarding === false)
        );
      } catch {
        setBackendAuthenticated(null);
      }
      setAuthChecked(true);
    }, 100);

    return () => {
      clearTimeout(timer);
      cancel();
    };
  }, [isAuthenticated]);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      // Cognito: route straight to Google federation (skips the hosted-UI selector).
      await login({ provider: 'google' });
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  const hasSession = authChecked && (backendAuthenticated ?? isAuthenticated);

  if (!authChecked) {
    return { label: 'Loading...', icon: null, action: () => undefined, disabled: true, variant: 'primary' };
  }
  if (!hasSession) {
    return { label: isLoading ? 'Loading...' : 'Sign In', icon: null, action: handleLogin, disabled: isLoading, variant: 'primary' };
  }
  if (onboardingCompleted) {
    return {
      label: 'Go to Workspace',
      icon: <LayoutDashboard className="w-4 h-4 mr-2 inline" />,
      action: () => navigate({ to: '/dashboard/applications' }),
      disabled: false,
      variant: 'primary',
    };
  }
  return {
    label: 'Complete onboarding',
    icon: <Rocket className="w-4 h-4 mr-2 inline" />,
    action: () => navigate({ to: '/onboarding' }),
    disabled: false,
    variant: 'primary',
  };
}

/**
 * Shared marketing site navbar used across all public pages.
 * Renders a built-in auth-aware CTA by default; pass desktopRight/mobileFooter
 * only if a page needs a one-off override.
 */
export function MarketingNavbar({ minimal = false, desktopRight, mobileFooter }: MarketingNavbarProps) {
  const navigate = useNavigate();
  const cta = useMarketingCta();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showProductsDropdown, setShowProductsDropdown] = useState(false);
  const [showIndustriesDropdown, setShowIndustriesDropdown] = useState(false);
  const productsDropdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const industriesDropdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allIndustries = getAllIndustries();

  const handleProductsMouseEnter = useCallback(() => {
    if (productsDropdownTimeoutRef.current) clearTimeout(productsDropdownTimeoutRef.current);
    setShowProductsDropdown(true);
  }, []);

  const handleProductsMouseLeave = useCallback(() => {
    productsDropdownTimeoutRef.current = setTimeout(() => setShowProductsDropdown(false), 300);
  }, []);

  const handleIndustriesMouseEnter = useCallback(() => {
    if (industriesDropdownTimeoutRef.current) clearTimeout(industriesDropdownTimeoutRef.current);
    setShowIndustriesDropdown(true);
  }, []);

  const handleIndustriesMouseLeave = useCallback(() => {
    industriesDropdownTimeoutRef.current = setTimeout(() => setShowIndustriesDropdown(false), 300);
  }, []);

  const handleAnchorClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      if (href.startsWith('/')) {
        e.preventDefault();
        const hashIdx = href.indexOf('#');
        if (hashIdx !== -1) {
          const path = href.slice(0, hashIdx);
          const hash = href.slice(hashIdx + 1);
          navigate({ to: path, hash: hash });
        } else {
          navigate({ to: href });
        }
        return;
      }
      e.preventDefault();
      const targetId = href.replace('#', '');
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        const navbarOffset = 100;
        const elementPosition = targetElement.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - navbarOffset;
        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
      }
    },
    [navigate]
  );

  const navItems = DEFAULT_MARKETING_NAV_ITEMS;

  const linkClass = minimal
    ? 'marketing-nav-link px-3 py-2 font-medium transition-colors duration-150 cursor-pointer'
    : 'px-3 py-2 text-primary hover:text-primary-hover font-medium transition-colors duration-150 cursor-pointer';

  const defaultDesktopCta = (
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
  );

  const defaultMobileCta = (
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
  );

  return (
    <Navbar>
      <NavBody className={cn(minimal && 'marketing-nav-bar')}>
        <NavbarLogo />
        <div className="flex-1 flex flex-row items-center justify-center gap-0.5 text-[13px] font-medium px-6 min-w-0">
          <div
            className="relative shrink-0"
            onMouseEnter={handleProductsMouseEnter}
            onMouseLeave={handleProductsMouseLeave}
          >
            <button
              type="button"
              className={cn(linkClass, 'flex items-center gap-1 whitespace-nowrap')}
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
                  className="absolute top-full left-0 mt-2 w-[280px] z-50"
                >
                  <div className={cn(
                    'overflow-hidden',
                    minimal
                      ? 'bg-background rounded-lg border border-border shadow-sm'
                      : 'bg-white rounded-xl border border-slate-200 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.12)]'
                  )}>
                    <div className="px-3 pt-3 pb-1.5">
                      <p className={cn(
                        'text-[11px] font-semibold uppercase tracking-wider',
                        minimal ? 'text-muted-foreground' : 'text-slate-400'
                      )}>Products</p>
                    </div>
                    <div className="px-1.5 pb-1.5 max-h-[400px] overflow-y-auto">
                      {MARKETING_NAV_PRODUCTS.map((product) => (
                        <button
                          type="button"
                          key={product.id}
                          onClick={() => navigate({ to: `/products/${product.id}` })}
                          className={cn(
                            'w-full text-left px-3 py-2 text-[13px] transition-colors duration-100 flex items-center gap-2.5 cursor-pointer',
                            minimal
                              ? 'text-foreground hover:bg-muted/50 rounded-md'
                              : 'text-primary hover:text-primary-hover hover:bg-slate-50 rounded-lg'
                          )}
                        >
                          <span className={cn(
                            'w-7 h-7 rounded-md flex items-center justify-center shrink-0',
                            minimal ? 'border border-border' : 'bg-slate-100'
                          )}>
                            <DynamicIcon name={product.icon} className={cn('w-3.5 h-3.5', minimal ? 'text-muted-foreground' : 'text-slate-500')} />
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
              className={cn(linkClass, 'flex items-center gap-1 whitespace-nowrap')}
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
                  className="absolute top-full left-0 mt-2 w-[240px] z-50"
                >
                  <div className={cn(
                    'overflow-hidden',
                    minimal
                      ? 'bg-background rounded-lg border border-border shadow-sm'
                      : 'bg-white rounded-xl border border-slate-200 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.12)]'
                  )}>
                    <div className="px-3 pt-3 pb-1.5">
                      <p className={cn(
                        'text-[11px] font-semibold uppercase tracking-wider',
                        minimal ? 'text-muted-foreground' : 'text-slate-400'
                      )}>Industries</p>
                    </div>
                    <div className="px-1.5 pb-1.5">
                      {allIndustries.map((industry) => (
                        <button
                          type="button"
                          key={industry.slug}
                          onClick={() => navigate({ to: `/industries/${industry.slug}` })}
                          className={cn(
                            'w-full text-left px-3 py-2 text-[13px] font-medium transition-colors duration-100 cursor-pointer',
                            minimal
                              ? 'text-foreground hover:bg-muted/50 rounded-md'
                              : 'text-primary hover:text-primary-hover hover:bg-slate-50 rounded-lg'
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
              className={cn(linkClass, 'whitespace-nowrap shrink-0')}
            >
              {item.name}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-4">
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
              'w-9 h-9 flex items-center justify-center transition-all duration-150 cursor-pointer',
              minimal
                ? 'rounded-lg border border-border bg-background hover:bg-muted text-foreground'
                : 'rounded-xl bg-primary-hover hover:bg-primary active:scale-95'
            )}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen
              ? <X className={cn('w-4 h-4', !minimal && 'text-white')} />
              : <Menu className={cn('w-4 h-4', !minimal && 'text-white')} />}
          </button>
        </MobileNavHeader>

        <MobileNavMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)}>
          <div className="mb-2">
            <p className={cn(
              'text-[10px] font-bold uppercase tracking-widest px-2 mb-1',
              minimal ? 'text-muted-foreground' : 'text-slate-400'
            )}>Products</p>
            <div className={cn(
              'max-h-[220px] overflow-y-auto divide-y',
              minimal
                ? 'rounded-lg border border-border divide-border'
                : 'rounded-xl bg-white/60 border border-black/[0.06] divide-black/[0.04]'
            )}>
              {MARKETING_NAV_PRODUCTS.map((product) => (
                <a
                  key={product.id}
                  href={`/products/${product.id}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2.5 text-[13px] font-medium transition-colors duration-100 cursor-pointer',
                    minimal
                      ? 'text-foreground hover:bg-muted/50'
                      : 'text-primary hover:bg-white/80 active:bg-white first:rounded-t-xl last:rounded-b-xl'
                  )}
                >
                  <span className={cn(
                    'w-6 h-6 rounded-md flex items-center justify-center shrink-0',
                    minimal ? 'border border-border' : 'bg-slate-100'
                  )}>
                    <DynamicIcon name={product.icon} className={cn('w-3 h-3', minimal ? 'text-muted-foreground' : 'text-slate-500')} />
                  </span>
                  {product.name}
                </a>
              ))}
            </div>
          </div>

          <div className="mb-2">
            <p className={cn(
              'text-[10px] font-bold uppercase tracking-widest px-2 mb-1',
              minimal ? 'text-muted-foreground' : 'text-slate-400'
            )}>Industries</p>
            <div className={cn(
              'divide-y',
              minimal
                ? 'rounded-lg border border-border divide-border'
                : 'rounded-xl bg-white/60 border border-black/[0.06] divide-black/[0.04]'
            )}>
              {allIndustries.map((industry) => (
                <a
                  key={industry.slug}
                  href={`/industries/${industry.slug}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2.5 text-[13px] font-medium transition-colors duration-100 cursor-pointer',
                    minimal
                      ? 'text-foreground hover:bg-muted/50'
                      : 'text-primary hover:bg-white/80 active:bg-white first:rounded-t-xl last:rounded-b-xl'
                  )}
                >
                  {!minimal && <span className="w-1.5 h-1.5 rounded-full bg-[#3D8FE8] shrink-0" />}
                  {industry.name}
                </a>
              ))}
            </div>
          </div>

          <div className={cn(
            'divide-y mb-3',
            minimal
              ? 'rounded-lg border border-border divide-border'
              : 'rounded-xl bg-white/60 border border-black/[0.06] divide-black/[0.04]'
          )}>
            {navItems.map((item, idx) => (
              <a
                key={`mobile-link-${idx}`}
                href={item.link}
                onClick={(e) => {
                  setIsMobileMenuOpen(false);
                  handleAnchorClick(e, item.link);
                }}
                className={cn(
                  'flex items-center gap-2 px-3 py-2.5 text-[13px] font-medium transition-colors duration-100 cursor-pointer',
                  minimal
                    ? 'text-foreground hover:bg-muted/50'
                    : 'text-primary hover:bg-white/80 active:bg-white first:rounded-t-xl last:rounded-b-xl'
                )}
              >
                {!minimal && <span className="w-1.5 h-1.5 rounded-full bg-[#6B5BD6] shrink-0" />}
                {item.name}
              </a>
            ))}
          </div>

          {mobileFooter ?? defaultMobileCta}
        </MobileNavMenu>
      </MobileNav>
    </Navbar>
  );
}
