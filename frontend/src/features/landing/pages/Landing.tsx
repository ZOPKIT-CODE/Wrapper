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
              <button className="group px-3.5 py-2 text-neutral-500 hover:text-[#1B2E5A] font-medium flex items-center gap-1.5 whitespace-nowrap transition-all duration-200">
                <span>Products</span>
                <ChevronRight size={13} className={`transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${showProductsDropdown ? 'rotate-90 text-teal-600' : 'text-neutral-400'}`} />
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
                    <div className="absolute -inset-1 rounded-2xl bg-gradient-to-b from-teal-500/10 to-[#1B2E5A]/05 blur-lg pointer-events-none" />
                    <div className="relative bg-white/95 backdrop-blur-xl rounded-2xl border border-teal-100/50 shadow-[0_20px_60px_-12px_rgba(20,184,166,0.12)] overflow-hidden">
                      {/* Header accent bar */}
                      <div className="h-[2px] bg-gradient-to-r from-[#1B2E5A] via-teal-500 to-[#7C3AED]" />
                      <div className="px-4 pt-3 pb-2">
                        <p className="text-[10px] font-bold text-indigo-400/80 uppercase tracking-[0.15em]">Our Suite</p>
                      </div>
                      <div className="px-2 pb-2 max-h-[380px] overflow-y-auto scrollbar-none">
                        {allProducts.map((product) => (
                          <button
                            key={product.id}
                            onClick={() => navigate({ to: `/products/${product.id}` })}
                            className="group/item w-full text-left px-3 py-2 text-sm text-neutral-600 hover:text-[#1B2E5A] transition-all duration-200 flex items-center gap-3 rounded-xl hover:bg-teal-50/50"
                          >
                            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-50 to-teal-50 group-hover/item:from-teal-100 group-hover/item:to-teal-100 flex items-center justify-center shrink-0 transition-all duration-200 ring-1 ring-teal-100/50 group-hover/item:ring-teal-200/80 group-hover/item:shadow-sm">
                              <DynamicIcon name={ORBIT_APPS.find(a => a.id === product.id)?.icon ?? 'Box'} className="w-4 h-4 text-teal-600/70 group-hover/item:text-teal-700 transition-colors" />
                            </span>
                            <span className="font-medium">{product.name}</span>
                            <ArrowRight size={13} className="ml-auto opacity-0 -translate-x-2 group-hover/item:opacity-60 group-hover/item:translate-x-0 transition-all duration-200 text-teal-500" />
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
              <button className="group px-3.5 py-2 text-neutral-500 hover:text-[#1B2E5A] font-medium flex items-center gap-1.5 whitespace-nowrap transition-all duration-200">
                <span>Industries</span>
                <ChevronRight size={13} className={`transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${showIndustriesDropdown ? 'rotate-90 text-teal-600' : 'text-neutral-400'}`} />
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
                    <div className="absolute -inset-1 rounded-2xl bg-gradient-to-b from-[#7C3AED]/10 to-[#1B2E5A]/05 blur-lg pointer-events-none" />
                    <div className="relative bg-white/95 backdrop-blur-xl rounded-2xl border border-purple-100/50 shadow-[0_20px_60px_-12px_rgba(124,58,237,0.10)] overflow-hidden">
                      <div className="h-[2px] bg-gradient-to-r from-[#7C3AED] via-[#1B2E5A] to-teal-500" />
                      <div className="px-4 pt-3 pb-2">
                        <p className="text-[10px] font-bold text-purple-400/80 uppercase tracking-[0.15em]">Industries</p>
                      </div>
                      <div className="px-2 pb-2">
                        {allIndustries.map((industry) => (
                          <button
                            key={industry.slug}
                            onClick={() => navigate({ to: `/industries/${industry.slug}` })}
                            className="group/item w-full text-left px-3 py-2.5 text-sm text-neutral-600 hover:text-[#1B2E5A] font-medium transition-all duration-200 flex items-center gap-3 rounded-xl hover:bg-purple-50/40"
                          >
                            <span className="w-2 h-2 rounded-full bg-[#7C3AED]/40 group-hover/item:bg-[#7C3AED] group-hover/item:shadow-[0_0_8px_rgba(124,58,237,0.3)] transition-all duration-200 shrink-0" />
                            <span>{industry.name}</span>
                            <ArrowRight size={13} className="ml-auto opacity-0 -translate-x-2 group-hover/item:opacity-60 group-hover/item:translate-x-0 transition-all duration-200 text-[#7C3AED]/60" />
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
                className="px-3.5 py-2 text-neutral-500 hover:text-[#1B2E5A] font-medium transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 relative group"
              >
                {item.name}
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-0 group-hover:w-4/5 h-[2px] bg-gradient-to-r from-teal-500 to-[#1B2E5A] rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]" />
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
              className="relative p-2.5 rounded-xl transition-all duration-200 hover:bg-teal-50/50 group"
              aria-label="Toggle menu"
            >
              <div className="relative w-5 h-5">
                <span className={`absolute left-0 block w-5 h-[2px] rounded-full bg-neutral-600 group-hover:bg-[#1B2E5A] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isMobileMenuOpen ? 'top-[9px] rotate-45' : 'top-[3px] rotate-0'}`} />
                <span className={`absolute left-0 top-[9px] block w-5 h-[2px] rounded-full bg-neutral-600 group-hover:bg-[#1B2E5A] transition-all duration-200 ${isMobileMenuOpen ? 'opacity-0 scale-x-0' : 'opacity-100 scale-x-100'}`} />
                <span className={`absolute left-0 block w-5 h-[2px] rounded-full bg-neutral-600 group-hover:bg-[#1B2E5A] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isMobileMenuOpen ? 'top-[9px] -rotate-45' : 'top-[15px] rotate-0'}`} />
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
                    className="px-3 py-2 text-[13px] text-neutral-600 hover:text-[#1B2E5A] hover:bg-teal-50/50 rounded-xl transition-all duration-200 font-medium truncate"
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
                  className="block px-3 py-2 text-[13px] text-neutral-600 hover:text-[#1B2E5A] hover:bg-purple-50/40 rounded-xl transition-all duration-200 font-medium"
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
                className="px-3 py-2 text-[13px] text-neutral-600 hover:text-[#1B2E5A] hover:bg-teal-50/50 rounded-xl transition-all duration-200 font-medium cursor-pointer"
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

      {/* Contact Us Section */}
      <section id="contact" className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 overflow-hidden" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 1000px' }}>
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-white to-slate-50" />
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(20,184,166,0.05) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(27,46,90,0.04) 0%, transparent 50%)',
        }} />
        {/* Subtle grid */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.025]" style={{
          backgroundImage: 'linear-gradient(rgba(27,46,90,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(27,46,90,0.15) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />

        <div className="relative max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16 sm:mb-20">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-50 border border-teal-200/60 mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                <span className="text-xs font-semibold text-teal-700 uppercase tracking-wider">Get in Touch</span>
              </div>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#1B2E5A] mb-5 tracking-tight">
                Let's build something{' '}
                <span className="bg-gradient-to-r from-teal-600 to-[#7C3AED] bg-clip-text text-transparent">
                  great together
                </span>
              </h2>
              <p className="text-lg sm:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">
                Have questions? We'd love to hear from you. Reach out and we'll respond as soon as possible.
              </p>
            </motion.div>
          </div>

          <div className="grid lg:grid-cols-5 gap-8 lg:gap-12 items-start">
            {/* Left — Contact Info Cards */}
            <motion.div
              className="lg:col-span-2 space-y-5"
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              {/* Email card */}
              <div className="group relative p-5 rounded-2xl bg-white border border-slate-200/60 hover:border-teal-200/80 transition-all duration-300 hover:shadow-[0_8px_30px_-8px_rgba(20,184,166,0.10)]">
                <div className="absolute inset-0 rounded-2xl bg-teal-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shrink-0 shadow-lg shadow-teal-500/20">
                    <Mail className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#1B2E5A] mb-0.5">Email us</h4>
                    <a href="mailto:sales@zopkit.com" className="text-sm text-slate-500 hover:text-teal-600 transition-colors">
                      sales@zopkit.com
                    </a>
                  </div>
                </div>
              </div>

              {/* Phone card */}
              <div className="group relative p-5 rounded-2xl bg-white border border-slate-200/60 hover:border-[#7C3AED]/20 transition-all duration-300 hover:shadow-[0_8px_30px_-8px_rgba(124,58,237,0.08)]">
                <div className="absolute inset-0 rounded-2xl bg-purple-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#6D28D9] flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/20">
                    <Phone className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#1B2E5A] mb-0.5">Call us</h4>
                    <p className="text-sm text-slate-500">8971055515</p>
                  </div>
                </div>
              </div>

              {/* Address card */}
              <div className="group relative p-5 rounded-2xl bg-white border border-slate-200/60 hover:border-[#1B2E5A]/15 transition-all duration-300 hover:shadow-[0_8px_30px_-8px_rgba(27,46,90,0.08)]">
                <div className="absolute inset-0 rounded-2xl bg-slate-50/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#1B2E5A] to-[#243B6A] flex items-center justify-center shrink-0 shadow-lg shadow-[#1B2E5A]/20">
                    <MapPin className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#1B2E5A] mb-0.5">Visit us</h4>
                    <p className="text-sm text-slate-500">Hi-Tech City, Hyderabad</p>
                  </div>
                </div>
              </div>

              {/* Business hours */}
              <div className="relative p-5 rounded-2xl bg-[#1B2E5A] text-white overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-teal-500/15 to-transparent rounded-bl-full" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-[#7C3AED]/15 to-transparent rounded-tr-full" />
                <div className="relative">
                  <h4 className="text-sm font-semibold text-white/90 mb-3">Business Hours</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">Mon – Fri</span>
                      <span className="text-white font-medium">9:00 AM – 6:00 PM</span>
                    </div>
                    <div className="h-px bg-white/10" />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">Sat – Sun</span>
                      <span className="text-slate-400 font-medium">Closed</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right — Contact Form */}
            <motion.div
              className="lg:col-span-3"
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <div className="relative">
                {/* Form glow */}
                <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-teal-500/8 via-transparent to-[#7C3AED]/6 blur-xl pointer-events-none" />

                <div className="relative bg-white rounded-2xl border border-slate-200/60 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
                  {/* Top gradient accent */}
                  <div className="h-[2px] bg-gradient-to-r from-[#1B2E5A] via-teal-500 to-[#7C3AED]" />

                  <div className="p-6 sm:p-8">
                    <h3 className="text-xl font-bold text-[#1B2E5A] mb-1">Send us a message</h3>
                    <p className="text-sm text-slate-400 mb-6">Fill out the form and our team will get back to you within 24 hours.</p>

                    <form
                      className="max-w-full"
                      onSubmit={async (e) => {
                        e.preventDefault()
                        setIsSubmittingContact(true)
                        try {
                          const response = await api.post('/contact/submit', contactForm)
                          if (response.data.success) {
                            toast.success('Thank you for contacting us! We will get back to you soon.')
                            setContactForm({ name: '', email: '', company: '', phone: '', jobTitle: '', companySize: '', preferredTime: '', comments: '' })
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label htmlFor="name" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Full Name *</label>
                          <input type="text" id="name" name="name" required value={contactForm.name} onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-400 transition-all duration-200 hover:border-slate-300"
                            placeholder="John Smith" />
                        </div>
                        <div>
                          <label htmlFor="email" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Email *</label>
                          <input type="email" id="email" name="email" required value={contactForm.email} onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-400 transition-all duration-200 hover:border-slate-300"
                            placeholder="john@company.com" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label htmlFor="company" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Company *</label>
                          <input type="text" id="company" name="company" required value={contactForm.company} onChange={(e) => setContactForm(prev => ({ ...prev, company: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-400 transition-all duration-200 hover:border-slate-300"
                            placeholder="Acme Corporation" />
                        </div>
                        <div>
                          <label htmlFor="phone" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Phone</label>
                          <input type="tel" id="phone" name="phone" value={contactForm.phone} onChange={(e) => setContactForm(prev => ({ ...prev, phone: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-400 transition-all duration-200 hover:border-slate-300"
                            placeholder="+1 (555) 123-4567" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label htmlFor="jobTitle" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Job Title *</label>
                          <input type="text" id="jobTitle" name="jobTitle" required value={contactForm.jobTitle} onChange={(e) => setContactForm(prev => ({ ...prev, jobTitle: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-400 transition-all duration-200 hover:border-slate-300"
                            placeholder="CEO, CTO, Manager..." />
                        </div>
                        <div>
                          <label htmlFor="companySize" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Company Size</label>
                          <select id="companySize" name="companySize" value={contactForm.companySize} onChange={(e) => setContactForm(prev => ({ ...prev, companySize: e.target.value }))}
                            className="w-full px-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-400 transition-all duration-200 hover:border-slate-300 appearance-none"
                            style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath d=\'M3 5l3 3 3-3\' stroke=\'%2394a3b8\' stroke-width=\'1.5\' fill=\'none\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center' }}>
                            <option value="">Select size</option>
                            <option value="1-10">1-10 employees</option>
                            <option value="11-50">11-50 employees</option>
                            <option value="51-200">51-200 employees</option>
                            <option value="201-500">201-500 employees</option>
                            <option value="501-1000">501-1000 employees</option>
                            <option value="1000+">1000+ employees</option>
                          </select>
                        </div>
                      </div>

                      <div className="mb-4">
                        <label htmlFor="preferredTime" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Preferred Demo Time</label>
                        <select id="preferredTime" name="preferredTime"
                          className="w-full px-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-400 transition-all duration-200 hover:border-slate-300 appearance-none"
                          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3E%3Cpath d=\'M3 5l3 3 3-3\' stroke=\'%2394a3b8\' stroke-width=\'1.5\' fill=\'none\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center' }}>
                          <option value="">Select preferred time</option>
                          <option value="morning">Morning (9 AM - 12 PM)</option>
                          <option value="afternoon">Afternoon (12 PM - 5 PM)</option>
                          <option value="evening">Evening (5 PM - 8 PM)</option>
                          <option value="flexible">Flexible</option>
                        </select>
                      </div>

                      <div className="mb-6">
                        <label htmlFor="comments" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Message</label>
                        <textarea id="comments" name="comments" rows={4} value={contactForm.comments} onChange={(e) => setContactForm(prev => ({ ...prev, comments: e.target.value }))}
                          className="w-full px-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-400 transition-all duration-200 hover:border-slate-300 resize-none"
                          placeholder="Tell us about your specific needs or questions..." />
                      </div>

                      {/* Submit Button */}
                      <button
                        type="submit"
                        disabled={isSubmittingContact}
                        className="group relative w-full inline-flex items-center justify-center rounded-xl transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 overflow-hidden"
                      >
                        {/* Rotating brand gradient border */}
                        <div className="absolute inset-0 rounded-xl p-[1.5px] overflow-hidden" style={{
                          background: 'conic-gradient(from var(--nav-angle, 0deg), #1B2E5A, #14B8A6, #7C3AED, #0D9488, #1B2E5A)',
                          animation: 'nav-border-rotate 3s linear infinite',
                        }}>
                          <div className="absolute inset-[1.5px] rounded-[calc(0.75rem-1.5px)] bg-white transition-colors duration-300 group-hover:bg-slate-50/80" />
                        </div>
                        {/* Outer glow on hover */}
                        <div className="absolute -inset-1 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none blur-md" style={{
                          background: 'conic-gradient(from var(--nav-angle, 0deg), #1B2E5A80, #14B8A680, #7C3AED80, #0D948880, #1B2E5A80)',
                          animation: 'nav-border-rotate 3s linear infinite',
                        }} />
                        <span className="relative z-10 flex items-center justify-center gap-2 py-3 font-semibold text-sm text-[#1B2E5A] group-hover:text-[#1B2E5A] transition-colors">
                          {isSubmittingContact ? (
                            <>
                              <svg className="animate-spin h-4 w-4 text-teal-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                              Sending...
                            </>
                          ) : (
                            <>
                              Send Message
                              <ArrowRight size={15} className="-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 text-teal-600" />
                            </>
                          )}
                        </span>
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </motion.div>
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
