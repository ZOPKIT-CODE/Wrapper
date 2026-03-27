import React from 'react';
import { Link } from '@tanstack/react-router';
import { Twitter, Linkedin, Mail, MapPin, Phone, MessageSquare } from 'lucide-react';
import { config } from '@/lib/config';

export function LandingFooter() {
  return (
    <footer className="bg-slate-50 pt-20 pb-10 border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
          
          {/* Brand Column */}
          <div className="space-y-6">
            <Link to="/" className="flex items-center space-x-2 block w-fit">
              <img
                src={config.FULL_LOGO_URL}
                alt="Zopkit"
                className="h-10 rounded-xl w-auto object-contain"
              />
            </Link>
            <p className="text-slate-600 leading-relaxed">
              The complete business operating system for modern companies. Streamline operations, boost productivity, and scale faster.
            </p>
            <div className="flex space-x-4">
              <SocialLink href="https://x.com/zopkit" icon={<Twitter size={20} />} label="X (Twitter)" target="_blank" rel="noopener noreferrer" />
              <SocialLink href="https://www.linkedin.com/company/zopkit/" icon={<Linkedin size={20} />} label="LinkedIn" target="_blank" rel="noopener noreferrer" />
              <SocialLink href="https://www.reddit.com/r/zopkit/" icon={<MessageSquare size={20} />} label="Reddit" target="_blank" rel="noopener noreferrer" />
            </div>
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
              <FooterLink to="#pricing">Pricing</FooterLink>
            </ul>
          </div>

          {/* Contact Column */}
          <div>
            <h3 className="font-bold text-[#1B2E5A] mb-6 text-lg">Contact</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 text-slate-600">
                <MapPin className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <span>Hi-Tech City, Hyderabad</span>
              </li>
              <li className="flex items-center gap-3 text-slate-600">
                <Phone className="w-5 h-5 text-blue-600 shrink-0" />
                <span>8971055515</span>
              </li>
              <li className="flex items-center gap-3 text-slate-600">
                <Mail className="w-5 h-5 text-blue-600 shrink-0" />
                <span>sales@zopkit.com</span>
              </li>
            </ul>
            
            <div className="mt-8">
              <h4 className="font-semibold text-[#1B2E5A] mb-2">Subscribe to our newsletter</h4>
              <div className="flex flex-col sm:flex-row gap-2">
                <input 
                  type="email" 
                  placeholder="Enter your email" 
                  className="bg-white border border-slate-300 text-[#1B2E5A] rounded-lg px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                  Go
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} Zopkit Inc. All rights reserved.
          </p>
          <div className="flex flex-wrap gap-6 text-sm text-slate-500">
            <Link to="/privacy" className="hover:text-blue-600 transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-blue-600 transition-colors">Terms of Service</Link>
            <Link to="/cookies" className="hover:text-blue-600 transition-colors">Cookie Policy</Link>
            <Link to="/security" className="hover:text-blue-600 transition-colors">Security</Link>
          </div>
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
      className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all duration-300 shadow-sm hover:shadow"
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
        className="text-slate-600 hover:text-blue-600 transition-colors flex items-center gap-1 group"
      >
        <span className="w-1 h-1 rounded-full bg-slate-300 group-hover:bg-blue-600 transition-colors mr-2"></span>
        {children}
      </Link>
    </li>
  );
}

