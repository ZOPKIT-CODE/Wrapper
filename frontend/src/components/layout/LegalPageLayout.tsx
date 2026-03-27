import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useKindeAuth } from '@kinde-oss/kinde-auth-react';
import { ChevronRight } from 'lucide-react';
import {
  Navbar,
  NavBody,
  MobileNav,
  NavbarLogo,
  NavbarButton,
  MobileNavHeader,
  MobileNavMenu,
} from '@/components/ui/resizable-navbar';
import { LandingFooter } from '@/components/layout/LandingFooter';
import { products } from '@/data/content';
import { getAllIndustries } from '@/data/industryPages';

interface LegalPageLayoutProps {
  title: string;
  lastUpdated?: string;
  children: React.ReactNode;
  /** Use wider max-width and no inner box (e.g. for Pricing page) */
  wide?: boolean;
  /** When false, do not render the white contained box or lastUpdated */
  contained?: boolean;
}

export function LegalPageLayout({ title, lastUpdated = '', children, wide = false, contained = true }: LegalPageLayoutProps) {
  const navigate = useNavigate();
  const { login } = useKindeAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showProductsDropdown, setShowProductsDropdown] = useState(false);
  const [showIndustriesDropdown, setShowIndustriesDropdown] = useState(false);
  const productsDropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const industriesDropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const allProducts = products;
  const allIndustries = getAllIndustries();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const handleProductsMouseEnter = () => {
    if (productsDropdownTimeoutRef.current) clearTimeout(productsDropdownTimeoutRef.current);
    setShowProductsDropdown(true);
  };
  const handleProductsMouseLeave = () => {
    productsDropdownTimeoutRef.current = setTimeout(() => setShowProductsDropdown(false), 150);
  };
  const handleIndustriesMouseEnter = () => {
    if (industriesDropdownTimeoutRef.current) clearTimeout(industriesDropdownTimeoutRef.current);
    setShowIndustriesDropdown(true);
  };
  const handleIndustriesMouseLeave = () => {
    industriesDropdownTimeoutRef.current = setTimeout(() => setShowIndustriesDropdown(false), 150);
  };
  const handleLogin = () => {
    setIsLoading(true);
    login();
    setIsLoading(false);
  };

  const navItems = [
    { name: 'Pricing', link: '/pricing' },
    { name: 'Workflows', link: '/landing#workflows' },
    { name: 'Contact Us', link: '/landing#pricing' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Navbar>
        <NavBody>
          <NavbarLogo />
          <div className="flex-1 flex flex-row items-center justify-center space-x-1 text-sm font-medium text-slate-700 px-4 min-w-0">
            <div className="relative shrink-0" onMouseEnter={handleProductsMouseEnter} onMouseLeave={handleProductsMouseLeave}>
              <button className="px-3 py-2 text-slate-700 hover:text-slate-900 font-medium flex items-center gap-1 whitespace-nowrap">
                Products
                <ChevronRight size={16} className={`transition-transform ${showProductsDropdown ? 'rotate-90' : ''}`} />
              </button>
              {showProductsDropdown && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                  {allProducts.map((product) => (
                    <button key={product.id} onClick={() => navigate({ to: `/products/${product.id}` })} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                      {product.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative shrink-0" onMouseEnter={handleIndustriesMouseEnter} onMouseLeave={handleIndustriesMouseLeave}>
              <button className="px-3 py-2 text-slate-700 hover:text-slate-900 font-medium flex items-center gap-1 whitespace-nowrap">
                Industries
                <ChevronRight size={16} className={`transition-transform ${showIndustriesDropdown ? 'rotate-90' : ''}`} />
              </button>
              {showIndustriesDropdown && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
                  {allIndustries.map((industry) => (
                    <button key={industry.slug} onClick={() => navigate({ to: `/industries/${industry.slug}` })} className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                      {industry.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {navItems.map((item) => (
              <Link key={item.name} to={item.link} className="px-3 py-2 text-slate-700 hover:text-slate-900 font-medium whitespace-nowrap shrink-0">
                {item.name}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            <NavbarButton variant="outline" onClick={handleLogin} disabled={isLoading} as="button" className="rounded-xl px-6 py-2.5">
              {isLoading ? 'Loading...' : 'Sign In'}
            </NavbarButton>
            <NavbarButton variant="gradient" onClick={() => navigate({ to: '/landing' })} as="button" className="rounded-xl px-6 py-2.5">
              Start Free Trial
            </NavbarButton>
          </div>
        </NavBody>
        <MobileNav>
          <MobileNavHeader onToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)} isOpen={isMobileMenuOpen} />
          <MobileNavMenu isOpen={isMobileMenuOpen}>
            <Link to="/landing" className="block px-4 py-3 text-slate-700">Home</Link>
            {allProducts.slice(0, 5).map((p) => (
              <Link key={p.id} to={`/products/${p.id}`} className="block px-4 py-3 text-slate-700">{p.name}</Link>
            ))}
            <Link to="/landing#pricing" className="block px-4 py-3 text-slate-700">Contact Us</Link>
          </MobileNavMenu>
        </MobileNav>
      </Navbar>

      <main className={`relative pt-24 pb-16 mx-auto px-4 sm:px-6 lg:px-8 ${wide ? 'max-w-6xl' : 'max-w-4xl'}`}>
        {contained ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 md:p-12">
            <h1 className="text-3xl md:text-4xl font-bold text-[#1B2E5A] mb-2">{title}</h1>
            {lastUpdated && <p className="text-slate-500 text-sm mb-10">Last updated: {lastUpdated}</p>}
            <div className="prose prose-slate max-w-none space-y-10">{children}</div>
          </div>
        ) : (
          <>{children}</>
        )}
      </main>

      <LandingFooter />
    </div>
  );
}
