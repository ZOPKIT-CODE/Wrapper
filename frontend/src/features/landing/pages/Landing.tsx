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

      {/* Resizable Navbar */}
      <Navbar>
        {/* Desktop Navigation */}
        <NavBody>
          <NavbarLogo />
          <div className="flex-1 flex flex-row items-center justify-center gap-0.5 text-[13px] font-medium px-4 min-w-0">
            {/* Products Mega Dropdown */}
            <div
              className="relative shrink-0"
              onMouseEnter={handleProductsMouseEnter}
              onMouseLeave={handleProductsMouseLeave}
            >
              <button className="group px-3.5 py-2 text-neutral-500 hover:text-indigo-700 font-medium flex items-center gap-1.5 whitespace-nowrap transition-all duration-200">
                <span>Products</span>
                <ChevronRight size={13} className={`transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${showProductsDropdown ? 'rotate-90 text-indigo-500' : 'text-neutral-400'}`} />
              </button>
              <AnimatePresence>
                {showProductsDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[340px] z-50"
                  >
                    {/* Dropdown glow */}
                    <div className="absolute -inset-1 rounded-2xl bg-gradient-to-b from-indigo-500/10 to-purple-500/5 blur-lg pointer-events-none" />
                    <div className="relative bg-white/95 backdrop-blur-xl rounded-2xl border border-indigo-100/50 shadow-[0_20px_60px_-12px_rgba(99,102,241,0.15)] overflow-hidden">
                      {/* Header accent bar */}
                      <div className="h-[2px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                      <div className="px-4 pt-3 pb-2">
                        <p className="text-[10px] font-bold text-indigo-400/80 uppercase tracking-[0.15em]">Our Suite</p>
                      </div>
                      <div className="px-2 pb-2 max-h-[380px] overflow-y-auto scrollbar-none">
                        {allProducts.map((product) => (
                          <button
                            key={product.id}
                            onClick={() => navigate({ to: `/products/${product.id}` })}
                            className="group/item w-full text-left px-3 py-2 text-sm text-neutral-600 hover:text-indigo-700 transition-all duration-200 flex items-center gap-3 rounded-xl hover:bg-gradient-to-r hover:from-indigo-50/80 hover:to-purple-50/40"
                          >
                            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-50 to-purple-50 group-hover/item:from-indigo-100 group-hover/item:to-purple-100 flex items-center justify-center shrink-0 transition-all duration-200 ring-1 ring-indigo-100/50 group-hover/item:ring-indigo-200/80 group-hover/item:shadow-sm">
                              <DynamicIcon name={ORBIT_APPS.find(a => a.id === product.id)?.icon ?? 'Box'} className="w-4 h-4 text-indigo-500/70 group-hover/item:text-indigo-600 transition-colors" />
                            </span>
                            <span className="font-medium">{product.name}</span>
                            <ArrowRight size={13} className="ml-auto opacity-0 -translate-x-2 group-hover/item:opacity-60 group-hover/item:translate-x-0 transition-all duration-200 text-indigo-400" />
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {/* Industries Mega Dropdown */}
            <div
              className="relative shrink-0"
              onMouseEnter={handleIndustriesMouseEnter}
              onMouseLeave={handleIndustriesMouseLeave}
            >
              <button className="group px-3.5 py-2 text-neutral-500 hover:text-indigo-700 font-medium flex items-center gap-1.5 whitespace-nowrap transition-all duration-200">
                <span>Industries</span>
                <ChevronRight size={13} className={`transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${showIndustriesDropdown ? 'rotate-90 text-indigo-500' : 'text-neutral-400'}`} />
              </button>
              <AnimatePresence>
                {showIndustriesDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[280px] z-50"
                  >
                    <div className="absolute -inset-1 rounded-2xl bg-gradient-to-b from-purple-500/10 to-pink-500/5 blur-lg pointer-events-none" />
                    <div className="relative bg-white/95 backdrop-blur-xl rounded-2xl border border-purple-100/50 shadow-[0_20px_60px_-12px_rgba(139,92,246,0.15)] overflow-hidden">
                      <div className="h-[2px] bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500" />
                      <div className="px-4 pt-3 pb-2">
                        <p className="text-[10px] font-bold text-purple-400/80 uppercase tracking-[0.15em]">Industries</p>
                      </div>
                      <div className="px-2 pb-2">
                        {allIndustries.map((industry) => (
                          <button
                            key={industry.slug}
                            onClick={() => navigate({ to: `/industries/${industry.slug}` })}
                            className="group/item w-full text-left px-3 py-2.5 text-sm text-neutral-600 hover:text-purple-700 font-medium transition-all duration-200 flex items-center gap-3 rounded-xl hover:bg-gradient-to-r hover:from-purple-50/80 hover:to-pink-50/40"
                          >
                            <span className="w-2 h-2 rounded-full bg-purple-300/60 group-hover/item:bg-purple-500 group-hover/item:shadow-[0_0_8px_rgba(139,92,246,0.4)] transition-all duration-200 shrink-0" />
                            <span>{industry.name}</span>
                            <ArrowRight size={13} className="ml-auto opacity-0 -translate-x-2 group-hover/item:opacity-60 group-hover/item:translate-x-0 transition-all duration-200 text-purple-400" />
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
                className="px-3.5 py-2 text-neutral-500 hover:text-indigo-700 font-medium transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 relative group"
              >
                {item.name}
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-0 group-hover:w-4/5 h-[2px] bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]" />
              </a>
            ))}
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            <NavbarButton
              variant={hasAuthenticatedSession ? "gradient" : "primary"}
              onClick={primaryCta.action}
              disabled={primaryCta.disabled}
              as="button"
              className="rounded-xl px-6 py-2.5 cursor-pointer text-[13px]"
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
              className="relative p-2.5 rounded-xl transition-all duration-200 hover:bg-indigo-50/60 group"
              aria-label="Toggle menu"
            >
              <div className="relative w-5 h-5">
                <span className={`absolute left-0 block w-5 h-[2px] rounded-full bg-neutral-600 group-hover:bg-indigo-600 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isMobileMenuOpen ? 'top-[9px] rotate-45' : 'top-[3px] rotate-0'}`} />
                <span className={`absolute left-0 top-[9px] block w-5 h-[2px] rounded-full bg-neutral-600 group-hover:bg-indigo-600 transition-all duration-200 ${isMobileMenuOpen ? 'opacity-0 scale-x-0' : 'opacity-100 scale-x-100'}`} />
                <span className={`absolute left-0 block w-5 h-[2px] rounded-full bg-neutral-600 group-hover:bg-indigo-600 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isMobileMenuOpen ? 'top-[9px] -rotate-45' : 'top-[15px] rotate-0'}`} />
              </div>
            </button>
          </MobileNavHeader>

          <MobileNavMenu
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
          >
            {/* Products section */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="h-[2px] w-4 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" />
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.15em]">Products</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {allProducts.map((product) => (
                  <a
                    key={product.id}
                    href={`/products/${product.id}`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="px-3 py-2 text-[13px] text-neutral-600 hover:text-indigo-700 hover:bg-indigo-50/60 rounded-xl transition-all duration-200 font-medium truncate"
                  >
                    {product.name}
                  </a>
                ))}
              </div>
            </div>

            {/* Industries section */}
            <div className="mb-3">
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="h-[2px] w-4 rounded-full bg-gradient-to-r from-purple-500 to-pink-500" />
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-[0.15em]">Industries</span>
              </div>
              {allIndustries.map((industry) => (
                <a
                  key={industry.slug}
                  href={`/industries/${industry.slug}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-3 py-2 text-[13px] text-neutral-600 hover:text-purple-700 hover:bg-purple-50/60 rounded-xl transition-all duration-200 font-medium"
                >
                  {industry.name}
                </a>
              ))}
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-neutral-200 to-transparent my-2" />

            {/* Nav links */}
            {navItems.map((item, idx) => (
              <a
                key={`mobile-link-${idx}`}
                href={item.link}
                onClick={(e) => {
                  setIsMobileMenuOpen(false);
                  handleAnchorClick(e, item.link);
                }}
                className="px-3 py-2 text-[13px] text-neutral-600 hover:text-indigo-700 hover:bg-indigo-50/60 rounded-xl transition-all duration-200 font-medium cursor-pointer"
              >
                {item.name}
              </a>
            ))}

            {/* CTA */}
            <div className="flex w-full flex-col gap-3 mt-2">
              <NavbarButton
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  primaryCta.action();
                }}
                variant={hasAuthenticatedSession ? "gradient" : "primary"}
                className="w-full rounded-xl cursor-pointer py-3"
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
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-[15px] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.97]"
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

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
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
                  className="group cursor-pointer rounded-2xl border border-slate-200 bg-white hover:border-slate-300 p-6 transition-all duration-200 hover:shadow-lg"
                  onClick={() => navigate({ to: `/industries/${industry.slug}` })}
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-slate-900 flex items-center justify-center mb-5 transition-colors duration-200">
                    <DynamicIcon name={iconMap[industry.slug] ?? 'Building2'} className="w-5 h-5 text-slate-600 group-hover:text-white transition-colors duration-200" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-1.5 tracking-tight">
                    {industry.name}
                  </h3>
                  <p className="text-slate-500 text-sm leading-relaxed mb-4">
                    {industry.hero.subheadline}
                  </p>
                  <div className="space-y-1.5 mb-5">
                    {topStats.map((stat, i) => (
                      <p key={i} className="text-xs text-slate-500">
                        <span className="font-semibold text-slate-900">{stat.value}</span> {stat.label}
                      </p>
                    ))}
                  </div>
                  <span className="text-sm font-semibold text-slate-400 group-hover:text-slate-900 transition-colors inline-flex items-center gap-1">
                    Learn more <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
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
