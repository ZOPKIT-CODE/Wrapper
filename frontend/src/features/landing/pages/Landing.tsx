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

// Ecosystem node positions (percentage-based for responsive SVG)
// 6 core products in a hexagonal ring + center hub, with connection map
const ECOSYSTEM_NODES = [
  { id: 'b2b-crm',              label: 'CRM',          icon: 'Briefcase',     x: 50,  y: 8,   color: '#3b82f6' },
  { id: 'finance',              label: 'Finance',       icon: 'Landmark',      x: 88,  y: 28,  color: '#10b981' },
  { id: 'operations',           label: 'Operations',    icon: 'Box',           x: 88,  y: 68,  color: '#f97316' },
  { id: 'b2c-crm',             label: 'B2C CRM',       icon: 'ShoppingCart',   x: 50,  y: 88,  color: '#ec4899' },
  { id: 'hrms',                 label: 'HRMS',          icon: 'UserCheck',     x: 12,  y: 68,  color: '#8b5cf6' },
  { id: 'project-management',   label: 'Projects',      icon: 'ClipboardList', x: 12,  y: 28,  color: '#0ea5e9' },
] as const;

// Which nodes connect to which (index pairs) — shows data flow between products
const ECOSYSTEM_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], // outer ring
  [0, 3], [1, 4], [2, 5], // cross connections
];

