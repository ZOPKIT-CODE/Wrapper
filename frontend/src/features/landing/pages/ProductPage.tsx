import React, { useState } from 'react';
import { useParams, useNavigate, useLocation } from '@tanstack/react-router';
import { useKindeAuth } from '@kinde-oss/kinde-auth-react';
import { ProductData } from '@/types/products';
import { Check, ArrowRight, PlayCircle, ChevronRight, Star, X, Zap, XCircle, CheckCircle, Minus, AlertCircle, Sparkles, LayoutGrid, Menu } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, Tooltip as RechartsTooltip } from 'recharts';

import { productPagesData } from '@/data/productPages';
import {
    Navbar,
    NavBody,
    MobileNav,
    NavbarLogo,
    NavbarButton,
    MobileNavHeader,
    MobileNavMenu,
} from "@/components/ui/resizable-navbar";
import { LandingFooter } from '@/components/layout/LandingFooter';

interface FeatureCardProps {
    feature: {
        icon: any;
        title: string;
        description: string;
        benefits?: string[];
    };
    i: number;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ feature, i }) => {

    // Dynamic sticky offset calculation
    const stickyTop = 120 + (i * 20);

    // Gradients and colors
    const gradients = [
        "from-blue-50 to-indigo-50",
        "from-emerald-50 to-teal-50",
        "from-orange-50 to-amber-50",
        "from-purple-50 to-pink-50"
    ];
    const accentColors = [
        "text-blue-600 bg-blue-100",
        "text-emerald-600 bg-emerald-100",
        "text-orange-600 bg-orange-100",
        "text-purple-600 bg-purple-100"
    ];

    const gradient = gradients[i % gradients.length];
    const accent = accentColors[i % accentColors.length];

    return (
        <div
            className="sticky mb-12 last:mb-0"
            style={{ top: `${stickyTop}px`, zIndex: i + 1 }}
        >
            <div
                className={`relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br ${gradient} border border-slate-200 shadow-xl transition-shadow hover:shadow-2xl origin-top`}
            >
                <div className="grid lg:grid-cols-2 gap-8 p-8 lg:p-16 items-center">
                    <div className="order-2 lg:order-1">
                        <div className={`w-16 h-16 rounded-2xl ${accent} flex items-center justify-center mb-8 shadow-sm`}>
                            <feature.icon size={32} />
                        </div>
                        <h3 className="text-3xl font-bold text-[#1B2E5A] mb-6">{feature.title}</h3>
                        <p className="text-lg text-slate-700 leading-relaxed mb-8">
                            {feature.description}
                        </p>
                        <ul className="space-y-3">
                            {(feature.benefits || [1, 2, 3].map((_, idx) => `Feature benefit point ${idx + 1}`)).map((benefit: string, idx: number) => (
                                <li key={idx} className="flex items-center gap-3 text-slate-600 font-medium">
                                    <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-sm">
                                        <Check size={14} className="text-slate-900" />
                                    </div>
                                    {benefit}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Visual representation on the right */}
                    <div className="order-1 lg:order-2 relative h-64 lg:h-auto min-h-[300px]">
                        <div className="absolute inset-0 bg-white/50 rounded-2xl border border-white/60 shadow-lg backdrop-blur-md transform rotate-2 lg:translate-x-8 lg:translate-y-8 flex items-center justify-center">
                            {/* Abstract UI representation */}
                            <div className="w-3/4 h-3/4 bg-white rounded-xl shadow-inner border border-slate-100 p-4 relative overflow-hidden">
                                <div className="h-4 w-1/3 bg-slate-100 rounded mb-4"></div>
                                <div className="space-y-2">
                                    <div className="h-2 w-full bg-slate-50 rounded"></div>
                                    <div className="h-2 w-5/6 bg-slate-50 rounded"></div>
                                    <div className="h-2 w-4/6 bg-slate-50 rounded"></div>
                                </div>

                                {/* Floating Element */}
                                <div className="absolute bottom-4 right-4 bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-2 animate-bounce">
                                    <Zap size={10} className="fill-yellow-400 text-yellow-400" /> Optimized
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ProductPage: React.FC = () => {
    const { productId } = useParams({ strict: false });
    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useKindeAuth();

    // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
    const [isLoading, setIsLoading] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showProductsDropdown, setShowProductsDropdown] = useState(false);
    const [showIndustriesDropdown, setShowIndustriesDropdown] = useState(false);
    const productsDropdownTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    const industriesDropdownTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

    // Scroll progress for stacking cards
    const container = React.useRef(null);

    // Scroll to top when productId changes (route change)
    React.useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, [productId]);

    // Close mobile menu when route changes
    React.useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    const handleProductsMouseEnter = () => {
        if (productsDropdownTimeoutRef.current) {
            clearTimeout(productsDropdownTimeoutRef.current);
        }
        setShowProductsDropdown(true);
    };

    const handleProductsMouseLeave = () => {
        productsDropdownTimeoutRef.current = setTimeout(() => {
            setShowProductsDropdown(false);
        }, 300);
    };

    const allIndustries = [
        { slug: 'e-commerce', name: 'E-Commerce & Retail' },
        { slug: 'saas', name: 'SaaS & Technology' },
        { slug: 'manufacturing', name: 'Manufacturing' },
        { slug: 'professional-services', name: 'Professional Services' },
    ];

    const handleIndustriesMouseEnter = () => {
        if (industriesDropdownTimeoutRef.current) {
            clearTimeout(industriesDropdownTimeoutRef.current);
        }
        setShowIndustriesDropdown(true);
    };

    const handleIndustriesMouseLeave = () => {
        industriesDropdownTimeoutRef.current = setTimeout(() => {
            setShowIndustriesDropdown(false);
        }, 300);
    };

    const handleLogin = async () => {
        setIsLoading(true);
        try {
            const googleConnectionId = import.meta.env.VITE_KINDE_GOOGLE_CONNECTION_ID;
            
            if (!googleConnectionId) {
                console.error('❌ VITE_KINDE_GOOGLE_CONNECTION_ID is not configured');
                await login();
            } else {
                await login({ connectionId: googleConnectionId });
            }
        } catch (error) {
            console.error('Login error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Path links use React Router; hash links scroll in-page
    const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
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
    };

    // Get product data
    const data: ProductData | undefined = productId ? productPagesData[productId] : undefined;

    // Dummy data for dashboards
    const lineData = [
        { name: 'Mon', value: 400, uv: 240 },
        { name: 'Tue', value: 300, uv: 139 },
        { name: 'Wed', value: 600, uv: 980 },
        { name: 'Thu', value: 800, uv: 390 },
        { name: 'Fri', value: 500, uv: 480 },
        { name: 'Sat', value: 900, uv: 380 },
        { name: 'Sun', value: 700, uv: 430 },
    ];

    const pieData = [
        { name: 'Group A', value: 400 },
        { name: 'Group B', value: 300 },
        { name: 'Group C', value: 300 },
        { name: 'Group D', value: 200 },
    ];
    const COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981'];

    const navItems = [
        { name: "Pricing", link: "/pricing" },
        { name: "Workflows", link: "#workflows" },
        { name: "Contact Us", link: "/landing#pricing" },
    ];

    const allProducts = [
        { id: 'affiliate-connect', name: 'Affiliate Connect' },
        { id: 'b2b-crm', name: 'B2B CRM' },
        { id: 'b2c-crm', name: 'B2C CRM' },
        { id: 'operations-management', name: 'Operations Management' },
        { id: 'project-management', name: 'Project Management' },
        { id: 'financial-accounting', name: 'Financial Accounting' },
        { id: 'hrms', name: 'HRMS' },
        { id: 'esop-system', name: 'ESOP System' },
        { id: 'flowtilla', name: 'Flowtilla' },
        { id: 'zopkit-academy', name: 'Zopkit Academy' },
        { id: 'zopkit-itsm', name: 'Zopkit ITSM' },
    ];

    const currentProductInfo = allProducts.find(p => p.id === productId);
    const productName = currentProductInfo?.name || 'Zopkit';

    // If product not found or incomplete, show 404
    // This MUST come after all hooks
    if (!data || !data.hero || !data.problem || !data.solution || !data.features) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-[#1B2E5A] mb-4">Product Not Found</h1>
                    <p className="text-slate-600 mb-8">The product you're looking for doesn't exist or is not yet available.</p>
                    <button
                        onClick={() => navigate({ to: '/' })}
                        className="px-6 py-3 bg-[#1B2E5A] text-white rounded-lg hover:bg-[#162447] transition"
                    >
                        Go to Homepage
                    </button>
                </div>
            </div>
        );
    }

    // --- Helpers for Comparison Table ---
    // Extract unique features from pricing tiers to build a comparison table
    const allTierFeatures = Array.from(new Set(data.pricing.tiers.flatMap(tier => tier.features)));

    // Add some generic features if the list is short
    const comparisonRows = [
        ...allTierFeatures.map(f => ({ name: f, isDynamic: true })),
        { name: "Dedicated Support", isDynamic: false, values: [false, "Priority", "24/7 Dedicated"] },
        { name: "API Access", isDynamic: false, values: [true, true, true] },
        { name: "Custom Integrations", isDynamic: false, values: [false, true, true] },
        { name: "SLA Guarantee", isDynamic: false, values: [false, false, "99.9%"] },
    ];

    return (
        <div className="w-full bg-white text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: rgba(156, 163, 175, 0.3);
                    border-radius: 20px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background-color: rgba(156, 163, 175, 0.5);
                }
            `}</style>

            {/* Navbar */}
            <Navbar>
                <NavBody>
                    <NavbarLogo />
                    <div className="flex-1 flex flex-row items-center justify-center space-x-1 text-sm font-medium text-slate-700 transition duration-200 px-4 min-w-0">
                        {/* Products Dropdown */}
                        <div
                            className="relative shrink-0"
                            onMouseEnter={handleProductsMouseEnter}
                            onMouseLeave={handleProductsMouseLeave}
                        >
                            <button
                                className="px-3 py-2 text-slate-700 hover:text-slate-900 font-medium flex items-center gap-1 whitespace-nowrap"
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
                                            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
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
                                className="px-3 py-2 text-slate-700 hover:text-slate-900 font-medium flex items-center gap-1 whitespace-nowrap"
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
                                            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
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
                                className="px-3 py-2 text-slate-700 hover:text-slate-900 font-medium transition cursor-pointer whitespace-nowrap shrink-0"
                            >
                                {item.name}
                            </a>
                        ))}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                        <NavbarButton
                            variant="outline"
                            onClick={handleLogin}
                            disabled={isLoading}
                            as="button"
                            className="rounded-xl px-6 py-2.5"
                        >
                            {isLoading ? 'Loading...' : 'Sign In'}
                        </NavbarButton>
                        <NavbarButton
                            variant="gradient"
                            onClick={() => navigate({ to: '/onboarding' })}
                            as="button"
                            className="rounded-xl px-6 py-2.5"
                        >
                            Start Free Trial
                        </NavbarButton>
                    </div>
                </NavBody>

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
                                className="relative text-neutral-600 dark:text-neutral-300 cursor-pointer"
                            >
                                <span className="block">{item.name}</span>
                            </a>
                        ))}
                        <div className="flex w-full flex-col gap-3">
                            <NavbarButton
                                onClick={() => {
                                    setIsMobileMenuOpen(false);
                                    navigate({ to: '/' });
                                }}
                                variant="ghost"
                                className="w-full rounded-xl"
                                as="button"
                            >
                                Home
                            </NavbarButton>
                            <NavbarButton
                                onClick={() => {
                                    setIsMobileMenuOpen(false);
                                    navigate({ to: '/onboarding' });
                                }}
                                variant="gradient"
                                className="w-full rounded-xl"
                                as="button"
                            >
                                Start Free Trial
                            </NavbarButton>
                        </div>
                    </MobileNavMenu>
                </MobileNav>
            </Navbar>

            {/* 1. HERO SECTION */}
            <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-white">
                {/* Animated Background */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-white to-white"></div>
                    <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[600px] h-[600px] bg-blue-400/10 rounded-full blur-[100px] animate-pulse"></div>
                    <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[500px] h-[500px] bg-purple-400/10 rounded-full blur-[100px]"></div>
                </div>

                <div className="container mx-auto px-4 lg:px-8 relative z-10">
                    <div className="max-w-5xl mx-auto text-center mb-16">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-8 border border-blue-100 shadow-sm">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                            New: AI-Powered Insights
                        </div>
                        <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight mb-8 text-[#1B2E5A]">
                            {data.hero.headline}
                        </h1>
                        <p className="text-xl text-slate-600 mb-10 max-w-3xl mx-auto leading-relaxed">
                            {data.hero.subheadline}
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                            <button
                                onClick={() => navigate({ to: '/onboarding' })}
                                className="px-8 py-4 bg-[#1B2E5A] hover:bg-[#162447] text-white rounded-full font-semibold text-lg transition shadow-xl shadow-blue-600/20 hover:shadow-blue-600/40 hover:-translate-y-1 flex items-center gap-2"
                            >
                                {data.hero.primaryCTA} <ArrowRight size={20} />
                            </button>
                            <button className="px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-full font-semibold text-lg transition flex items-center gap-2 shadow-sm hover:shadow-md">
                                <PlayCircle size={20} /> {data.hero.secondaryCTA}
                            </button>
                        </div>
                    </div>

                    {/* Hero Dashboard Preview */}
                    <div className="relative max-w-6xl mx-auto">
                        <div className="relative rounded-2xl bg-white/60 p-3 backdrop-blur-sm border border-slate-200/50 shadow-2xl">
                            <div className="rounded-xl bg-white overflow-hidden border border-slate-200 relative h-[400px] md:h-[600px] flex flex-col">
                                {/* Dashboard Header */}
                                <div className="h-14 border-b border-slate-100 flex items-center px-6 justify-between bg-slate-50">
                                    <div className="flex gap-2">
                                        <div className="w-3 h-3 rounded-full bg-red-400"></div>
                                        <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                                        <div className="w-3 h-3 rounded-full bg-green-400"></div>
                                    </div>
                                    <div className="h-2 w-32 bg-slate-200 rounded-full"></div>
                                </div>
                                {/* Dashboard Content */}
                                <div className="flex-1 p-6 md:p-8 overflow-hidden bg-slate-50">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                                        {data.hero.stats.map((stat, i) => (
                                            <div key={i} className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
                                                <div className="text-slate-500 text-sm font-medium mb-2">{stat.label}</div>
                                                <div className="text-2xl font-bold text-[#1B2E5A]">{stat.value}</div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full pb-20">
                                        <div className="md:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm p-6 flex flex-col">
                                            <div className="flex justify-between mb-6">
                                                <h4 className="font-bold text-slate-700">Performance Overview</h4>
                                                <div className="flex gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-blue-500 mt-2"></span>
                                                    <span className="text-xs text-slate-500">Revenue</span>
                                                </div>
                                            </div>
                                            <div className="flex-1">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={lineData}>
                                                        <defs>
                                                            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                            </linearGradient>
                                                        </defs>
                                                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                                        <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                                        <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorValue)" />
                                                        <Area type="monotone" dataKey="uv" stroke="#8b5cf6" strokeWidth={2} fillOpacity={0} />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 flex flex-col">
                                            <h4 className="font-bold text-slate-700 mb-6">Distribution</h4>
                                            <div className="flex-1">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            data={pieData}
                                                            innerRadius={60}
                                                            outerRadius={80}
                                                            paddingAngle={5}
                                                            dataKey="value"
                                                            stroke="none"
                                                        >
                                                            {pieData.map((_, index) => (
                                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                            ))}
                                                        </Pie>
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 2. STATS BAR */}
            <div className="border-y border-slate-100 bg-white py-12">
                <div className="container mx-auto px-4">
                    <div className="flex flex-wrap justify-center gap-12 lg:gap-24 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
                        {['Acme Corp', 'GlobalTech', 'Nebula', 'FoxRun', 'Circle'].map((logo, i) => (
                            <div key={i} className="text-xl font-bold font-serif text-slate-400 flex items-center gap-2">
                                <div className="w-8 h-8 bg-slate-200 rounded-full"></div>
                                {logo}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 3. PROBLEM / SOLUTION - COMPACT WINDOW LAYOUT */}
            <section className="py-24 bg-slate-50 relative overflow-hidden" id="perspective">
                {/* Background Decor */}
                <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>

                <div className="container mx-auto px-4 relative z-10">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <span className="text-blue-600 font-bold tracking-wider uppercase text-sm mb-4 block">The Evolution</span>
                        <h2 className="text-3xl lg:text-4xl font-bold mb-6 text-[#1B2E5A] leading-tight">
                            The Shift in Perspective
                        </h2>
                        <p className="text-lg text-slate-600">
                            See how {productName} changes the game by bringing order to chaos.
                        </p>
                    </div>

                    <div className="flex flex-col lg:flex-row gap-8 justify-center items-stretch max-w-6xl mx-auto h-[650px] lg:h-[550px]">

                        {/* THE PROBLEM CARD (COMPACT & SCROLLABLE) */}
                        <div className="flex-1 bg-white rounded-2xl border border-red-100 shadow-xl overflow-hidden flex flex-col relative group hover:shadow-2xl hover:shadow-red-900/10 transition-all duration-500">
                            {/* Card Header */}
                            <div className="bg-red-50/80 backdrop-blur-sm p-4 border-b border-red-100 flex items-center justify-between z-20">
                                <div className="flex items-center gap-2">
                                    <div className="flex gap-1.5">
                                        <div className="w-3 h-3 rounded-full bg-red-400"></div>
                                        <div className="w-3 h-3 rounded-full bg-red-300"></div>
                                        <div className="w-3 h-3 rounded-full bg-red-200"></div>
                                    </div>
                                    <span className="text-xs font-bold text-red-700 uppercase ml-2 tracking-wide">Manual Workflow</span>
                                </div>
                                <XCircle size={18} className="text-red-400" />
                            </div>

                            {/* Visualization Background (Chaotic) */}
                            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
                                {[...Array(6)].map((_, i) => (
                                    <div key={i} className="absolute animate-pulse"
                                        style={{
                                            top: `${Math.random() * 80 + 10}%`,
                                            left: `${Math.random() * 80 + 10}%`,
                                            animationDuration: `${Math.random() * 3 + 2}s`
                                        }}>
                                        <AlertCircle size={24} className="text-red-500" />
                                    </div>
                                ))}
                            </div>

                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-8 relative z-10">
                                <div className="mb-6">
                                    <h4 className="text-2xl font-bold text-slate-800 mb-2 leading-tight">
                                        {data.problem.headline}
                                    </h4>
                                    <div className="h-1 w-12 bg-red-400 rounded-full"></div>
                                </div>

                                <div className="space-y-4">
                                    {data.problem.painPoints.map((point, i) => (
                                        <div key={i} className="bg-white/80 border border-red-50 p-4 rounded-xl shadow-sm backdrop-blur-sm hover:border-red-200 transition-colors">
                                            <div className="flex gap-3">
                                                <div className="mt-1 text-red-500 shrink-0">
                                                    <X size={16} />
                                                </div>
                                                <div>
                                                    <p className="text-slate-700 font-medium text-sm leading-relaxed">{point.text}</p>
                                                    <p className="text-xs text-red-400 mt-1 font-mono">Status: Bottleneck Detected</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Dummy Extra Content to force scroll if needed */}
                                    <div className="opacity-50 space-y-3 pt-4 grayscale">
                                        <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                                        <div className="h-4 bg-slate-100 rounded w-1/2"></div>
                                        <div className="h-4 bg-slate-100 rounded w-2/3"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* THE SOLUTION CARD (COMPACT & SCROLLABLE) */}
                        <div className="flex-1 bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl shadow-blue-900/20 overflow-hidden flex flex-col relative group transform lg:scale-105 z-20 transition-all duration-500">
                            {/* Card Header */}
                            <div className="bg-slate-800/80 backdrop-blur-sm p-4 border-b border-slate-700 flex items-center justify-between z-20">
                                <div className="flex items-center gap-2">
                                    <div className="flex gap-1.5">
                                        <div className="w-3 h-3 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)] animate-pulse"></div>
                                        <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                                        <div className="w-3 h-3 rounded-full bg-slate-600"></div>
                                    </div>
                                    <span className="text-xs font-bold text-blue-300 uppercase ml-2 tracking-wide">Automated System</span>
                                </div>
                                <CheckCircle size={18} className="text-green-400" />
                            </div>

                            {/* Visualization Background (Organized) */}
                            <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
                                <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                                    <defs>
                                        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                                        </pattern>
                                    </defs>
                                    <rect width="100%" height="100%" fill="url(#grid)" />
                                </svg>
                            </div>

                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-8 relative z-10">
                                <div className="mb-6">
                                    <h4 className="text-2xl font-bold text-white mb-2 leading-tight">
                                        {data.solution.headline}
                                    </h4>
                                    <div className="h-1 w-12 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)]"></div>
                                </div>

                                <div className="space-y-4">
                                    {/* Hero Stat in Solution */}
                                    <div className="flex gap-4 mb-6">
                                        <div className="flex-1 bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                                            <div className="text-xs text-slate-400 uppercase">Efficiency</div>
                                            <div className="text-xl font-bold text-green-400">+300%</div>
                                        </div>
                                        <div className="flex-1 bg-white/5 border border-white/10 rounded-lg p-3 text-center">
                                            <div className="text-xs text-slate-400 uppercase">Errors</div>
                                            <div className="text-xl font-bold text-blue-400">0%</div>
                                        </div>
                                    </div>

                                    {data.solution.differentiators.map((diff, i) => (
                                        <div key={i} className="bg-gradient-to-r from-blue-900/40 to-slate-800/40 border border-blue-500/30 p-4 rounded-xl shadow-lg backdrop-blur-sm hover:border-blue-400/50 transition-colors">
                                            <div className="flex gap-3 items-center">
                                                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                                                    <diff.icon size={16} />
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-slate-100 font-medium text-sm">{diff.text}</p>
                                                </div>
                                                <Check size={14} className="text-green-500" />
                                            </div>
                                        </div>
                                    ))}

                                    {/* Interactive-looking elements */}
                                    <div className="mt-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-between">
                                        <span className="text-xs text-green-300 font-mono flex items-center gap-2">
                                            <span className="w-2 h-2 bg-green-400 rounded-full animate-ping"></span>
                                            System Optimized
                                        </span>
                                        <button className="text-xs bg-green-500/20 hover:bg-green-500/30 text-green-300 px-3 py-1 rounded transition-colors">View Logs</button>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            {/* 4. FEATURES - STACKING CARDS LAYOUT */}
            <section className="py-24 bg-white relative">
                <div className="container mx-auto px-4 max-w-6xl">
                    <div className="text-center max-w-3xl mx-auto mb-24">
                        <h2 className="text-4xl lg:text-5xl font-bold mb-6 text-[#1B2E5A] tracking-tight">
                            Everything you need to <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">scale</span>
                        </h2>
                        <p className="text-xl text-slate-600">
                            Explore the powerful capabilities built into the core of {productName}.
                        </p>
                    </div>

                    <div ref={container} className="space-y-12 pb-24">
                        {data.features.map((feature, idx) => {
                            return (
                                <FeatureCard
                                    key={idx}
                                    i={idx}
                                    feature={feature}
                                />
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* 5. USE CASES TABS */}
            <section className="py-24 bg-slate-900 text-white relative overflow-hidden">
                {/* Background decoration */}
                <div className="absolute top-0 right-0 -mr-20 -mt-20 w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[100px] opacity-30"></div>
                <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[100px] opacity-30"></div>

                <div className="container mx-auto px-4 relative z-10">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl lg:text-4xl font-bold mb-4">Built for Your Industry</h2>
                        <p className="text-slate-400">Tailored solutions for specific business needs.</p>
                    </div>

                    <div className="grid lg:grid-cols-3 gap-8">
                        {data.useCases.map((useCase, idx) => (
                            <div key={idx} className="relative p-8 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 group">
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity"></div>
                                <div className="relative z-10">
                                    <h3 className="text-2xl font-bold mb-4 text-white group-hover:text-blue-300 transition-colors flex items-center gap-2">
                                        {useCase.title} <ChevronRight size={20} className="opacity-0 group-hover:opacity-100 -ml-4 group-hover:ml-0 transition-all" />
                                    </h3>
                                    <p className="text-slate-300 mb-6 min-h-[3rem]">{useCase.description}</p>

                                    <div className="space-y-3">
                                        {useCase.benefits.map((b, i) => (
                                            <div key={i} className="flex items-center gap-2 text-sm text-slate-400">
                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                                {b}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 6. FEATURE COMPARISON TABLE (REPLACES PRICING) */}
            <section className="py-24 bg-white" id="comparison">
                <div className="container mx-auto px-4">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-4 border border-blue-100">
                            <LayoutGrid size={12} /> Compare Plans
                        </div>
                        <h2 className="text-3xl lg:text-4xl font-bold mb-6 text-[#1B2E5A]">
                            Find the Perfect Fit
                        </h2>
                        <p className="text-lg text-slate-600">
                            Detailed breakdown of features across all plans.
                        </p>
                    </div>

                    <div className="max-w-6xl mx-auto">
                        {/* Comparison Table Container */}
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden mb-20">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[800px] border-collapse">
                                    <thead>
                                        <tr>
                                            <th className="p-6 text-left w-1/3 bg-slate-50/50 border-b border-r border-slate-100 sticky left-0 backdrop-blur-sm z-10">
                                                <span className="text-slate-400 text-sm font-semibold uppercase tracking-wider">Features</span>
                                            </th>
                                            {data.pricing.tiers.map((tier, idx) => (
                                                <th key={idx} className={`p-6 text-center w-1/5 border-b border-slate-100 ${tier.popular ? 'bg-blue-50/30' : 'bg-white'}`}>
                                                    <div className="font-bold text-xl text-[#1B2E5A] mb-1">{tier.name}</div>
                                                    <div className="text-blue-600 font-semibold text-sm">Contact Us</div>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {comparisonRows.map((row, rowIdx) => (
                                            <tr key={rowIdx} className="hover:bg-slate-50 transition-colors group">
                                                <td className="p-5 border-b border-r border-slate-100 text-slate-700 font-medium sticky left-0 bg-white group-hover:bg-slate-50 z-10 flex items-center gap-2">
                                                    {row.name}
                                                    <div className="text-slate-300 hover:text-blue-500 cursor-help transition-colors">
                                                        <AlertCircle size={14} />
                                                    </div>
                                                </td>
                                                {data.pricing.tiers.map((tier, colIdx) => {
                                                    let cellContent;

                                                    if (row.isDynamic) {
                                                        // Check if this tier has the feature string
                                                        const hasFeature = tier.features.includes(row.name);
                                                        cellContent = hasFeature
                                                            ? <div className="flex justify-center"><div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><Check size={16} strokeWidth={3} /></div></div>
                                                            : <div className="flex justify-center"><Minus size={16} className="text-slate-300" /></div>;
                                                    } else {
                                                        // Use manual values
                                                        const val = 'values' in row && row.values ? row.values[colIdx] : false;
                                                        if (typeof val === 'boolean') {
                                                            cellContent = val
                                                                ? <div className="flex justify-center"><div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center"><Check size={16} strokeWidth={3} /></div></div>
                                                                : <div className="flex justify-center"><Minus size={16} className="text-slate-300" /></div>;
                                                        } else {
                                                            cellContent = <div className="text-center font-semibold text-slate-700">{val}</div>;
                                                        }
                                                    }

                                                    return (
                                                        <td key={colIdx} className={`p-5 border-b border-slate-100 ${tier.popular ? 'bg-blue-50/10' : ''}`}>
                                                            {cellContent}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                        {/* Action Row */}
                                        <tr>
                                            <td className="p-6 border-r border-slate-100 sticky left-0 bg-white z-10"></td>
                                            {data.pricing.tiers.map((tier, idx) => (
                                                <td key={idx} className={`p-6 text-center ${tier.popular ? 'bg-blue-50/10' : ''}`}>
                                                    <button
                                                        onClick={() => navigate({ to: '/onboarding' })}
                                                        className={`w-full py-3 rounded-lg font-bold text-sm transition-all ${tier.popular
                                                            ? 'bg-[#1B2E5A] text-white hover:bg-[#162447] shadow-lg shadow-blue-600/20'
                                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                            }`}>
                                                        {tier.cta}
                                                    </button>
                                                </td>
                                            ))}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Additional Features Grid */}
                        <div className="bg-slate-50 rounded-3xl p-8 lg:p-12 border border-slate-200">
                            <h3 className="text-2xl font-bold mb-8 text-center text-slate-800 flex items-center justify-center gap-3">
                                <Sparkles className="text-amber-400 fill-amber-400" />
                                Included in All Plans
                            </h3>
                            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-y-6 gap-x-8">
                                {[
                                    "SSO & 2FA Security", "99.9% Uptime SLA", "GDPR Compliance", "Daily Backups",
                                    "Mobile App Access", "Custom Branding", "API Documentation", "Community Access",
                                    "Email Support", "Video Tutorials", "Data Export", "Audit Logs"
                                ].map((feature, i) => (
                                    <div key={i} className="flex items-center gap-3 text-slate-700">
                                        <div className="w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0">
                                            <Check size={12} strokeWidth={3} />
                                        </div>
                                        <span className="font-medium text-sm">{feature}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 7. TESTIMONIAL & FINAL CTA */}
            <section className="py-24 bg-gradient-to-b from-blue-50 to-white">
                <div className="container mx-auto px-4">
                    <div className="max-w-4xl mx-auto text-center mb-24">
                        <div className="inline-block p-3 rounded-2xl bg-white shadow-xl mb-12 border border-slate-100">
                            <div className="flex text-yellow-400 gap-1 mb-2 justify-center">
                                {[1, 2, 3, 4, 5].map(i => <Star key={i} className="fill-current" size={20} />)}
                            </div>
                            <h3 className="text-2xl lg:text-3xl font-bold text-[#1B2E5A] mb-6 leading-snug px-4">
                                "{data.socialProof.testimonial.quote}"
                            </h3>
                            <div className="flex items-center justify-center gap-4">
                                <div className="h-12 w-12 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold text-xl">
                                    {data.socialProof.testimonial.author.charAt(0)}
                                </div>
                                <div className="text-left">
                                    <div className="font-bold text-[#1B2E5A]">{data.socialProof.testimonial.author}</div>
                                    <div className="text-sm text-slate-500">{data.socialProof.testimonial.title}, {data.socialProof.testimonial.company}</div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-8 border-t border-slate-200 pt-12">
                            {data.socialProof.stats.map((stat, i) => (
                                <div key={i}>
                                    <div className="text-3xl lg:text-4xl font-bold text-[#1B2E5A] mb-1">{stat.value}</div>
                                    <div className="text-sm text-slate-500 uppercase tracking-wide">{stat.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="relative bg-slate-900 rounded-[2.5rem] p-12 lg:p-24 text-center overflow-hidden shadow-2xl">
                        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-blue-500/30 rounded-full blur-[80px]"></div>
                        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 bg-purple-500/30 rounded-full blur-[80px]"></div>

                        <div className="relative z-10 max-w-3xl mx-auto">
                            <h2 className="text-4xl lg:text-6xl font-bold mb-8 text-white tracking-tight">
                                {data.finalCTA.headline}
                            </h2>
                            <p className="text-xl text-slate-300 mb-12">
                                {data.finalCTA.description}
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <button
                                    onClick={() => navigate({ to: '/onboarding' })}
                                    className="px-10 py-5 bg-white text-slate-900 hover:bg-blue-50 rounded-full font-bold text-lg shadow-xl shadow-white/10 transition hover:scale-105"
                                >
                                    {data.finalCTA.primaryCTA}
                                </button>
                                <button className="px-10 py-5 bg-transparent border border-slate-700 text-white hover:bg-slate-800 rounded-full font-bold text-lg transition">
                                    Schedule a Demo
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <LandingFooter />
        </div>
    );
};

export default ProductPage;
