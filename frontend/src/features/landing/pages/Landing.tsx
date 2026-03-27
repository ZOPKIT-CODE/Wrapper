import React, { Suspense, useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { useKindeAuth } from '@kinde-oss/kinde-auth-react'
import { motion, AnimatePresence } from 'framer-motion'
import { DynamicIcon } from '@/features/landing/components/Icons'
import { ArrowRight, Play, ChevronRight, FileText, GraduationCap, Users, Zap, Mail, Phone, MapPin, Menu, X, LayoutDashboard, Rocket, Shield, Clock, Globe, Workflow, CheckCircle2 } from 'lucide-react'
import api, { createCancelableRequest } from '@/lib/api'
import { Product } from '@/types'
import toast from 'react-hot-toast'
import { consumeSessionRecoveryReason } from '@/lib/auth/session-recovery'

const StackedCardsSection = React.lazy(() =>
  import('@/features/landing/components/StackedCardsSection').then(m => ({ default: m.StackedCardsSection }))
)
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

// Orbital ecosystem — positions computed via trig
const ORBITAL_R = 42;
const ORBIT_APPS = [
  { id: 'b2b-crm',            label: 'CRM',        icon: 'Briefcase' },
  { id: 'finance',            label: 'Finance',     icon: 'Landmark' },
  { id: 'operations',         label: 'Ops',         icon: 'Box' },
  { id: 'b2c-crm',            label: 'B2C',         icon: 'ShoppingCart' },
  { id: 'project-management', label: 'Projects',    icon: 'ClipboardList' },
  { id: 'hrms',               label: 'HRMS',        icon: 'UserCheck' },
  { id: 'esop-system',        label: 'ESOP',        icon: 'Award' },
  { id: 'affiliate-connect',  label: 'Affiliates',  icon: 'Link' },
  { id: 'flowtilla',          label: 'Flowtilla',   icon: 'GitBranch' },
  { id: 'zopkit-academy',     label: 'Academy',     icon: 'GraduationCap' },
  { id: 'zopkit-itsm',        label: 'ITSM',        icon: 'Wrench' },
].map((app, i, arr) => {
  const angle = (360 / arr.length) * i - 90;
  const rad = (angle * Math.PI) / 180;
  return { ...app, x: 50 + ORBITAL_R * Math.cos(rad), y: 50 + ORBITAL_R * Math.sin(rad) };
});

// Cross-product dependencies — smooth bezier curves show real data flows
// [fromIndex, toIndex, label] — describes what data flows between them
const DEPENDENCIES: [number, number, string][] = [
  [0, 1, 'Invoices'],    // CRM → Finance
  [0, 2, 'Orders'],      // CRM → Operations
  [1, 5, 'Payroll'],     // Finance → HRMS
  [1, 2, 'Costs'],       // Finance → Operations
  [4, 5, 'Resources'],   // Projects → HRMS
  [4, 1, 'Budgets'],     // Projects → Finance
  [5, 6, 'Equity'],      // HRMS → ESOP
  [7, 0, 'Referrals'],   // Affiliates → CRM
  [8, 4, 'Workflows'],   // Flowtilla → Projects
  [10, 4, 'Tickets'],    // ITSM → Projects
  [9, 5, 'Training'],    // Academy → HRMS
  [3, 0, 'Contacts'],    // B2C → CRM
];

// Compute a smooth quadratic bezier path curving inward toward center
function depPath(fromIdx: number, toIdx: number): string {
  const a = ORBIT_APPS[fromIdx];
  const b = ORBIT_APPS[toIdx];
  // Control point: midpoint pulled 40% toward center (50,50)
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const cx = mx + (50 - mx) * 0.45;
  const cy = my + (50 - my) * 0.45;
  return `M ${a.x} ${a.y} Q ${cx} ${cy} ${b.x} ${b.y}`;
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

  const businessApps = useMemo(() =>
    products.map(p => ({
      ...p,
      icon: (props: any) => <DynamicIcon name={p.iconName} {...props} />
    })),
    []
  );

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-teal-100 selection:text-teal-900 font-sans overflow-x-clip relative">

      {/* Background — clean geometric grid, slate-only palette */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(15,23,42,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.03)_1px,transparent_1px)] bg-[size:48px_48px]" />
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <line x1="0" y1="0" x2="100%" y2="100%" stroke="#0f172a" strokeWidth="1" opacity="0.02" />
          <line x1="100%" y1="0" x2="0" y2="100%" stroke="#0f172a" strokeWidth="1" opacity="0.02" />
          <rect x="85%" y="2%" width="12%" height="12%" rx="2" fill="none" stroke="#0f172a" strokeWidth="0.5" opacity="0.04" />
          <rect x="3%" y="80%" width="8%" height="8%" rx="2" fill="none" stroke="#0f172a" strokeWidth="0.5" opacity="0.04" />
        </svg>
      </div>

      {/* Resizable Navbar */}
      <Navbar>
        {/* Desktop Navigation */}
        <NavBody>
          <NavbarLogo />
          <div className="flex-1 flex flex-row items-center justify-center space-x-1 text-sm font-medium text-slate-600 transition duration-200 px-4 min-w-0">
            {/* Products Dropdown */}
            <div
              className="relative shrink-0"
              onMouseEnter={handleProductsMouseEnter}
              onMouseLeave={handleProductsMouseLeave}
            >
              <button
                className="px-3 py-2 text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1 whitespace-nowrap transition-colors"
              >
                Products
                <ChevronRight size={16} className={`transition-transform ${showProductsDropdown ? 'rotate-90' : ''}`} />
              </button>
              {showProductsDropdown && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                  {allProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => navigate({ to: `/products/${product.id}` })}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                    >
                      {product.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Industries Dropdown */}
            <div
              className="relative shrink-0"
              onMouseEnter={handleIndustriesMouseEnter}
              onMouseLeave={handleIndustriesMouseLeave}
            >
              <button
                className="px-3 py-2 text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1 whitespace-nowrap transition-colors"
              >
                Industries
                <ChevronRight size={16} className={`transition-transform ${showIndustriesDropdown ? 'rotate-90' : ''}`} />
              </button>
              {showIndustriesDropdown && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                  {allIndustries.map((industry) => (
                    <button
                      key={industry.slug}
                      onClick={() => navigate({ to: `/industries/${industry.slug}` })}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                    >
                      {industry.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {navItems.map((item) => (
              <a
                key={item.name}
                href={item.link}
                onClick={(e) => handleAnchorClick(e, item.link)}
                className="px-3 py-2 text-slate-600 hover:text-slate-900 font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {item.name}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            <NavbarButton
              variant={hasAuthenticatedSession ? "gradient" : "primary"}
              onClick={primaryCta.action}
              disabled={primaryCta.disabled}
              as="button"
              className="rounded-xl px-6 py-2.5 cursor-pointer"
            >
              {primaryCta.icon}
              {primaryCta.label}
            </NavbarButton>
          </div>
        </NavBody>

        {/* Mobile Navigation */}
        <MobileNav>
          <MobileNavHeader>
            <NavbarLogo />
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6 text-slate-700" />
              ) : (
                <Menu className="w-6 h-6 text-slate-700" />
              )}
            </button>
          </MobileNavHeader>

          <MobileNavMenu
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
          >
            <div className="mb-4">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-4">Products</div>
              {allProducts.map((product) => (
                <a
                  key={product.id}
                  href={`/products/${product.id}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-4 py-2 text-slate-700 hover:bg-slate-50 rounded-lg transition"
                >
                  {product.name}
                </a>
              ))}
            </div>
            <div className="mb-4">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-4">Industries</div>
              {allIndustries.map((industry) => (
                <a
                  key={industry.slug}
                  href={`/industries/${industry.slug}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-4 py-2 text-slate-700 hover:bg-slate-50 rounded-lg transition"
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
                className="relative text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <span className="block">{item.name}</span>
              </a>
            ))}
            <div className="flex w-full flex-col gap-3">
              <NavbarButton
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  primaryCta.action();
                }}
                variant={hasAuthenticatedSession ? "gradient" : "primary"}
                className="w-full rounded-xl cursor-pointer"
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

      {/* Hero Section */}
      <main className="relative pt-24 sm:pt-28 lg:pt-32 pb-8 sm:pb-12 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
        {/* Headline + CTA */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 text-white text-xs font-medium tracking-wide mb-6"
          >
            <Zap className="w-3 h-3" />
            11 Products. One Platform. Zero Silos.
          </motion.div>

          <div className="relative min-h-[90px] sm:min-h-[110px] lg:min-h-[130px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeProduct.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="absolute inset-x-0 top-0"
              >
                <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-[3.5rem] font-black tracking-tight leading-[1.1] text-slate-900">
                  {activeProduct.name}
                </h1>
                <p className="text-slate-500 text-sm sm:text-base lg:text-lg leading-relaxed max-w-lg mx-auto mt-3">
                  {activeProduct.description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="flex flex-col sm:flex-row justify-center gap-3 mt-5"
          >
            <button
              onClick={primaryCta.action}
              disabled={primaryCta.disabled}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm sm:text-base transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.97]"
            >
              {hasAuthenticatedSession && onboardingCompleted ? <LayoutDashboard className="w-4 h-4" /> : null}
              {hasAuthenticatedSession && !onboardingCompleted ? <Rocket className="w-4 h-4" /> : null}
              {primaryCta.label}
              <ArrowRight className="w-4 h-4" />
            </button>
            <button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-sm sm:text-base transition-colors active:scale-[0.97]">
              <Play className="w-3.5 h-3.5 fill-current" />
              Watch Demo
            </button>
          </motion.div>

          <div className="flex flex-wrap justify-center items-center gap-x-5 gap-y-2 mt-6 text-xs text-slate-400 font-medium">
            <span className="inline-flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" />SOC 2</span>
            <span className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />99.9% Uptime</span>
            <span className="inline-flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" />GDPR</span>
          </div>
        </div>

        {/* Orbital Ecosystem with flowing dependency paths */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-xl sm:max-w-2xl lg:max-w-3xl mx-auto"
        >
          {/* ── Desktop orbital (sm+) ── */}
          <div className="hidden sm:block relative aspect-square">
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" aria-hidden="true">
              {/* Flow animation keyframe */}
              <defs>
                <style>{`
                  @keyframes flowDash {
                    to { stroke-dashoffset: -12; }
                  }
                  .dep-flow {
                    animation: flowDash 1.5s linear infinite;
                  }
                `}</style>
              </defs>

              {/* Orbit track */}
              <circle cx="50" cy="50" r={ORBITAL_R} fill="none" stroke="#e2e8f0" strokeWidth="0.25" />
              {/* Inner ring */}
              <circle cx="50" cy="50" r="12" fill="none" stroke="#f1f5f9" strokeWidth="0.2" />

              {/* Radial spokes — thin lines from hub to every node */}
              {ORBIT_APPS.map((app) => (
                <line
                  key={`spoke-${app.id}`}
                  x1="50" y1="50" x2={app.x} y2={app.y}
                  stroke={activeProduct.id === app.id ? '#0f172a' : '#f1f5f9'}
                  strokeWidth={activeProduct.id === app.id ? 0.4 : 0.15}
                  className="transition-all duration-400"
                />
              ))}

              {/* Dependency paths — smooth bezier curves between interdependent products */}
              {DEPENDENCIES.map(([from, to, label], i) => {
                const fromApp = ORBIT_APPS[from];
                const toApp = ORBIT_APPS[to];
                const isActive = activeProduct.id === fromApp.id || activeProduct.id === toApp.id;
                const d = depPath(from, to);
                // Midpoint for label
                const mx = (fromApp.x + toApp.x) / 2 + (50 - (fromApp.x + toApp.x) / 2) * 0.25;
                const my = (fromApp.y + toApp.y) / 2 + (50 - (fromApp.y + toApp.y) / 2) * 0.25;
                return (
                  <g key={`dep-${i}`}>
                    {/* Background path — always faintly visible */}
                    <path
                      d={d}
                      fill="none"
                      stroke="#f1f5f9"
                      strokeWidth="0.2"
                      className="transition-all duration-400"
                    />
                    {/* Active flowing path */}
                    {isActive && (
                      <>
                        <path
                          d={d}
                          fill="none"
                          stroke="#0f172a"
                          strokeWidth="0.6"
                          strokeLinecap="round"
                          opacity="0.15"
                        />
                        <path
                          d={d}
                          fill="none"
                          stroke="#0f172a"
                          strokeWidth="0.4"
                          strokeDasharray="3 3"
                          strokeLinecap="round"
                          className="dep-flow"
                        />
                        {/* Label at curve midpoint */}
                        <text
                          x={mx}
                          y={my - 1.2}
                          textAnchor="middle"
                          fill="#64748b"
                          fontSize="2"
                          fontWeight="600"
                          fontFamily="system-ui, sans-serif"
                        >
                          {label}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Center hub */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-900 flex items-center justify-center mx-auto shadow-lg">
                <Zap className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
              </div>
              <p className="text-[10px] sm:text-xs font-bold text-slate-800 mt-1.5 tracking-wide">ZOPKIT</p>
            </div>

            {/* Product nodes */}
            {ORBIT_APPS.map((app) => {
              const isActive = activeProduct.id === app.id;
              const matchingProduct = products.find(p => p.id === app.id);
              // Count how many dependencies this product has
              const depCount = DEPENDENCIES.filter(([f, t]) => ORBIT_APPS[f].id === app.id || ORBIT_APPS[t].id === app.id).length;
              return (
                <button
                  key={app.id}
                  ref={(el) => { if (el) productRefs.current.set(app.id, el); }}
                  onClick={() => { if (matchingProduct) setActiveProduct(matchingProduct); }}
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2 group focus:outline-none"
                  style={{ left: `${app.x}%`, top: `${app.y}%` }}
                  aria-label={`${app.label} — ${depCount} connections`}
                >
                  <div
                    className={`
                      relative w-11 h-11 sm:w-[52px] sm:h-[52px] lg:w-14 lg:h-14 rounded-2xl flex items-center justify-center transition-all duration-200 border-2
                      ${isActive
                        ? 'bg-slate-900 border-slate-900 shadow-lg scale-110'
                        : 'bg-white border-slate-200 shadow-sm group-hover:border-slate-400 group-hover:shadow-md group-hover:scale-105'}
                    `}
                  >
                    <DynamicIcon
                      name={app.icon}
                      className={`w-4 h-4 sm:w-5 sm:h-5 transition-colors duration-200 ${isActive ? 'text-white' : 'text-slate-600 group-hover:text-slate-800'}`}
                    />
                    {/* Connection count badge */}
                    <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-[7px] font-bold flex items-center justify-center transition-all duration-200 ${isActive ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}`}>
                      {depCount}
                    </span>
                  </div>
                  <p className={`text-center text-[9px] sm:text-[10px] lg:text-xs font-semibold mt-1 transition-colors duration-200 whitespace-nowrap ${isActive ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-700'}`}>
                    {app.label}
                  </p>
                </button>
              );
            })}
          </div>

          {/* ── Mobile (below sm) — compact card list with dependency indicators ── */}
          <div className="sm:hidden">
            <div className="flex justify-center mb-3">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white">
                <Zap className="w-4 h-4" />
                <span className="text-sm font-bold">Zopkit</span>
              </div>
            </div>
            <div className="flex justify-center mb-2">
              <div className="w-px h-3 bg-slate-300" />
            </div>
            <div ref={scrollContainerRef} className="flex gap-2 overflow-x-auto pb-3 px-1 scrollbar-none">
              {ORBIT_APPS.map((app) => {
                const isActive = activeProduct.id === app.id;
                const matchingProduct = products.find(p => p.id === app.id);
                const depCount = DEPENDENCIES.filter(([f, t]) => ORBIT_APPS[f].id === app.id || ORBIT_APPS[t].id === app.id).length;
                return (
                  <button
                    key={app.id}
                    ref={(el) => { if (el) productRefs.current.set(app.id, el); }}
                    onClick={() => { if (matchingProduct) setActiveProduct(matchingProduct); }}
                    className={`
                      shrink-0 relative flex flex-col items-center gap-1 py-3 px-3 rounded-xl border-2 transition-all duration-200 min-w-[72px]
                      ${isActive ? 'bg-slate-900 border-slate-900 shadow-md' : 'bg-white border-slate-200'}
                    `}
                  >
                    <DynamicIcon name={app.icon} className={`w-5 h-5 transition-colors duration-200 ${isActive ? 'text-white' : 'text-slate-600'}`} />
                    <span className={`text-[10px] font-semibold ${isActive ? 'text-white' : 'text-slate-600'}`}>{app.label}</span>
                    <span className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[8px] font-bold flex items-center justify-center ${isActive ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-400'}`}>
                      {depCount}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Mobile dependency list for active product */}
            {(() => {
              const activeDeps = DEPENDENCIES.filter(([f, t]) =>
                ORBIT_APPS[f].id === activeProduct.id || ORBIT_APPS[t].id === activeProduct.id
              );
              if (activeDeps.length === 0) return null;
              return (
                <div className="mt-2 px-1">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Connected to</p>
                  <div className="flex flex-wrap gap-1.5">
                    {activeDeps.map(([f, t, label], i) => {
                      const other = ORBIT_APPS[f].id === activeProduct.id ? ORBIT_APPS[t] : ORBIT_APPS[f];
                      return (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-50 border border-slate-200 text-[10px] text-slate-600 font-medium">
                          <DynamicIcon name={other.icon} className="w-3 h-3 text-slate-400" />
                          {other.label}
                          <span className="text-slate-300">·</span>
                          <span className="text-slate-400 italic">{label}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Detail panel */}
          <div className="mt-5 sm:mt-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeProduct.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="bg-slate-50 rounded-xl border border-slate-200 p-4 sm:p-5"
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center shrink-0">
                    <DynamicIcon name={activeProduct.iconName} className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">{activeProduct.name}</h3>
                      {activeProduct.stats?.map((stat, i) => (
                        <span key={i} className="hidden sm:inline-flex text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 rounded px-1.5 py-0.5">
                          {stat.value} {stat.label}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">{activeProduct.tagline}</p>
                  </div>
                  <button
                    onClick={() => navigate({ to: `/products/${activeProduct.id}` })}
                    className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors shrink-0"
                  >
                    Explore <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 mt-3">
                  {activeProduct.features.slice(0, 4).map((feat, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-slate-100 text-[10px] sm:text-xs text-slate-600 font-medium">
                      <DynamicIcon name={feat.icon} className="w-3 h-3 text-slate-400" />
                      {feat.title}
                    </span>
                  ))}
                  {activeProduct.features.length > 4 && (
                    <button
                      onClick={() => navigate({ to: `/products/${activeProduct.id}` })}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] sm:text-xs text-slate-400 font-medium hover:text-slate-600 transition-colors"
                    >
                      +{activeProduct.features.length - 4} more
                    </button>
                  )}
                </div>

                <button
                  onClick={() => navigate({ to: `/products/${activeProduct.id}` })}
                  className="sm:hidden mt-3 w-full inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium"
                >
                  Explore {activeProduct.name} <ArrowRight className="w-3 h-3" />
                </button>
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </main>

      {/* Solutions by product — vertical scrolling cards */}
      <section id="solutions">
        <Suspense fallback={<div className="min-h-[500px]" />}>
          <StackedCardsSection
            businessApps={businessApps}
            activeProduct={activeProduct}
            onProductChange={setActiveProduct}
          />
        </Suspense>
      </section>
      <section id="workflows" className="py-10 bg-white" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 800px' }}>
        <Suspense fallback={<div className="min-h-[400px]" />}>
          <WorkflowVisualizer />
        </Suspense>
      </section>

      {/* Industries Section */}
      <section id="industries" className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-slate-50" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 900px' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Solutions by Industry
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Every industry has unique challenges. Discover how our platform is tailored to your specific needs.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {getAllIndustries().map((industry) => {
              // Map industry slugs to icon names and gradients
              const industryConfig: Record<string, { icon: string; gradient: string }> = {
                'e-commerce': { icon: 'ShoppingCart', gradient: 'from-orange-500 to-amber-600' },
                'saas': { icon: 'Briefcase', gradient: 'from-blue-500 to-indigo-600' },
                'manufacturing': { icon: 'Box', gradient: 'from-slate-600 to-slate-800' },
                'professional-services': { icon: 'Users', gradient: 'from-purple-500 to-pink-600' }
              };
              
              const config = industryConfig[industry.slug] || { icon: 'Building2', gradient: 'from-slate-500 to-slate-700' };
              const topStats = industry.hero.stats.slice(0, 2);
              
              return (
                <div
                  key={industry.slug}
                  className="bg-white rounded-2xl border border-slate-200 shadow-lg hover:shadow-xl hover:-translate-y-2 hover:scale-[1.02] transition-all duration-300 overflow-hidden group cursor-pointer"
                  onClick={() => navigate({ to: `/industries/${industry.slug}` })}
                >
                  <div className={`h-2 bg-gradient-to-r ${config.gradient}`} />
                  <div className="p-6">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center mb-4 text-white`}>
                      <DynamicIcon name={config.icon} className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">
                      {industry.name}
                    </h3>
                    <p className="text-slate-600 mb-4 text-sm leading-relaxed">
                      {industry.hero.subheadline}
                    </p>
                    <div className="space-y-2 mb-4">
                      {topStats.map((stat, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-slate-600">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          {stat.label}: {stat.value}
                        </div>
                      ))}
                    </div>
                    <button className="w-full mt-4 px-4 py-2.5 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-600 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 group-hover:bg-blue-50 group-hover:text-blue-600">
                      Explore Solution
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Contact Us Section */}
      <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 bg-white" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 1000px' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Get in Touch
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12 max-w-6xl mx-auto">
            {/* Contact Information */}
            <div className="space-y-8">
              <div>
                <h3 className="text-2xl font-bold text-slate-900 mb-6">Contact Information</h3>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                      <Mail className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-1">Email</h4>
                      <a href="mailto:sales@zopkit.com" className="text-slate-600 hover:text-blue-600 transition-colors">
                        sales@zopkit.com
                      </a>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                      <Phone className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-1">Phone</h4>
                      <p className="text-slate-600">8971055515</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                      <MapPin className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 mb-1">Address</h4>
                      <p className="text-slate-600">
                        Hi-Tech City, Hyderabad
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="pt-8 border-t border-slate-200">
                <h4 className="font-semibold text-slate-900 mb-4">Business Hours</h4>
                <div className="space-y-2 text-slate-600">
                  <p>Monday - Friday: 9:00 AM - 6:00 PM PST</p>
                  <p>Saturday - Sunday: Closed</p>
                </div>
              </div>
            </div>
            
            {/* Contact Form */}
            <div className="bg-slate-50 p-6 md:p-8 rounded-2xl border border-slate-200 overflow-hidden">
              <h3 className="text-2xl font-bold text-slate-900 mb-6">Send us a Message</h3>
              <form 
                className="max-w-full"
                onSubmit={async (e) => {
                  e.preventDefault()
                  setIsSubmittingContact(true)
                  
                  try {
                    const response = await api.post('/contact/submit', contactForm)
                    
                    if (response.data.success) {
                      toast.success('Thank you for contacting us! We will get back to you soon.')
                      // Reset form
                      setContactForm({
                        name: '',
                        email: '',
                        company: '',
                        phone: '',
                        jobTitle: '',
                        companySize: '',
                        preferredTime: '',
                        comments: ''
                      })
                    } else {
                      throw new Error(response.data.message || 'Failed to submit contact form')
                    }
                  } catch (error: any) {
                    console.error('Contact form submission error:', error)
                    toast.error(error.response?.data?.message || 'Failed to submit contact form. Please try again.')
                  } finally {
                    setIsSubmittingContact(false)
                  }
                }}
              >
                {/* Top Section: Two Columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 mb-5">
                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      required
                      value={contactForm.name}
                      onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-2.5 md:py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-sm md:text-base"
                      placeholder="John Smith"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      value={contactForm.email}
                      onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-4 py-2.5 md:py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-sm md:text-base"
                      placeholder="john@company.com"
                    />
                  </div>
                </div>
                
                {/* Bottom Section: Two Columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 mb-5">
                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-slate-700 mb-2">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      id="company"
                      name="company"
                      required
                      value={contactForm.company}
                      onChange={(e) => setContactForm(prev => ({ ...prev, company: e.target.value }))}
                      className="w-full px-4 py-2.5 md:py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-sm md:text-base"
                      placeholder="Acme Corporation"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={contactForm.phone}
                      onChange={(e) => setContactForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-4 py-2.5 md:py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-sm md:text-base"
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>
                
                {/* Second Row: Two Columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 mb-5">
                  <div>
                    <label htmlFor="jobTitle" className="block text-sm font-medium text-slate-700 mb-2">
                      Job Title *
                    </label>
                    <input
                      type="text"
                      id="jobTitle"
                      name="jobTitle"
                      required
                      value={contactForm.jobTitle}
                      onChange={(e) => setContactForm(prev => ({ ...prev, jobTitle: e.target.value }))}
                      className="w-full px-4 py-2.5 md:py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-sm md:text-base"
                      placeholder="CEO, CTO, Manager..."
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="companySize" className="block text-sm font-medium text-slate-700 mb-2">
                      Company Size
                    </label>
                    <select
                      id="companySize"
                      name="companySize"
                      value={contactForm.companySize}
                      onChange={(e) => setContactForm(prev => ({ ...prev, companySize: e.target.value }))}
                      className="w-full px-4 py-2.5 md:py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-sm md:text-base"
                    >
                      <option value="">Select company size</option>
                      <option value="1-10">1-10 employees</option>
                      <option value="11-50">11-50 employees</option>
                      <option value="51-200">51-200 employees</option>
                      <option value="201-500">201-500 employees</option>
                      <option value="501-1000">501-1000 employees</option>
                      <option value="1000+">1000+ employees</option>
                    </select>
                  </div>
                </div>
                
                {/* Preferred Demo Time: Full Width */}
                <div className="mb-5">
                  <label htmlFor="preferredTime" className="block text-sm font-medium text-slate-700 mb-2">
                    Preferred Demo Time
                  </label>
                  <select
                    id="preferredTime"
                    name="preferredTime"
                    className="w-full px-4 py-2.5 md:py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white text-sm md:text-base"
                  >
                    <option value="">Select preferred time</option>
                    <option value="morning">Morning (9 AM - 12 PM)</option>
                    <option value="afternoon">Afternoon (12 PM - 5 PM)</option>
                    <option value="evening">Evening (5 PM - 8 PM)</option>
                    <option value="flexible">Flexible</option>
                  </select>
                </div>
                
                {/* Additional Comments: Full Width */}
                <div className="mb-5">
                  <label htmlFor="comments" className="block text-sm font-medium text-slate-700 mb-2">
                    Additional Comments
                  </label>
                  <textarea
                    id="comments"
                    name="comments"
                    rows={5}
                    value={contactForm.comments}
                    onChange={(e) => setContactForm(prev => ({ ...prev, comments: e.target.value }))}
                    className="w-full px-4 py-2.5 md:py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-none bg-white text-sm md:text-base"
                    placeholder="Tell us about your specific needs or questions..."
                  />
                </div>
                
                {/* Send Message Button at Bottom */}
                <div className="flex justify-center">
                  <button
                    type="submit"
                    disabled={isSubmittingContact}
                    className="w-full md:w-auto px-8 py-2.5 md:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors text-sm md:text-base shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmittingContact ? 'Sending...' : 'Send Message'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Resources Section */}
      <section id="resources" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 600px' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Resources & Support
            </h2>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              Everything you need to get started and succeed with Zopkit.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 hover:border-blue-300 transition cursor-pointer group">
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4 group-hover:bg-blue-600 transition">
                <FileText className="w-6 h-6 text-blue-600 group-hover:text-white transition" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Documentation</h3>
              <p className="text-slate-600 text-sm">Comprehensive guides and API docs</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 hover:border-blue-300 transition cursor-pointer group">
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4 group-hover:bg-blue-600 transition">
                <GraduationCap className="w-6 h-6 text-blue-600 group-hover:text-white transition" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Academy</h3>
              <p className="text-slate-600 text-sm">Video tutorials and courses</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 hover:border-blue-300 transition cursor-pointer group">
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4 group-hover:bg-blue-600 transition">
                <Users className="w-6 h-6 text-blue-600 group-hover:text-white transition" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Community</h3>
              <p className="text-slate-600 text-sm">Join our user community</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 hover:border-blue-300 transition cursor-pointer group">
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4 group-hover:bg-blue-600 transition">
                <Zap className="w-6 h-6 text-blue-600 group-hover:text-white transition" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Support</h3>
              <p className="text-slate-600 text-sm">24/7 customer support</p>
            </div>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  )
}

export default Landing