// Secondary products shown as smaller satellite dots
const SATELLITE_NODES = [
  { id: 'esop-system',       label: 'ESOP',       x: 70, y: 5,   color: '#a855f7' },
  { id: 'affiliate-connect', label: 'Affiliates', x: 96, y: 48,  color: '#f59e0b' },
  { id: 'flowtilla',         label: 'Flowtilla',  x: 70, y: 92,  color: '#06b6d4' },
  { id: 'zopkit-academy',    label: 'Academy',    x: 30, y: 92,  color: '#22c55e' },
  { id: 'zopkit-itsm',       label: 'ITSM',       x: 4,  y: 48,  color: '#ef4444' },
] as const;

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
      <main className="relative pt-24 sm:pt-28 lg:pt-32 pb-8 sm:pb-12 lg:pb-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
        {/* Top: centered headline area */}
        <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-10 lg:mb-12">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 border border-teal-200 mb-5"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
            <span className="text-teal-700 text-xs font-semibold tracking-wide">The Operating System for Modern Business</span>
          </motion.div>

          <div className="relative min-h-[100px] sm:min-h-[120px] lg:min-h-[150px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeProduct.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="absolute inset-x-0 top-0"
              >
                <h1 className="text-3xl sm:text-4xl lg:text-5xl xl:text-6xl font-black tracking-tight leading-[1.08] text-slate-900">
                  {activeProduct.name}
                </h1>
                <p className="text-slate-500 text-sm sm:text-base lg:text-lg leading-relaxed max-w-xl mx-auto mt-3">
                  {activeProduct.description}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="flex flex-col sm:flex-row justify-center gap-3 mt-4"
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
            <button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 font-semibold text-sm sm:text-base shadow-sm transition-all active:scale-[0.97]">
              <Play className="w-3.5 h-3.5 fill-current text-slate-500" />
              Watch Demo
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.35 }}
            className="flex flex-wrap justify-center items-center gap-x-5 gap-y-2 mt-5 text-xs text-slate-500"
          >
            <span className="inline-flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-teal-500" />SOC 2</span>
            <span className="inline-flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-teal-500" />99.9% Uptime</span>
            <span className="inline-flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-teal-500" />GDPR Ready</span>
          </motion.div>
        </div>

        {/* Ecosystem Constellation — the hero visual */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="relative w-full max-w-2xl lg:max-w-3xl mx-auto aspect-square"
        >
          {/* SVG connection lines */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            {ECOSYSTEM_CONNECTIONS.map(([from, to], i) => {
              const a = ECOSYSTEM_NODES[from];
              const b = ECOSYSTEM_NODES[to];
              const isActiveConn =
                activeProduct.id === a.id || activeProduct.id === b.id;
              return (
                <line
                  key={i}
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={isActiveConn ? '#14b8a6' : '#e2e8f0'}
                  strokeWidth={isActiveConn ? 0.5 : 0.3}
                  strokeDasharray={isActiveConn ? undefined : '1.5 1.5'}
                  className="transition-all duration-500"
                />
              );
            })}
            {/* Lines from satellites to nearest main node */}
            {SATELLITE_NODES.map((sat, si) => {
              const nearest = ECOSYSTEM_NODES[si % ECOSYSTEM_NODES.length];
              const isActiveSat = activeProduct.id === sat.id;
              return (
                <line
                  key={`sat-${si}`}
                  x1={sat.x} y1={sat.y} x2={nearest.x} y2={nearest.y}
                  stroke={isActiveSat ? sat.color : '#f1f5f9'}
                  strokeWidth={0.25}
                  strokeDasharray="1 2"
                  className="transition-all duration-500"
                />
              );
            })}
          </svg>

          {/* Center hub */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <Zap className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>
            <p className="text-center text-[10px] sm:text-xs font-bold text-slate-700 mt-1.5">Zopkit</p>
          </div>

          {/* Main product nodes — hexagonal ring */}
          {ECOSYSTEM_NODES.map((node) => {
            const isActive = activeProduct.id === node.id;
            const matchingProduct = products.find(p => p.id === node.id);
            return (
              <button
                key={node.id}
                onClick={() => {
                  if (matchingProduct) setActiveProduct(matchingProduct);
                }}
                ref={(el) => {
                  if (el) productRefs.current.set(node.id, el);
                }}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2 group focus:outline-none"
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
              >
                <div
                  className={`
                    w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center transition-all duration-300 border-2
                    ${isActive
                      ? 'scale-110 shadow-lg border-transparent'
                      : 'bg-white shadow-sm border-slate-200 group-hover:shadow-md group-hover:scale-105 group-hover:border-slate-300'}
                  `}
                  style={isActive ? { backgroundColor: node.color, borderColor: node.color } : undefined}
                >
                  <DynamicIcon
                    name={node.icon}
                    className={`w-5 h-5 sm:w-6 sm:h-6 transition-colors duration-300 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-700'}`}
                  />
                </div>
                <p className={`text-center text-[10px] sm:text-xs font-semibold mt-1 transition-colors duration-300 whitespace-nowrap ${isActive ? 'text-slate-900' : 'text-slate-500 group-hover:text-slate-700'}`}>
                  {node.label}
                </p>
              </button>
            );
          })}

          {/* Satellite nodes — smaller, secondary products */}
          {SATELLITE_NODES.map((sat) => {
            const isActive = activeProduct.id === sat.id;
            const matchingProduct = products.find(p => p.id === sat.id);
            return (
              <button
                key={sat.id}
                onClick={() => {
                  if (matchingProduct) setActiveProduct(matchingProduct);
                }}
                ref={(el) => {
                  if (el) productRefs.current.set(sat.id, el);
                }}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2 group focus:outline-none"
                style={{ left: `${sat.x}%`, top: `${sat.y}%` }}
              >
                <div
                  className={`
                    w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center transition-all duration-300 border
                    ${isActive
                      ? 'scale-110 shadow-md border-transparent'
                      : 'bg-white shadow-sm border-slate-100 group-hover:shadow-md group-hover:scale-105'}
                  `}
                  style={isActive ? { backgroundColor: sat.color, borderColor: sat.color } : undefined}
                >
                  <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full transition-colors duration-300 ${isActive ? 'bg-white' : 'bg-slate-300 group-hover:bg-slate-400'}`}
                    style={!isActive ? undefined : { backgroundColor: 'white' }}
                  />
                </div>
                <p className={`text-center text-[8px] sm:text-[10px] font-medium mt-0.5 transition-colors duration-300 whitespace-nowrap ${isActive ? 'text-slate-900' : 'text-slate-400 group-hover:text-slate-600'}`}>
                  {sat.label}
                </p>
              </button>
            );
          })}
        </motion.div>

        {/* Product scroll strip — below the constellation */}
        <div className="mt-6 sm:mt-8 max-w-2xl mx-auto">
          <div ref={scrollContainerRef} className="flex gap-2 overflow-x-auto pb-2 px-1 scrollbar-none justify-start sm:justify-center">
            {products.map((product) => {
              const isActive = activeProduct.id === product.id;
              const nodeColor = [...ECOSYSTEM_NODES, ...SATELLITE_NODES].find(n => n.id === product.id)?.color ?? '#14b8a6';
              return (
                <button
                  key={product.id}
                  onClick={() => setActiveProduct(product)}
                  onDoubleClick={() => navigate({ to: `/products/${product.id}` })}
                  className={`
                    shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all duration-200
                    ${isActive
                      ? 'text-white shadow-sm border-transparent'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700'}
                  `}
                  style={isActive ? { backgroundColor: nodeColor, borderColor: nodeColor } : undefined}
                >
                  <DynamicIcon name={product.iconName} className="w-3 h-3" />
                  <span className="hidden sm:inline">{product.name}</span>
                  <span className="sm:hidden">{product.name.length > 12 ? product.name.slice(0, 10) + '…' : product.name}</span>
                </button>
              );
            })}
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
