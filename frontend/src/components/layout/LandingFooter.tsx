import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { Linkedin, Facebook, Instagram, AtSign, Mail, MapPin, Phone } from 'lucide-react';
import { config } from '@/lib/config';
import { cn } from '@/lib/utils';

const footerPolicyLinks = [
  { to: '/privacy', label: 'Privacy' },
  { to: '/terms', label: 'Terms' },
  { to: '/refund-policy', label: 'Refunds' },
  { to: '/cookies', label: 'Cookies' },
  { to: '/security', label: 'Security' },
] as const;

const productLinks = [
  { to: '/products/b2b-crm', label: 'B2B CRM' },
  { to: '/products/financial-accounting', label: 'Finance' },
  { to: '/products/operations-management', label: 'Operations' },
  { to: '/products/hrms', label: 'HRMS' },
  { to: '/products/project-management', label: 'Projects' },
  { to: '/products/flowtilla', label: 'Flowtilla' },
  { to: '/products/b2c-crm', label: 'B2C CRM' },
  { to: '/products/esop-system', label: 'ESOP' },
  { to: '/products/zopkit-academy', label: 'Academy' },
  { to: '/products/zopkit-itsm', label: 'ITSM' },
] as const;

const industryLinks = [
  { to: '/industries/e-commerce', label: 'E-Commerce & Retail' },
  { to: '/industries/saas', label: 'SaaS & Technology' },
  { to: '/industries/manufacturing', label: 'Manufacturing' },
  { to: '/industries/professional-services', label: 'Professional Services' },
] as const;

const resourceLinks = [
  { to: '/pricing', label: 'Pricing' },
  { to: '/blog', label: 'Blog' },
  { to: '/case-studies', label: 'Case studies' },
  { to: '/docs', label: 'Documentation' },
  { to: '/help', label: 'Help center' },
  { to: '/community', label: 'Community' },
  { to: '/roadmap', label: 'Roadmap' },
] as const;

type LandingFooterProps = {
  /** Applies landing-page typography and spacing */
  marketing?: boolean;
};

export function LandingFooter({ marketing = false }: LandingFooterProps) {
  return (
    <footer
      className={cn(
        'border-t border-border bg-background',
        marketing && 'landing-footer landing-footer-minimal'
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 sm:pt-16 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8">
          <div className="lg:col-span-4 space-y-5">
            <Link to="/" className="inline-flex items-center cursor-pointer">
              <img
                src={config.FULL_LOGO_URL}
                alt="Zopkit"
                className="h-9 w-auto object-contain"
              />
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
              One workspace for CRM, finance, HR, and operations. Shared identity, records, and billing across every module.
            </p>
            <nav className="flex flex-wrap gap-2" aria-label="Zopkit on social media">
              <SocialLink
                href="https://www.linkedin.com/company/zopkit/posts/?feedView=all"
                icon={<Linkedin size={16} />}
                label="Zopkit on LinkedIn"
              />
              <SocialLink
                href="https://www.facebook.com/Zopkit/photos/"
                icon={<Facebook size={16} />}
                label="Zopkit on Facebook"
              />
              <SocialLink
                href="https://www.instagram.com/iamzopkit/"
                icon={<Instagram size={16} />}
                label="Zopkit on Instagram"
              />
              <SocialLink
                href="https://www.threads.com/@iamzopkit"
                icon={<AtSign size={16} />}
                label="Zopkit on Threads"
              />
            </nav>
          </div>

          <div className="lg:col-span-2">
            <FooterHeading marketing={marketing}>Product</FooterHeading>
            <ul className="mt-4 space-y-2.5">
              {productLinks.map((link) => (
                <FooterLink key={link.to} to={link.to}>
                  {link.label}
                </FooterLink>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2">
            <FooterHeading marketing={marketing}>Industries</FooterHeading>
            <ul className="mt-4 space-y-2.5">
              {industryLinks.map((link) => (
                <FooterLink key={link.to} to={link.to}>
                  {link.label}
                </FooterLink>
              ))}
            </ul>
            <FooterHeading marketing={marketing} className="mt-8">
              Resources
            </FooterHeading>
            <ul className="mt-4 space-y-2.5">
              {resourceLinks.map((link) => (
                <FooterLink key={link.to} to={link.to}>
                  {link.label}
                </FooterLink>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-4">
            <FooterHeading marketing={marketing}>Contact</FooterHeading>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-foreground/70 shrink-0 mt-0.5" />
                <span>Hi-Tech City, Hyderabad</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-foreground/70 shrink-0" />
                <a href="tel:8971055515" className="hover:text-foreground transition-colors">
                  8971055515
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-foreground/70 shrink-0" />
                <a href="mailto:sales@zopkit.com" className="hover:text-foreground transition-colors">
                  sales@zopkit.com
                </a>
              </li>
            </ul>

            <div className="mt-8 landing-newsletter-box rounded-sm border border-border p-4">
              <p className="text-sm font-medium text-foreground">Product updates</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                New modules, workflow templates, and release notes. No spam.
              </p>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => e.preventDefault()}
              >
                <input
                  type="email"
                  placeholder="Work email"
                  aria-label="Email for newsletter"
                  className="flex-1 min-w-0 h-9 px-3 rounded-sm border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  type="submit"
                  className="h-9 px-3.5 rounded-full bg-foreground text-background text-sm font-medium hover:opacity-[0.88] transition-opacity cursor-pointer shrink-0"
                >
                  Join
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-xs text-muted-foreground landing-mono">
            © {new Date().getFullYear()} Zopkit Inc.
          </p>
          <nav
            className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground"
            aria-label="Legal and policy documents"
          >
            {footerPolicyLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="hover:text-foreground transition-colors cursor-pointer"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}

function FooterHeading({
  children,
  marketing,
  className,
}: {
  children: ReactNode;
  marketing?: boolean;
  className?: string;
}) {
  return (
    <h3
      className={cn(
        'text-xs font-medium uppercase tracking-[0.12em] text-foreground/80',
        marketing && 'landing-mono',
        className
      )}
    >
      {children}
    </h3>
  );
}

function SocialLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: ReactNode;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="w-9 h-9 rounded-sm border border-border bg-background flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors cursor-pointer"
      aria-label={label}
    >
      {icon}
    </a>
  );
}

function FooterLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <li>
      <Link
        to={to}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        {children}
      </Link>
    </li>
  );
}
