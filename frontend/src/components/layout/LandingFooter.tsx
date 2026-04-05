import React from 'react';
import { Link } from '@tanstack/react-router';
import { Linkedin, Facebook, Instagram, AtSign, Mail, MapPin, Phone } from 'lucide-react';
import { config } from '@/lib/config';

const footerPolicyLinks = [
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/terms', label: 'Terms of Service' },
  { to: '/refund-policy', label: 'Cancellation & Refund Policy' },
  { to: '/cookies', label: 'Cookie Policy' },
  { to: '/security', label: 'Security' },
] as const;

export function LandingFooter() {
  return (
    <footer className="bg-slate-50 pt-20 pb-10 border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
          
          {/* Brand Column */}
          <div className="space-y-6">
            <Link to="/" className="flex items-center space-x-2 block w-fit cursor-pointer">
              <img
                src={config.FULL_LOGO_URL}
                alt="Zopkit"
                className="h-10 rounded-xl w-auto object-contain"
              />
            </Link>
            <p className="text-slate-600 leading-relaxed">
              The complete business operating system for modern companies. Streamline operations, boost productivity, and scale faster.
            </p>
            <nav className="flex flex-wrap gap-3" aria-label="Zopkit on social media">
              <SocialLink
                href="https://www.linkedin.com/company/zopkit/posts/?feedView=all"
                icon={<Linkedin size={20} />}
                label="Zopkit on LinkedIn"
                target="_blank"
                rel="noopener noreferrer"
              />
              <SocialLink
                href="https://www.facebook.com/Zopkit/photos/"
                icon={<Facebook size={20} />}
                label="Zopkit on Facebook"
                target="_blank"
                rel="noopener noreferrer"
              />
              <SocialLink
                href="https://www.instagram.com/iamzopkit/"
                icon={<Instagram size={20} />}
                label="Zopkit on Instagram"
                target="_blank"
                rel="noopener noreferrer"
              />
              <SocialLink
                href="https://www.threads.com/@iamzopkit"
                icon={<AtSign size={20} />}
                label="Zopkit on Threads"
                target="_blank"
                rel="noopener noreferrer"
              />
            </nav>
          </div>

          {/* Product Column */}
          <div>
            <h3 className="font-bold text-[#1B2E5A] mb-6 text-lg">Product</h3>
            <ul className="space-y-4">
              <FooterLink to="/products/affiliate-connect">Affiliate Connect</FooterLink>
              <FooterLink to="/products/b2b-crm">B2B CRM</FooterLink>
              <FooterLink to="/products/b2c-crm">B2C CRM</FooterLink>
              <FooterLink to="/products/operations-management">Operations Management</FooterLink>
              <FooterLink to="/products/project-management">Project Management</FooterLink>
              <FooterLink to="/products/financial-accounting">Financial Accounting</FooterLink>
              <FooterLink to="/products/hrms">HRMS</FooterLink>
              <FooterLink to="/products/esop-system">ESOP System</FooterLink>
              <FooterLink to="/products/flowtilla">Flowtilla</FooterLink>
              <FooterLink to="/products/zopkit-academy">Zopkit Academy</FooterLink>
              <FooterLink to="/products/zopkit-itsm">Zopkit ITSM</FooterLink>
            </ul>
          </div>

          {/* Industries Column */}
          <div>
            <h3 className="font-bold text-[#1B2E5A] mb-6 text-lg">Industries</h3>
            <ul className="space-y-4">
              <FooterLink to="/industries/e-commerce">E-Commerce & Retail</FooterLink>
              <FooterLink to="/industries/saas">SaaS & Technology</FooterLink>
              <FooterLink to="/industries/manufacturing">Manufacturing</FooterLink>
              <FooterLink to="/industries/professional-services">Professional Services</FooterLink>
            </ul>
          </div>

          {/* Resources Column */}
          <div>
            <h3 className="font-bold text-[#1B2E5A] mb-6 text-lg">Resources</h3>
            <ul className="space-y-4">
              <FooterLink to="/blog">Blog</FooterLink>
              <FooterLink to="/case-studies">Case Studies</FooterLink>
              <FooterLink to="/docs">Documentation</FooterLink>
              <FooterLink to="/help">Help Center</FooterLink>
              <FooterLink to="/community">Community</FooterLink>
              <FooterLink to="/roadmap">Product Roadmap</FooterLink>
              <FooterLink to="/pricing">Pricing</FooterLink>
            </ul>
          </div>

          {/* Contact Column */}
          <div>
            <h3 className="font-bold text-[#1B2E5A] mb-6 text-lg">Contact</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 text-slate-600">
                <MapPin className="w-5 h-5 text-[#1B2E5A] shrink-0 mt-0.5" />
                <span>Hi-Tech City, Hyderabad</span>
              </li>
              <li className="flex items-center gap-3 text-slate-600">
                <Phone className="w-5 h-5 text-[#1B2E5A] shrink-0" />
                <span>8971055515</span>
              </li>
              <li className="flex items-center gap-3 text-slate-600">
                <Mail className="w-5 h-5 text-[#1B2E5A] shrink-0" />
                <span>sales@zopkit.com</span>
              </li>
            </ul>
            
            <div className="mt-8">
              <h4 className="font-semibold text-[#1B2E5A] mb-2">Subscribe to our newsletter</h4>
              <div className="flex flex-col sm:flex-row gap-2">
                <input 
                  type="email" 
                  placeholder="Enter your email" 
                  className="bg-white border border-slate-300 text-[#1B2E5A] rounded-lg px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-[#1B2E5A]/20 focus:border-[#1B2E5A]/40 transition-all"
                />
                <button type="button" className="bg-[#1B2E5A] hover:bg-[#243B6E] text-white px-4 py-2 rounded-lg font-medium transition-colors cursor-pointer">
                  Go
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Legal & policies — centered; policy URLs for compliance (e.g. payments onboarding) */}
        <div className="border-t border-slate-200 pt-10 sm:pt-12 pb-2">
          <div className="mx-auto text-center px-2 max-w-7xl">
            <h2 className="text-sm font-semibold text-[#1B2E5A] tracking-wide uppercase mb-4">
              Legal &amp; policies
            </h2>
            <p className="text-slate-600 text-sm mb-6 leading-relaxed max-w-2xl mx-auto">
              Our privacy, terms, cancellation &amp; refund, and security policies describe how we handle your data,
              subscriptions, and payments.
            </p>
            <div className="flex justify-center overflow-x-auto pb-1 [scrollbar-width:thin]">
              <nav
                className="inline-flex flex-nowrap items-center justify-center text-xs sm:text-sm text-[#1B2E5A]"
                aria-label="Legal and policy documents"
              >
                {footerPolicyLinks.map((item, i) => (
                  <React.Fragment key={item.to}>
                    {i > 0 && (
                      <span className="text-slate-300 px-2 sm:px-2.5 shrink-0 select-none" aria-hidden>
                        |
                      </span>
                    )}
                    <Link
                      to={item.to}
                      className="font-medium hover:underline underline-offset-2 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {item.label}
                    </Link>
                  </React.Fragment>
                ))}
              </nav>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-200 text-center">
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} Zopkit Inc. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

function SocialLink({ href, icon, label, target, rel }: { href: string; icon: React.ReactNode; label: string; target?: string; rel?: string }) {
  return (
    <a
      href={href}
      target={target}
      rel={rel}
      className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-[#1B2E5A]/5 hover:text-[#1B2E5A] hover:border-[#1B2E5A]/20 transition-all duration-300 shadow-sm hover:shadow cursor-pointer"
      aria-label={label}
    >
      {icon}
    </a>
  );
}

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <li>
      <Link 
        to={to} 
        className="text-slate-600 hover:text-[#1B2E5A] transition-colors flex items-center gap-1 group cursor-pointer"
      >
        <span className="w-1 h-1 rounded-full bg-slate-300 group-hover:bg-[#1B2E5A] transition-colors mr-2"></span>
        {children}
      </Link>
    </li>
  );
}

