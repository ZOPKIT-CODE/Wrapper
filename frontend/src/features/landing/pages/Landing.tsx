import React, { Suspense, useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { useKindeAuth } from '@kinde-oss/kinde-auth-react'
import { motion, AnimatePresence } from 'framer-motion'
import { DynamicIcon } from '@/features/landing/components/Icons'
import { ArrowRight, Play, ChevronRight, FileText, GraduationCap, Users, Zap, Mail, Phone, MapPin, Menu, X, LayoutDashboard, Rocket, Workflow } from 'lucide-react'
import api, { createCancelableRequest } from '@/lib/api'
import { Product } from '@/types'
import toast from 'react-hot-toast'
import { consumeSessionRecoveryReason } from '@/lib/auth/session-recovery'

const WorkflowVisualizer = React.lazy(() =>
  import('@/features/landing/components/WorkflowVisualizer').then(m => ({ default: m.WorkflowVisualizer }))
)
// VisualHub removed from hero for performance — available for other sections if needed
import { products } from '@/data/content'
import { getAllIndustries } from '@/data/industryPages'

// Import the new resizable navbar components
import {
  Navbar,
  NavBody,
  MobileNav,
  NavbarLogo,
  NavbarButton,
  MobileNavHeader,
  MobileNavMenu,
} from "@/components/ui/resizable-navbar"
import { LandingFooter } from "@/components/layout/LandingFooter"

const ALL_PRODUCTS = [
  { id: 'operations-management', name: 'Operations Management' },
  { id: 'b2b-crm', name: 'B2B CRM' },
  { id: 'financial-accounting', name: 'Financial Accounting' },
  { id: 'project-management', name: 'Project Management' },
  { id: 'hrms', name: 'HRMS' },
  { id: 'esop-system', name: 'ESOP System' },
  { id: 'affiliate-connect', name: 'Affiliate Connect' },
  { id: 'flowtilla', name: 'Flowtilla' },
  { id: 'zopkit-academy', name: 'Zopkit Academy' },
  { id: 'zopkit-itsm', name: 'Zopkit ITSM' },
  { id: 'b2c-crm', name: 'B2C CRM' },
] as const;

const ALL_INDUSTRIES = [
  { slug: 'e-commerce', name: 'E-Commerce & Retail' },
  { slug: 'saas', name: 'SaaS & Technology' },
  { slug: 'manufacturing', name: 'Manufacturing' },
  { slug: 'professional-services', name: 'Professional Services' },
] as const;

const NAV_ITEMS = [
  { name: "Pricing", link: "/pricing" },
  { name: "Workflows", link: "#workflows" },
  { name: "Contact Us", link: "#contact" },
] as const;

// Orbital ecosystem — clockwise from B2B CRM at top
const ORBITAL_R = 40;
const ORBIT_APPS = [
  { id: 'b2b-crm',            label: 'B2B CRM',     icon: 'Briefcase' },
  { id: 'b2c-crm',            label: 'B2C CRM',     icon: 'ShoppingCart' },
  { id: 'finance',            label: 'Finance',      icon: 'Landmark' },
  { id: 'operations',         label: 'Operations',   icon: 'Box' },
  { id: 'project-management', label: 'Projects',     icon: 'ClipboardList' },
  { id: 'hrms',               label: 'HRMS',         icon: 'UserCheck' },
  { id: 'esop-system',        label: 'ESOP',         icon: 'Award' },
  { id: 'affiliate-connect',  label: 'Affiliates',   icon: 'Link' },
  { id: 'flowtilla',          label: 'Flowtilla',    icon: 'GitBranch' },
  { id: 'zopkit-academy',     label: 'Academy',      icon: 'GraduationCap' },
  { id: 'zopkit-itsm',        label: 'ITSM',         icon: 'Wrench' },
].map((app, i, arr) => {
  const angle = (360 / arr.length) * i - 90; // starts at top, goes clockwise
  const rad = (angle * Math.PI) / 180;
  return { ...app, x: 50 + ORBITAL_R * Math.cos(rad), y: 50 + ORBITAL_R * Math.sin(rad) };
});

// Cross-product dependencies — indices match ORBIT_APPS order above
// 0:B2B CRM  1:B2C CRM  2:Finance  3:Operations  4:Projects  5:HRMS
// 6:ESOP(hub) 7:Affiliates 8:Flowtilla 9:Academy(hub) 10:ITSM
const DEPENDENCIES: [number, number, string][] = [
  [0, 2, 'Invoices'],    // B2B CRM → Finance
  [0, 3, 'Orders'],      // B2B CRM → Operations
  [1, 0, 'Contacts'],    // B2C CRM → B2B CRM
  [2, 5, 'Payroll'],     // Finance → HRMS
  [2, 3, 'Costs'],       // Finance → Operations
  [4, 5, 'Resources'],   // Projects → HRMS
  [4, 2, 'Budgets'],     // Projects → Finance
  [7, 0, 'Referrals'],   // Affiliates → B2B CRM
  [8, 4, 'Workflows'],   // Flowtilla → Projects
  [10, 4, 'Tickets'],    // ITSM → Projects
];

// Products that connect to hub (Zopkit) instead of to another product
// Their spoke lights up ONLY when selected — same behavior as other deps
const HUB_PRODUCT_LABELS: Record<string, string> = {
  'esop-system': 'Equity Plans',
  'zopkit-academy': 'Learning',
};

// Smooth bezier path curving inward
function depPath(fromIdx: number, toIdx: number): string {
  const a = ORBIT_APPS[fromIdx];
  const b = ORBIT_APPS[toIdx];
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const cx = mx + (50 - mx) * 0.45;
  const cy = my + (50 - my) * 0.45;
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
}

// Label position: pushed OUTWARD from center so it doesn't overlap nodes
function depLabelPos(fromIdx: number, toIdx: number): { x: number; y: number } {
  const a = ORBIT_APPS[fromIdx];
  const b = ORBIT_APPS[toIdx];
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  // Push outward from center by 8 units
  const dx = mx - 50;
  const dy = my - 50;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  return { x: mx + (dx / dist) * 6, y: my + (dy / dist) * 6 };
}

const Landing: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated } = useKindeAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [activeProduct, setActiveProduct] = useState<Product>(products[0])
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [onboardingCompleted, setOnboardingCompleted] = useState(false)
  const [backendAuthenticated, setBackendAuthenticated] = useState<boolean | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [showProductsDropdown, setShowProductsDropdown] = useState(false)
  const [showIndustriesDropdown, setShowIndustriesDropdown] = useState(false)
  const productsDropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const industriesDropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Contact form state
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
    jobTitle: '',
    companySize: '',
    preferredTime: '',
    comments: ''
  })
  const [isSubmittingContact, setIsSubmittingContact] = useState(false)

  // Refs for auto-scrolling
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const productRefs = useRef<Map<string | number, HTMLButtonElement>>(new Map())

  // Scroll to top when landing page loads
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    const recoveryReason = consumeSessionRecoveryReason()
    if (recoveryReason === 'invalid_grant' || recoveryReason === 'session_expired') {
      toast.error('Your session has expired. Please sign in again.', {
        id: 'session-expired',
        duration: 6000,
        position: 'top-center',
      })
    }
  }, [])

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Check authentication and onboarding status in background
  useEffect(() => {
    const { signal, cancel } = createCancelableRequest()

    const checkAuthenticatedUser = async () => {
      try {
        const response = await api.get('/admin/auth-status', { signal })
        const auth = response.data?.authStatus
        const isBackendAuth = auth?.isAuthenticated === true

        setBackendAuthenticated(isBackendAuth)

        if (isBackendAuth) {
          const hasCompletedOnboarding =
            auth?.onboardingCompleted === true ||
            auth?.needsOnboarding === false

          setOnboardingCompleted(hasCompletedOnboarding)
        } else {
          setOnboardingCompleted(false)
        }
      } catch {
        // Fall back to Kinde state when backend auth status is unavailable
        setBackendAuthenticated(null)
      }
      setAuthChecked(true)
    }

    const timer = setTimeout(checkAuthenticatedUser, 100)
    return () => {
      clearTimeout(timer)
      cancel()
    }
  }, [isAuthenticated])

  // Auto-rotate products every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveProduct((prev) => {
        const currentIndex = products.findIndex((p) => p.id === prev.id);
        const nextIndex = (currentIndex + 1) % products.length;
        return products[nextIndex];
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to active product
  useEffect(() => {
    const activeButton = productRefs.current.get(activeProduct.id);
    const scrollContainer = scrollContainerRef.current;

    if (activeButton && scrollContainer) {
      // Calculate the position to scroll to center the active button
      const containerWidth = scrollContainer.offsetWidth;
      const buttonLeft = activeButton.offsetLeft;
      const buttonWidth = activeButton.offsetWidth;

      // Center the button in the container
      const scrollPosition = buttonLeft - (containerWidth / 2) + (buttonWidth / 2);

      scrollContainer.scrollTo({
        left: scrollPosition,
        behavior: 'smooth'
      });
    }
  }, [activeProduct]);

  const handleLogin = async () => {
    setIsLoading(true)
    try {
      // Get Google connection ID from environment variable for custom auth
      const googleConnectionId = import.meta.env.VITE_KINDE_GOOGLE_CONNECTION_ID
      
      if (!googleConnectionId) {
        console.error('❌ VITE_KINDE_GOOGLE_CONNECTION_ID is not configured')
        // Fallback to standard login if connection ID not configured
        await login()
      } else {
        // Use Kinde custom auth with connection ID
        await login({ connectionId: googleConnectionId })
      }
    } catch (error) {
      console.error('Login error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const allProducts = ALL_PRODUCTS;

  const handleProductsMouseEnter = useCallback(() => {
    if (productsDropdownTimeoutRef.current) {
      clearTimeout(productsDropdownTimeoutRef.current);
    }
    setShowProductsDropdown(true);
  }, []);

  const handleProductsMouseLeave = useCallback(() => {
    productsDropdownTimeoutRef.current = setTimeout(() => {
      setShowProductsDropdown(false);
    }, 300);
  }, []);

  const allIndustries = ALL_INDUSTRIES;

  const handleIndustriesMouseEnter = useCallback(() => {
    if (industriesDropdownTimeoutRef.current) {
      clearTimeout(industriesDropdownTimeoutRef.current);
    }
    setShowIndustriesDropdown(true);
  }, []);

  const handleIndustriesMouseLeave = useCallback(() => {
    industriesDropdownTimeoutRef.current = setTimeout(() => {
      setShowIndustriesDropdown(false);
    }, 300);
  }, []);

  // Handle nav links: path links use React Router; hash links scroll in-page
  const handleAnchorClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith('/')) {
      e.preventDefault();
      navigate({ to: href });
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
  }, [navigate]);

  const navItems = NAV_ITEMS;

  const hasAuthenticatedSession = authChecked && (backendAuthenticated ?? isAuthenticated)

  const getPrimaryCtaConfig = () => {
    if (!authChecked) {
      return {
        label: 'Loading...',
        icon: null as React.ReactNode,
        action: () => undefined,
        disabled: true,
      }
    }

    if (!hasAuthenticatedSession) {
      return {
        label: isLoading ? 'Loading...' : 'Sign In',
        icon: null as React.ReactNode,
        action: handleLogin,
        disabled: isLoading,
      }
    }

    if (onboardingCompleted) {
      return {
        label: 'Go to Workspace',
        icon: <LayoutDashboard className="w-4 h-4 mr-2 inline" />,
        action: () => navigate({ to: '/dashboard' }),
        disabled: false,
      }
    }

    return {
      label: 'Complete onboarding',
      icon: <Rocket className="w-4 h-4 mr-2 inline" />,
      action: () => navigate({ to: '/onboarding' }),
      disabled: false,
    }
  }

  const primaryCta = getPrimaryCtaConfig()

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-teal-100 selection:text-teal-900 font-sans overflow-x-clip relative">

      {/* Gradient top band — fades from slate-100 to transparent */}
      <div className="absolute top-0 left-0 right-0 h-[500px] z-0 pointer-events-none bg-gradient-to-b from-slate-100/80 via-slate-50/40 to-transparent" />

      {/* Navbar */}
      <Navbar>
        {/* Desktop */}
        <NavBody>
          <NavbarLogo />
          <div className="flex-1 flex flex-row items-center justify-center gap-0.5 text-[13px] font-medium px-6 min-w-0">
            {/* Products */}
            <div
              className="relative shrink-0"
              onMouseEnter={handleProductsMouseEnter}
              onMouseLeave={handleProductsMouseLeave}
            >
              <button className="px-3 py-2 text-slate-500 hover:text-slate-900 font-medium flex items-center gap-1 whitespace-nowrap transition-colors duration-150 cursor-pointer">
                Products
                <ChevronRight size={14} className={`transition-transform duration-200 ${showProductsDropdown ? 'rotate-90' : ''}`} />
              </button>
              <AnimatePresence>
                {showProductsDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute top-full left-0 mt-2 w-[280px] z-50"
                  >
                    <div className="bg-white rounded-xl border border-slate-200 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.12)] overflow-hidden">
                      <div className="px-3 pt-3 pb-1.5">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Products</p>
                      </div>
                      <div className="px-1.5 pb-1.5 max-h-[400px] overflow-y-auto">
                        {allProducts.map((product) => (
                          <button
                            key={product.id}
                            onClick={() => navigate({ to: `/products/${product.id}` })}
                            className="w-full text-left px-3 py-2 text-[13px] text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors duration-100 flex items-center gap-2.5 rounded-lg cursor-pointer"
                          >
                            <span className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                              <DynamicIcon name={ORBIT_APPS.find(a => a.id === product.id)?.icon ?? 'Box'} className="w-3.5 h-3.5 text-slate-500" />
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

            {/* Industries */}
            <div
              className="relative shrink-0"
              onMouseEnter={handleIndustriesMouseEnter}
              onMouseLeave={handleIndustriesMouseLeave}
            >
              <button className="px-3 py-2 text-slate-500 hover:text-slate-900 font-medium flex items-center gap-1 whitespace-nowrap transition-colors duration-150 cursor-pointer">
                Industries
                <ChevronRight size={14} className={`transition-transform duration-200 ${showIndustriesDropdown ? 'rotate-90' : ''}`} />
              </button>
              <AnimatePresence>
                {showIndustriesDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute top-full left-0 mt-2 w-[240px] z-50"
                  >
                    <div className="bg-white rounded-xl border border-slate-200 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.12)] overflow-hidden">
                      <div className="px-3 pt-3 pb-1.5">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Industries</p>
                      </div>
                      <div className="px-1.5 pb-1.5">
                        {allIndustries.map((industry) => (
                          <button
                            key={industry.slug}
                            onClick={() => navigate({ to: `/industries/${industry.slug}` })}
                            className="w-full text-left px-3 py-2 text-[13px] text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium transition-colors duration-100 rounded-lg cursor-pointer"
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
                className="px-3 py-2 text-slate-500 hover:text-slate-900 font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0"
              >
                {item.name}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0 ml-4">
            <NavbarButton
              variant={hasAuthenticatedSession ? "gradient" : "primary"}
              onClick={primaryCta.action}
              disabled={primaryCta.disabled}
              as="button"
              className="text-[13px]"
            >
              {primaryCta.icon}
              {primaryCta.label}
            </NavbarButton>
          </div>
        </NavBody>

        {/* Mobile */}
        <MobileNav>
          <MobileNavHeader>
            <NavbarLogo />
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors duration-150 cursor-pointer"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5 text-slate-700" />
              ) : (
                <Menu className="w-5 h-5 text-slate-700" />
              )}
            </button>
          </MobileNavHeader>

          <MobileNavMenu
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
          >
            <div className="border-b border-slate-100 pb-3 mb-3">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-1.5">Products</p>
              {allProducts.map((product) => (
                <a
                  key={product.id}
                  href={`/products/${product.id}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-3 py-1.5 text-[13px] text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors duration-100 font-medium"
                >
                  {product.name}
                </a>
              ))}
            </div>

            <div className="border-b border-slate-100 pb-3 mb-3">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-1.5">Industries</p>
              {allIndustries.map((industry) => (
                <a
                  key={industry.slug}
                  href={`/industries/${industry.slug}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-3 py-1.5 text-[13px] text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors duration-100 font-medium"
                >
                  {industry.name}
                </a>
              ))}
            </div>

            {navItems.map((item, idx) => (
              <a
                key={`mobile-link-${idx}`}
                href={item.link}
                onClick={(e) => {
                  setIsMobileMenuOpen(false);
                  handleAnchorClick(e, item.link);
                }}
                className="block px-3 py-1.5 text-[13px] text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors duration-100 font-medium cursor-pointer"
              >
                {item.name}
              </a>
            ))}

            <div className="pt-3 mt-1">
              <NavbarButton
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  primaryCta.action();
                }}
                variant={hasAuthenticatedSession ? "gradient" : "primary"}
                className="w-full justify-center"
                as="button"
                disabled={primaryCta.disabled}
              >
                {primaryCta.icon}
                {primaryCta.label}
              </NavbarButton>
            </div>
          </MobileNavMenu>
        </MobileNav>
      </Navbar>

      {/* Hero */}
      <main className="relative pt-28 sm:pt-32 lg:pt-40 pb-16 sm:pb-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-12 items-start">

          {/* ── Left column (7 cols) ── */}
          <div className="lg:col-span-7 flex flex-col order-2 lg:order-1 lg:pt-6">

            {/* Headline block */}
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              {/* Mixed-weight headline — light intro, bold punchline */}
              <h1 className="text-slate-900 tracking-[-0.03em] leading-[1.08]">
                <span className="block text-[1.5rem] sm:text-[1.75rem] lg:text-[2rem] font-normal text-slate-400">
                  Your CRM, Finance, HR, Ops &amp; more —
                </span>
                <span className="block text-[2.25rem] sm:text-[3rem] lg:text-[3.5rem] xl:text-[4rem] font-extrabold mt-1">
                  finally talking<br className="hidden lg:block" /> to each other.
                </span>
              </h1>

              {/* Value prop — short, benefit-focused */}
              <p className="text-slate-500 text-base sm:text-[17px] leading-[1.65] max-w-[26rem] mt-5">
                Zopkit replaces your disconnected stack with 11 integrated apps. One login, one source of truth, zero data entry duplication.
              </p>
            </motion.div>

            {/* CTAs */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="flex flex-col sm:flex-row items-start gap-3 mt-7">
              <button
                onClick={primaryCta.action}
                disabled={primaryCta.disabled}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-lg bg-[#1B2E5A] hover:bg-[#243B6E] active:bg-[#152345] text-white font-semibold text-[15px] cursor-pointer transition-all duration-150 active:scale-[0.97] shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {hasAuthenticatedSession && onboardingCompleted ? <LayoutDashboard className="w-4 h-4" /> : null}
                {hasAuthenticatedSession && !onboardingCompleted ? <Rocket className="w-4 h-4" /> : null}
                {primaryCta.label}
                <ArrowRight className="w-4 h-4" />
              </button>
              <button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full text-slate-500 hover:text-slate-900 font-medium text-[15px] transition-colors active:scale-[0.97]">
                <Play className="w-4 h-4 fill-current" />
                Watch demo
              </button>
            </motion.div>

            {/* Product explorer — tighter, more visual */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.2 }} className="mt-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeProduct.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="group rounded-xl bg-slate-50 hover:bg-slate-100/80 transition-colors p-4 cursor-pointer"
                  onClick={() => navigate({ to: `/products/${activeProduct.id}` })}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
                      <DynamicIcon name={activeProduct.iconName} className="w-[18px] h-[18px] text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-900 leading-tight">{activeProduct.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{activeProduct.tagline}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                  {/* Connections inline */}
                  {(() => {
                    const deps = DEPENDENCIES.filter(([f, t]) =>
                      ORBIT_APPS[f].id === activeProduct.id || ORBIT_APPS[t].id === activeProduct.id
                    );
                    const hubLabel = HUB_PRODUCT_LABELS[activeProduct.id];
                    const names = [
                      ...(hubLabel ? ['Zopkit'] : []),
                      ...deps.map(([f, t]) => {
                        const other = ORBIT_APPS[f].id === activeProduct.id ? ORBIT_APPS[t] : ORBIT_APPS[f];
                        return other.label;
                      }),
                    ];
                    if (names.length === 0) return null;
                    return (
                      <p className="text-[11px] text-slate-400 mt-2 ml-12">
                        Connects to {names.join(', ')}
                      </p>
                    );
                  })()}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </div>

          {/* ── Right column: orbital (5 cols) ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.06 }}
            className="lg:col-span-5 relative aspect-square max-w-[320px] sm:max-w-[380px] lg:max-w-none mx-auto lg:mx-0 order-1 lg:order-2"
          >
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" aria-hidden="true">
              <defs>
                <style>{`
                  @keyframes flowDash { to { stroke-dashoffset: -12; } }
                  .dep-flow { animation: flowDash 1.5s linear infinite; }
                `}</style>
              </defs>

              {/* Orbit track */}
              <circle cx="50" cy="50" r={ORBITAL_R} fill="none" stroke="#e2e8f0" strokeWidth="0.25" />

              {/* Spokes — all identical, only active product's spoke lights up */}
              {ORBIT_APPS.map((app) => {
                const isActive = activeProduct.id === app.id;
                return (
                  <line key={`spoke-${app.id}`} x1="50" y1="50" x2={app.x} y2={app.y}
                    stroke={isActive ? '#0f172a' : '#f1f5f9'}
                    strokeWidth={isActive ? 0.5 : 0.1}
                    className="transition-all duration-300"
                  />
                );
              })}

              {/* Dependency flow paths with outward-positioned labels */}
              {DEPENDENCIES.map(([from, to, label], i) => {
                const fromApp = ORBIT_APPS[from];
                const toApp = ORBIT_APPS[to];
                const isActive = activeProduct.id === fromApp.id || activeProduct.id === toApp.id;
                if (!isActive) return null;
                const d = depPath(from, to);
                const lbl = depLabelPos(from, to);
                return (
                  <g key={`dep-${i}`}>
                    <path d={d} fill="none" stroke="#0f172a" strokeWidth="0.5" strokeLinecap="round" opacity="0.06" />
                    <path d={d} fill="none" stroke="#0f172a" strokeWidth="0.3" strokeDasharray="2 2.5" strokeLinecap="round" className="dep-flow" />
                    {/* Label positioned outward from center — avoids node overlap */}
                    <text x={lbl.x} y={lbl.y} textAnchor="middle" dominantBaseline="central" fill="#94a3b8" fontSize="1.8" fontWeight="600" fontFamily="system-ui, sans-serif">{label}</text>
                  </g>
                );
              })}

              {/* Hub-connected products (ESOP, Academy) — show flow on spoke when active */}
              {ORBIT_APPS.map((app) => {
                const hubLabel = HUB_PRODUCT_LABELS[app.id];
                if (!hubLabel || activeProduct.id !== app.id) return null;
                // Flow animation on the spoke itself
                const lx = 50 + (app.x - 50) * 0.55;
                const ly = 50 + (app.y - 50) * 0.55;
                return (
                  <g key={`hub-flow-${app.id}`}>
                    <line x1="50" y1="50" x2={app.x} y2={app.y} stroke="#0f172a" strokeWidth="0.3" strokeDasharray="2 2.5" strokeLinecap="round" className="dep-flow" />
                    <text x={lx} y={ly - 1.5} textAnchor="middle" fill="#94a3b8" fontSize="1.8" fontWeight="600" fontFamily="system-ui, sans-serif">{hubLabel}</text>
                  </g>
                );
              })}
            </svg>

            {/* Center hub */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-full bg-slate-900 flex items-center justify-center mx-auto overflow-hidden ring-4 ring-white">
                <img
                  src="https://res.cloudinary.com/dr9vzaa7u/image/upload/v1765126845/Zopkit_Simple_Logo_glohfr.jpg"
                  alt="Zopkit"
                  className="w-full h-full rounded-full object-cover"
                  loading="eager"
                />
              </div>
            </div>

            {/* Product nodes */}
            {ORBIT_APPS.map((app) => {
              const isActive = activeProduct.id === app.id;
              const matchingProduct = products.find(p => p.id === app.id);
              return (
                <button
                  key={app.id}
                  ref={(el) => { if (el) productRefs.current.set(app.id, el); }}
                  onClick={() => { if (matchingProduct) setActiveProduct(matchingProduct); }}
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2 group focus:outline-none"
                  style={{ left: `${app.x}%`, top: `${app.y}%` }}
                  aria-label={app.label}
                >
                  <div className={`
                    w-10 h-10 sm:w-12 sm:h-12 lg:w-[52px] lg:h-[52px] rounded-xl flex items-center justify-center transition-all duration-200
                    ${isActive
                      ? 'bg-slate-900 ring-2 ring-slate-900 ring-offset-2 ring-offset-[#fafafa] scale-110'
                      : 'bg-white border border-slate-200 group-hover:border-slate-300 group-hover:shadow-md group-hover:scale-105'}
                  `}>
                    <DynamicIcon name={app.icon} className={`w-4 h-4 sm:w-[18px] sm:h-[18px] transition-colors duration-200 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-700'}`} />
                  </div>
                  <p className={`text-center text-[8px] sm:text-[9px] lg:text-[10px] font-medium mt-1 transition-colors duration-200 whitespace-nowrap ${isActive ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-600'}`}>
                    {app.label}
                  </p>
                </button>
              );
            })}
          </motion.div>
        </div>

        {/* Mobile product selector */}
        <div ref={scrollContainerRef} className="lg:hidden mt-8 flex gap-1.5 overflow-x-auto pb-2 no-scrollbar">
          {ORBIT_APPS.map((app) => {
            const isActive = activeProduct.id === app.id;
            const matchingProduct = products.find(p => p.id === app.id);
            return (
              <button key={`strip-${app.id}`} onClick={() => { if (matchingProduct) setActiveProduct(matchingProduct); }}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${isActive ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                <DynamicIcon name={app.icon} className="w-3.5 h-3.5" />
                {app.label}
              </button>
            );
          })}
        </div>
      </main>

      <section id="workflows" className="py-16 sm:py-20 lg:py-24 bg-white" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 800px' }}>
        <Suspense fallback={<div className="min-h-[400px]" />}>
          <WorkflowVisualizer />
        </Suspense>
      </section>

      {/* Industries Section */}
      <section id="industries" className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 bg-white" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 700px' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <p className="text-sm font-semibold text-slate-400 tracking-wide mb-3">Industries</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-[-0.025em]">
              Built for how you work
            </h2>
            <p className="text-slate-500 text-base sm:text-lg max-w-lg mx-auto mt-4 leading-relaxed">
              Tailored solutions for the unique challenges of your industry.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {getAllIndustries().map((industry) => {
              const iconMap: Record<string, string> = {
                'e-commerce': 'ShoppingCart',
                'saas': 'Briefcase',
                'manufacturing': 'Box',
                'professional-services': 'Users',
              };
              const topStats = industry.hero.stats.slice(0, 2);

              return (
                <div
                  key={industry.slug}
                  className="group cursor-pointer rounded-2xl bg-[#fafafa] hover:bg-slate-900 p-6 sm:p-7 transition-all duration-300 flex flex-col"
                  onClick={() => navigate({ to: `/industries/${industry.slug}` })}
                >
                  {/* Icon */}
                  <div className="w-11 h-11 rounded-xl bg-white group-hover:bg-white/10 flex items-center justify-center mb-6 transition-colors duration-300">
                    <DynamicIcon name={iconMap[industry.slug] ?? 'Building2'} className="w-5 h-5 text-slate-700 group-hover:text-white transition-colors duration-300" />
                  </div>

                  {/* Content */}
                  <h3 className="text-lg font-bold text-slate-900 group-hover:text-white mb-2 tracking-tight transition-colors duration-300">
                    {industry.name}
                  </h3>
                  <p className="text-sm text-slate-500 group-hover:text-slate-400 leading-relaxed mb-6 transition-colors duration-300 flex-1">
                    {industry.hero.subheadline}
                  </p>

                  {/* Stats */}
                  <div className="flex items-center gap-4 mb-6 pt-5 border-t border-slate-200/60 group-hover:border-white/10 transition-colors duration-300">
                    {topStats.map((stat, i) => (
                      <div key={i}>
                        <p className="text-lg font-extrabold text-slate-900 group-hover:text-white tracking-tight transition-colors duration-300">{stat.value}</p>
                        <p className="text-[11px] text-slate-400 group-hover:text-slate-500 transition-colors duration-300">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <span className="text-sm font-semibold text-slate-900 group-hover:text-white inline-flex items-center gap-1.5 transition-colors duration-300">
                    Explore <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

            {/* Contact Section */}
      <section id="contact" className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 bg-white border-t border-slate-100" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 700px' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <p className="text-sm font-semibold text-slate-400 tracking-wide mb-3">Contact</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-[-0.025em]">
              Talk to our team
            </h2>
            <p className="text-slate-500 text-base sm:text-lg max-w-lg mx-auto mt-4 leading-relaxed">
              Whether you&apos;re evaluating Zopkit for your company or have a specific question, we&apos;ll get back to you within one business day.
            </p>
          </div>

          <div className="grid lg:grid-cols-5 gap-8 lg:gap-12">
            {/* Left — quick info */}
            <div className="lg:col-span-2 space-y-5">
              {[
                { icon: Mail, label: 'Email', value: 'sales@zopkit.com', href: 'mailto:sales@zopkit.com' },
                { icon: Phone, label: 'Phone', value: '8971055515' },
                { icon: MapPin, label: 'Office', value: 'Hi-Tech City, Hyderabad' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#fafafa] flex items-center justify-center shrink-0">
                    <item.icon className="w-[18px] h-[18px] text-slate-500" />
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400 font-medium">{item.label}</p>
                    {item.href ? (
                      <a href={item.href} className="text-sm font-semibold text-slate-900 hover:text-slate-600 transition-colors">{item.value}</a>
                    ) : (
                      <p className="text-sm font-semibold text-slate-900">{item.value}</p>
                    )}
                  </div>
                </div>
              ))}
              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400">Mon – Fri, 9 AM – 6 PM IST</p>
              </div>
            </div>

            {/* Right — form */}
            <div className="lg:col-span-3">
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  setIsSubmittingContact(true)
                  try {
                    const response = await api.post('/contact/submit', contactForm)
                    if (response.data.success) {
                      toast.success("Thanks! We'll be in touch within one business day.")
                      setContactForm({ name: '', email: '', company: '', phone: '', jobTitle: '', companySize: '', preferredTime: '', comments: '' })
                    } else {
                      throw new Error(response.data.message || 'Failed to submit')
                    }
                  } catch (error: any) {
                    toast.error(error.response?.data?.message || 'Something went wrong. Please try again.')
                  } finally {
                    setIsSubmittingContact(false)
                  }
                }}
                className="space-y-4"
              >
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="c-name" className="block text-sm font-medium text-slate-700 mb-1.5">Name</label>
                    <input type="text" id="c-name" required value={contactForm.name} onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
                      placeholder="Jane Smith" />
                  </div>
                  <div>
                    <label htmlFor="c-email" className="block text-sm font-medium text-slate-700 mb-1.5">Work email</label>
                    <input type="email" id="c-email" required value={contactForm.email} onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
                      placeholder="jane@company.com" />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="c-company" className="block text-sm font-medium text-slate-700 mb-1.5">Company</label>
                    <input type="text" id="c-company" required value={contactForm.company} onChange={(e) => setContactForm(prev => ({ ...prev, company: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors"
                      placeholder="Acme Inc." />
                  </div>
                  <div>
                    <label htmlFor="c-size" className="block text-sm font-medium text-slate-700 mb-1.5">Team size</label>
                    <select id="c-size" value={contactForm.companySize} onChange={(e) => setContactForm(prev => ({ ...prev, companySize: e.target.value }))}
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors">
                      <option value="">Select</option>
                      <option value="1-10">1-10</option>
                      <option value="11-50">11-50</option>
                      <option value="51-200">51-200</option>
                      <option value="201-500">201-500</option>
                      <option value="500+">500+</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="c-msg" className="block text-sm font-medium text-slate-700 mb-1.5">How can we help?</label>
                  <textarea id="c-msg" rows={4} value={contactForm.comments} onChange={(e) => setContactForm(prev => ({ ...prev, comments: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors resize-none"
                    placeholder="Tell us about your use case, team size, or any questions..." />
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingContact}
                  className="w-full sm:w-auto px-7 py-3 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[15px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmittingContact ? 'Sending...' : 'Send message'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

{/* Resources Section */}
      <section id="resources" className="py-16 sm:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 bg-white border-t border-slate-100" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 500px' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <p className="text-sm font-semibold text-slate-400 tracking-wide mb-3">Resources</p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-[-0.025em]">
              Everything you need to succeed
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: FileText, title: 'Documentation', desc: 'Comprehensive guides and API docs' },
              { icon: GraduationCap, title: 'Academy', desc: 'Video tutorials and courses' },
              { icon: Users, title: 'Community', desc: 'Join our user community' },
              { icon: Zap, title: 'Support', desc: '24/7 customer support' },
            ].map((item) => (
              <div key={item.title} className="group cursor-pointer rounded-2xl bg-[#fafafa] hover:bg-slate-900 p-6 sm:p-7 transition-all duration-300">
                <div className="w-10 h-10 rounded-xl bg-white group-hover:bg-white/10 flex items-center justify-center mb-5 transition-colors duration-300">
                  <item.icon className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors duration-300" />
                </div>
                <h3 className="text-base font-bold text-slate-900 group-hover:text-white mb-1.5 tracking-tight transition-colors duration-300">
                  {item.title}
                </h3>
                <p className="text-sm text-slate-500 group-hover:text-slate-400 leading-relaxed transition-colors duration-300">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  )
}

export default Landing
