import React, { Suspense, useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { useKindeAuth } from '@kinde-oss/kinde-auth-react'
import { motion, AnimatePresence } from 'framer-motion'
import { DynamicIcon } from '@/features/landing/components/Icons'
import { ArrowRight, Play, ChevronRight, FileText, GraduationCap, Users, Zap, Mail, Phone, MapPin, Menu, X, LayoutDashboard, Rocket, Shield, Clock, Globe, BarChart3, Settings, CreditCard, UserCheck, Workflow, CheckCircle2, TrendingUp } from 'lucide-react'
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

// Product color → CSS-safe Tailwind color token for the interactive dashboard
const PRODUCT_ACCENT: Record<string, { bar: string; bg: string; text: string; border: string }> = {
  blue:   { bar: '#3b82f6', bg: 'bg-blue-50',   text: 'text-blue-600',   border: 'border-blue-200' },
  green:  { bar: '#10b981', bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  purple: { bar: '#a855f7', bg: 'bg-purple-50',  text: 'text-purple-600',  border: 'border-purple-200' },
  orange: { bar: '#f97316', bg: 'bg-orange-50',  text: 'text-orange-600',  border: 'border-orange-200' },
  indigo: { bar: '#6366f1', bg: 'bg-indigo-50',  text: 'text-indigo-600',  border: 'border-indigo-200' },
};
const DEFAULT_ACCENT = { bar: '#14b8a6', bg: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-200' };

// Bar chart heights per product (7 bars, values 20-90) — gives each product a unique chart shape
const PRODUCT_CHART_DATA: Record<string, number[]> = {
  'operations-management': [35, 55, 70, 50, 80, 90, 65],
  'b2b-crm':               [40, 65, 45, 75, 60, 85, 70],
  'financial-accounting':   [50, 40, 60, 80, 55, 70, 90],
  'project-management':     [30, 50, 75, 60, 85, 45, 70],
  'hrms':                   [45, 60, 35, 70, 55, 80, 65],
  'esop-system':            [55, 45, 65, 40, 75, 60, 85],
  'affiliate-connect':      [60, 75, 50, 65, 40, 80, 55],
  'flowtilla':              [35, 70, 55, 85, 65, 45, 75],
  'zopkit-academy':         [50, 60, 80, 45, 70, 55, 65],
  'zopkit-itsm':            [65, 45, 55, 75, 50, 85, 60],
  'b2c-crm':                [40, 70, 60, 50, 80, 65, 75],
};
const DEFAULT_BARS = [40, 55, 70, 50, 80, 65, 75];

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

      {/* Lightweight background — CSS-only, no blur, no fixed layers */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-teal-50/60" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-emerald-50/40" />
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
      <main className="relative pt-24 sm:pt-28 lg:pt-36 pb-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

          {/* Left Column: Text Content */}
          <div className="flex flex-col gap-5 relative z-20 order-2 lg:order-1">

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 border border-teal-200 w-fit"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
              <span className="text-teal-700 text-xs font-semibold tracking-wide">Trusted by 500+ companies</span>
            </motion.div>

            {/* Headline with rotating product name */}
            <div className="relative min-h-[110px] sm:min-h-[130px] lg:min-h-[170px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeProduct.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="absolute top-0 left-0 w-full"
                >
                  <h1 className="text-3xl sm:text-4xl lg:text-[3.5rem] xl:text-6xl font-black tracking-tight leading-[1.08] text-slate-900">
                    <span className={PRODUCT_ACCENT[activeProduct.color]?.text ?? 'text-teal-600'}>
                      {activeProduct.name}
                    </span>
                  </h1>
                  <p className="text-slate-500 text-sm sm:text-base lg:text-lg leading-relaxed max-w-lg mt-3">
                    {activeProduct.description}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 }}
              className="flex flex-col sm:flex-row gap-3 mt-2"
            >
              <button
                onClick={primaryCta.action}
                disabled={primaryCta.disabled}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm sm:text-base shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.97]"
              >
                {hasAuthenticatedSession && onboardingCompleted ? <LayoutDashboard className="w-4 h-4" /> : null}
                {hasAuthenticatedSession && !onboardingCompleted ? <Rocket className="w-4 h-4" /> : null}
                {primaryCta.label}
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 font-semibold text-sm sm:text-base shadow-sm transition-all active:scale-[0.97]"
              >
                <Play className="w-3.5 h-3.5 fill-current text-slate-500" />
                Watch Demo
              </button>
            </motion.div>

            {/* Trust indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.4 }}
              className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-1 text-xs text-slate-500"
            >
              <span className="inline-flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-teal-500" />SOC 2</span>
              <span className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-teal-500" />99.9% Uptime</span>
              <span className="inline-flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-teal-500" />GDPR Ready</span>
              <span className="inline-flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-teal-500" />11 Products</span>
            </motion.div>

            {/* Product Selector — compact scrollable pills */}
            <div className="mt-3 pt-5 border-t border-slate-100">
              <p className="text-slate-400 text-[10px] sm:text-xs font-semibold tracking-widest uppercase mb-3">Select Application</p>
              <div ref={scrollContainerRef} className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
                {products.map((product) => {
                  const isActive = activeProduct.id === product.id;
                  const accent = PRODUCT_ACCENT[product.color] ?? DEFAULT_ACCENT;
                  return (
                    <button
                      key={product.id}
                      ref={(el) => {
                        if (el) productRefs.current.set(product.id, el);
                      }}
                      onClick={() => setActiveProduct(product)}
                      onDoubleClick={() => navigate({ to: `/products/${product.id}` })}
                      className={`
                        shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all duration-200
                        ${isActive
                          ? `${accent.bg} ${accent.border} ${accent.text} shadow-sm`
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 hover:shadow-sm'}
                      `}
                    >
                      <DynamicIcon name={product.iconName} className="w-3.5 h-3.5" />
                      {product.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Dashboard — reacts to activeProduct */}
          <div className="relative z-10 flex justify-center items-center order-1 lg:order-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="w-full max-w-md lg:max-w-lg"
            >
              {/* Dashboard Card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                {/* Titlebar */}
                <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: (PRODUCT_ACCENT[activeProduct.color] ?? DEFAULT_ACCENT).bar, transition: 'background-color 0.4s' }} />
                  <span className="w-3 h-3 rounded-full bg-slate-200" />
                  <span className="w-3 h-3 rounded-full bg-slate-200" />
                  <div className="ml-3 flex-1">
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={activeProduct.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-xs font-medium text-slate-500"
                      >
                        {activeProduct.name} — Dashboard
                      </motion.span>
                    </AnimatePresence>
                  </div>
                </div>

                {/* Metric cards — values change per product */}
                <div className="grid grid-cols-3 gap-3 p-4">
                  {[
                    { label: 'Active Users', icon: Users },
                    { label: 'Revenue', icon: TrendingUp },
                    { label: 'Tasks Done', icon: CheckCircle2 },
                  ].map((metric, i) => {
                    const accent = PRODUCT_ACCENT[activeProduct.color] ?? DEFAULT_ACCENT;
                    return (
                      <div key={metric.label} className={`rounded-xl border p-3 transition-colors duration-300 ${i === 0 ? `${accent.bg} ${accent.border}` : 'bg-slate-50 border-slate-100'}`}>
                        <metric.icon className={`w-4 h-4 mb-1.5 transition-colors duration-300 ${i === 0 ? accent.text : 'text-slate-400'}`} />
                        <div className="text-[10px] text-slate-400 mb-0.5">{metric.label}</div>
                        <div className={`text-lg font-bold transition-colors duration-300 ${i === 0 ? accent.text : 'text-slate-700'}`}>
                          {/* Dynamic number per product index */}
                          {i === 0 ? `${(products.findIndex(p => p.id === activeProduct.id) + 1) * 847}` :
                           i === 1 ? `$${((products.findIndex(p => p.id === activeProduct.id) + 1) * 12.4).toFixed(0)}k` :
                           `${(products.findIndex(p => p.id === activeProduct.id) + 1) * 234}`}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Interactive bar chart — bars animate height on product change */}
                <div className="px-4 pb-4">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-slate-700">Performance Overview</span>
                      <span className="text-[10px] text-slate-400">Last 7 days</span>
                    </div>
                    <div className="flex items-end gap-[6px] sm:gap-2 h-24">
                      {(PRODUCT_CHART_DATA[activeProduct.id as string] ?? DEFAULT_BARS).map((height, i) => {
                        const accent = PRODUCT_ACCENT[activeProduct.color] ?? DEFAULT_ACCENT;
                        const opacity = 0.3 + (i / 6) * 0.7;
                        return (
                          <div
                            key={i}
                            className="flex-1 rounded-t-md transition-all duration-500 ease-out"
                            style={{
                              height: `${height}%`,
                              backgroundColor: accent.bar,
                              opacity,
                            }}
                          />
                        );
                      })}
                    </div>
                    <div className="flex justify-between mt-2 text-[9px] text-slate-400">
                      {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
                        <span key={d} className="flex-1 text-center">{d}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Activity feed — changes per product */}
                <div className="px-4 pb-4">
                  <div className="space-y-2">
                    {[
                      { text: 'New report generated', time: '2m ago' },
                      { text: 'Team sync completed', time: '15m ago' },
                      { text: 'Workflow automated', time: '1h ago' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors cursor-default group">
                        <span
                          className="w-2 h-2 rounded-full shrink-0 transition-colors duration-300"
                          style={{ backgroundColor: (PRODUCT_ACCENT[activeProduct.color] ?? DEFAULT_ACCENT).bar }}
                        />
                        <span className="text-xs text-slate-600 flex-1 group-hover:text-slate-900 transition-colors">{item.text}</span>
                        <span className="text-[10px] text-slate-400">{item.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating labels — CSS hover only */}
              <div className="hidden sm:flex absolute -top-3 right-2 lg:-right-4 items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                <BarChart3 className="w-3.5 h-3.5 text-teal-500" />
                <span className="text-xs font-medium text-slate-700">Analytics</span>
              </div>
              <div className="hidden sm:flex absolute -bottom-3 left-2 lg:-left-4 items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                <Workflow className="w-3.5 h-3.5 text-teal-500" />
                <span className="text-xs font-medium text-slate-700">Automation</span>
              </div>
            </motion.div>
          </div>
        </div>
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
