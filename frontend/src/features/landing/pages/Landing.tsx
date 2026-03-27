import React, { Suspense, useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useLocation } from '@tanstack/react-router'
import { useKindeAuth } from '@kinde-oss/kinde-auth-react'
import { motion, AnimatePresence } from 'framer-motion'
import { DynamicIcon } from '@/features/landing/components/Icons'
import { ArrowRight, Play, ChevronRight, FileText, GraduationCap, Users, Zap, Mail, Phone, MapPin, Menu, X, LayoutDashboard, Rocket } from 'lucide-react'
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
const VisualHub = React.lazy(() =>
  import('@/features/landing/components/VisualHub').then(m => ({ default: m.VisualHub }))
)
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

const COLOR_TO_HEX_PRIMARY: Record<string, string> = {
  blue: '#3b82f6',
  green: '#10b981',
  purple: '#a855f7',
  orange: '#f97316',
  indigo: '#6366f1',
};

const COLOR_TO_HEX_SECONDARY: Record<string, string> = {
  blue: '#6366f1',
  green: '#06b6d4',
  purple: '#ec4899',
  orange: '#f59e0b',
  indigo: '#8b5cf6',
};

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

  const primaryColorHex = COLOR_TO_HEX_PRIMARY[activeProduct.color] ?? '#14b8a6';
  const secondaryColorHex = COLOR_TO_HEX_SECONDARY[activeProduct.color] ?? '#10b981';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white selection:bg-teal-500/30 selection:text-white font-sans overflow-x-clip relative">

      {/* Ambient Background Effects */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden" style={{ contain: 'strict' }}>
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

        {/* Subtle noise texture for premium depth */}
        <div className="absolute inset-0 bg-noise opacity-[0.018]" />

        {/* Radial teal glow blob — top right */}
        <div className="absolute -top-40 -right-40 w-[800px] h-[800px] rounded-full bg-teal-500/10 blur-[120px]" />

        {/* Radial emerald glow blob — bottom left */}
        <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full bg-emerald-500/[0.08] blur-[100px]" />

        {/* Dynamic color spotlight (reactive to active product) */}
        <div
          className="absolute top-[-20%] right-[-10%] w-[100vw] h-[100vh] blur-[100px] rounded-full transition-[background-color] duration-1000 ease-in-out will-change-transform"
          style={{ backgroundColor: `${primaryColorHex}18` }}
        />

        {/* Secondary spotlight — bottom left */}
        <div
          className="absolute bottom-[-10%] left-[-5%] w-[80vw] h-[70vh] blur-[120px] rounded-full transition-[background-color] duration-1000 ease-in-out will-change-transform"
          style={{ backgroundColor: `${secondaryColorHex}10` }}
        />
      </div>

      {/* Resizable Navbar */}
      <Navbar>
        {/* Desktop Navigation */}
        <NavBody>
          <NavbarLogo />
          <div className="flex-1 flex flex-row items-center justify-center space-x-1 text-sm font-medium text-slate-400 transition duration-200 px-4 min-w-0">
            {/* Products Dropdown */}
            <div
              className="relative shrink-0"
              onMouseEnter={handleProductsMouseEnter}
              onMouseLeave={handleProductsMouseLeave}
            >
              <button
                className="px-3 py-2 text-slate-400 hover:text-white font-medium flex items-center gap-1 whitespace-nowrap transition-colors"
              >
                Products
                <ChevronRight size={16} className={`transition-transform ${showProductsDropdown ? 'rotate-90' : ''}`} />
              </button>
              {showProductsDropdown && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-slate-800/90 backdrop-blur-xl rounded-xl shadow-xl border border-white/10 py-2 z-50">
                  {allProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => navigate({ to: `/products/${product.id}` })}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
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
                className="px-3 py-2 text-slate-400 hover:text-white font-medium flex items-center gap-1 whitespace-nowrap transition-colors"
              >
                Industries
                <ChevronRight size={16} className={`transition-transform ${showIndustriesDropdown ? 'rotate-90' : ''}`} />
              </button>
              {showIndustriesDropdown && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-slate-800/90 backdrop-blur-xl rounded-xl shadow-xl border border-white/10 py-2 z-50">
                  {allIndustries.map((industry) => (
                    <button
                      key={industry.slug}
                      onClick={() => navigate({ to: `/industries/${industry.slug}` })}
                      className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
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
                className="px-3 py-2 text-slate-400 hover:text-white font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {item.name}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            <NavbarButton
              variant={hasAuthenticatedSession ? "gradient" : "outline"}
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
              className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6 text-slate-300" />
              ) : (
                <Menu className="w-6 h-6 text-slate-300" />
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
                className="relative text-neutral-600 dark:text-neutral-300 cursor-pointer"
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
                variant={hasAuthenticatedSession ? "gradient" : "outline"}
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

      {/* Main Content */}
      <main className="relative pt-20 sm:pt-24 lg:pt-36 pb-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10 overflow-visible">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-0 items-center">

          {/* Left Column: Content (Compressed to 5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-8 lg:pr-6 relative z-20">

            <div className="space-y-6 relative">
              <div
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 backdrop-blur-sm w-fit mb-6 animate-[fadeInUp_0.5s_ease-out]"
              >
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
                <span className="text-teal-300 text-xs font-semibold tracking-widest uppercase">Complete Business Operations Suite</span>
              </div>

              <div className="relative h-[160px] lg:h-[200px] w-full z-20">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeProduct.id}
                    initial={{ opacity: 0, y: 10, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -10, filter: 'blur(10px)' }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="absolute top-0 left-0 w-full"
                  >
                    <h1 className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-tight mb-5 text-white">
                      <span className="bg-gradient-to-r from-teal-400 via-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                        {activeProduct.name}
                      </span>
                    </h1>
                    <p className="text-slate-400 text-lg md:text-xl leading-relaxed max-w-xl mt-4">
                      {activeProduct.description}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center mt-24 gap-4 z-20">
              <button
                onClick={primaryCta.action}
                disabled={primaryCta.disabled}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 text-white font-semibold text-base shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 transition-all duration-200 hover:-translate-y-0.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {hasAuthenticatedSession && onboardingCompleted ? <LayoutDashboard className="w-5 h-5" /> : null}
                {hasAuthenticatedSession && !onboardingCompleted ? <Rocket className="w-5 h-5" /> : null}
                {primaryCta.label}
                <ArrowRight className="w-5 h-5" />
              </button>

              <button
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-semibold text-base backdrop-blur-sm transition-all duration-200"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Watch 2-Min Demo</span>
              </button>
            </div>

            {/* Social Proof Stats Bar */}
            <div className="flex items-center gap-6 mt-8 pt-8 border-t border-white/10">
              {[
                { value: "500+", label: "Companies" },
                { value: "100M+", label: "Transactions" },
                { value: "99.9%", label: "Uptime SLA" },
                { value: "11", label: "Products" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl font-black text-white">{stat.value}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Product "Launchpad" Selector */}
            <div className="mt-6 pt-8 border-t border-white/10">
              <div className="flex justify-between items-center mb-4">
                <p className="text-slate-500 text-xs font-semibold tracking-widest uppercase">Select Application</p>
                <span className="text-xs text-slate-500">0{activeProduct.id} / {products.length}</span>
              </div>

              <div ref={scrollContainerRef} className="flex flex-row gap-3 overflow-x-auto gradient-scrollbar pb-4">
                {products.map((product) => (
                  <button
                    key={product.id}
                    ref={(el) => {
                      if (el) productRefs.current.set(product.id, el);
                    }}
                    onClick={() => setActiveProduct(product)}
                    onDoubleClick={() => navigate({ to: `/products/${product.id}` })}
                    className={`
                        relative group flex flex-col items-start justify-between p-3 rounded-xl border transition-all duration-300 h-28 w-32 min-w-[128px] overflow-hidden text-left shrink-0
                        ${activeProduct.id === product.id
                        ? 'bg-teal-500/20 border-teal-500/40 shadow-lg'
                        : 'bg-slate-800/60 border-white/10 hover:bg-white/5 hover:border-white/20'}
                      `}
                    title="Double-click to view details"
                  >
                    {/* Hover Glow */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${product.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />

                    <div className="flex justify-between w-full items-start">
                      <div className={`
                           p-1.5 rounded-lg transition-colors duration-300
                           ${activeProduct.id === product.id ? `bg-gradient-to-br ${product.gradient} text-white` : 'bg-white/10 text-slate-400 group-hover:text-slate-200 group-hover:bg-white/15'}
                         `}>
                        <DynamicIcon name={product.iconName} className="w-4 h-4" />
                      </div>

                      {activeProduct.id === product.id && (
                        <motion.div layoutId="active-indicator" className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                      )}
                    </div>

                    <div className="flex flex-col gap-1 mt-auto w-full">
                      <span className={`text-[11px] font-semibold tracking-wide ${activeProduct.id === product.id ? 'text-teal-300' : 'text-slate-400 group-hover:text-slate-200'}`}>
                        {product.name}
                      </span>
                      <span className="text-[9px] text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        Double-click for details →
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Visual Hub (Expanded to 7 cols and shifted left) */}
          <div className="lg:col-span-7 relative z-10 flex justify-center lg:justify-start items-center h-full min-h-[350px] sm:min-h-[500px]">
            {/* The w-[90%] constrains the width, and lg:-ml-6 pulls the center point to the left */}
            <div className="w-full lg:w-[100%] flex justify-center lg:-ml-6">
              <Suspense fallback={<div className="min-h-[350px] sm:min-h-[500px]" />}>
                <VisualHub product={activeProduct} />
              </Suspense>
            </div>
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
