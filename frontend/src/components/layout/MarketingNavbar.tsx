import React, { useCallback, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight, Menu, X } from 'lucide-react';
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
  { name: 'Contact Us', link: '/landing#contact' },
] as const;

export type MarketingNavbarProps = {
  /** Right side of desktop bar (Sign In, Sign up, session CTA, etc.) */
  desktopRight: React.ReactNode;
  /** Bottom of mobile sheet after Products / Industries / links */
  mobileFooter: React.ReactNode;
};

/**
 * Shared marketing site navbar: Products + Industries dropdowns, Pricing & Contact,
 * same layout/visuals as the landing page.
 */
export function MarketingNavbar({ desktopRight, mobileFooter }: MarketingNavbarProps) {
  const navigate = useNavigate();
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

  return (
    <Navbar>
      <NavBody>
        <NavbarLogo />
        <div className="flex-1 flex flex-row items-center justify-center gap-0.5 text-[13px] font-medium px-6 min-w-0">
          <div
            className="relative shrink-0"
            onMouseEnter={handleProductsMouseEnter}
            onMouseLeave={handleProductsMouseLeave}
          >
            <button
              type="button"
              className="px-3 py-2 text-[#1B2E5A] hover:text-[#162447] font-medium flex items-center gap-1 whitespace-nowrap transition-colors duration-150 cursor-pointer"
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
                  <div className="bg-white rounded-xl border border-slate-200 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.12)] overflow-hidden">
                    <div className="px-3 pt-3 pb-1.5">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Products</p>
                    </div>
                    <div className="px-1.5 pb-1.5 max-h-[400px] overflow-y-auto">
                      {MARKETING_NAV_PRODUCTS.map((product) => (
                        <button
                          type="button"
                          key={product.id}
                          onClick={() => navigate({ to: `/products/${product.id}` })}
                          className="w-full text-left px-3 py-2 text-[13px] text-[#1B2E5A] hover:text-[#162447] hover:bg-slate-50 transition-colors duration-100 flex items-center gap-2.5 rounded-lg cursor-pointer"
                        >
                          <span className="w-7 h-7 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                            <DynamicIcon name={product.icon} className="w-3.5 h-3.5 text-slate-500" />
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
              className="px-3 py-2 text-[#1B2E5A] hover:text-[#162447] font-medium flex items-center gap-1 whitespace-nowrap transition-colors duration-150 cursor-pointer"
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
                  <div className="bg-white rounded-xl border border-slate-200 shadow-[0_12px_40px_-8px_rgba(0,0,0,0.12)] overflow-hidden">
                    <div className="px-3 pt-3 pb-1.5">
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Industries</p>
                    </div>
                    <div className="px-1.5 pb-1.5">
                      {allIndustries.map((industry) => (
                        <button
                          type="button"
                          key={industry.slug}
                          onClick={() => navigate({ to: `/industries/${industry.slug}` })}
                          className="w-full text-left px-3 py-2 text-[13px] text-[#1B2E5A] hover:text-[#162447] hover:bg-slate-50 font-medium transition-colors duration-100 rounded-lg cursor-pointer"
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
              className="px-3 py-2 text-[#1B2E5A] hover:text-[#162447] font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap shrink-0"
            >
              {item.name}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-4">{desktopRight}</div>
      </NavBody>

      <MobileNav>
        <MobileNavHeader>
          <NavbarLogo />
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors duration-150 cursor-pointer"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5 text-slate-700" /> : <Menu className="w-5 h-5 text-slate-700" />}
          </button>
        </MobileNavHeader>

        <MobileNavMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)}>
          <div className="border-b border-slate-100 pb-3 mb-3">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-1.5">Products</p>
            {MARKETING_NAV_PRODUCTS.map((product) => (
              <a
                key={product.id}
                href={`/products/${product.id}`}
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-3 py-1.5 text-[13px] text-[#1B2E5A] hover:text-[#162447] hover:bg-slate-50 rounded-lg transition-colors duration-100 font-medium cursor-pointer"
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
                className="block px-3 py-1.5 text-[13px] text-[#1B2E5A] hover:text-[#162447] hover:bg-slate-50 rounded-lg transition-colors duration-100 font-medium cursor-pointer"
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
              className="block px-3 py-1.5 text-[13px] text-[#1B2E5A] hover:text-[#162447] hover:bg-slate-50 rounded-lg transition-colors duration-100 font-medium cursor-pointer"
            >
              {item.name}
            </a>
          ))}

          <div className="pt-3 mt-1">{mobileFooter}</div>
        </MobileNavMenu>
      </MobileNav>
    </Navbar>
  );
}
