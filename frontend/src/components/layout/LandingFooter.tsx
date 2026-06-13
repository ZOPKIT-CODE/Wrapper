import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Linkedin,
  Facebook,
  Instagram,
  AtSign,
  Mail,
  MapPin,
  Phone,
} from 'lucide-react'
import { config } from '@/lib/config'
import { cn } from '@/lib/utils'

const footerPolicyLinks = [
  { to: '/privacy', label: 'Privacy' },
  { to: '/terms', label: 'Terms' },
  { to: '/refund-policy', label: 'Refunds' },
  { to: '/cookies', label: 'Cookies' },
  { to: '/security', label: 'Security' },
] as const

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
] as const

const industryLinks = [
  { to: '/industries/e-commerce', label: 'E-Commerce & Retail' },
  { to: '/industries/saas', label: 'SaaS & Technology' },
  { to: '/industries/manufacturing', label: 'Manufacturing' },
  { to: '/industries/professional-services', label: 'Professional Services' },
] as const

const resourceLinks = [
  { to: '/pricing', label: 'Pricing' },
  { to: '/blog', label: 'Blog' },
  { to: '/case-studies', label: 'Case studies' },
  { to: '/docs', label: 'Documentation' },
  { to: '/help', label: 'Help center' },
  { to: '/community', label: 'Community' },
  { to: '/roadmap', label: 'Roadmap' },
] as const

type LandingFooterProps = {
  /** Applies landing-page typography and spacing */
  marketing?: boolean
}

export function LandingFooter({ marketing = false }: LandingFooterProps) {
  return (
    <footer
      className={cn(
        'border-border bg-background border-t',
        marketing && 'landing-footer landing-footer-minimal'
      )}
    >
      <div className="mx-auto max-w-7xl px-4 pt-14 pb-10 sm:px-6 sm:pt-16 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          <div className="space-y-5 lg:col-span-4">
            <Link to="/" className="inline-flex cursor-pointer items-center">
              <img
                src={config.FULL_LOGO_URL}
                alt="Zopkit"
                className="h-9 w-auto object-contain"
              />
            </Link>
            <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
              One workspace for CRM, finance, HR, and operations. Shared
              identity, records, and billing across every module.
            </p>
            <nav
              className="flex flex-wrap gap-2"
              aria-label="Zopkit on social media"
            >
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
            <ul className="text-muted-foreground mt-4 space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <MapPin className="text-foreground/70 mt-0.5 h-4 w-4 shrink-0" />
                <span>Hi-Tech City, Hyderabad</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="text-foreground/70 h-4 w-4 shrink-0" />
                <a
                  href="tel:8971055515"
                  className="hover:text-foreground transition-colors"
                >
                  8971055515
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="text-foreground/70 h-4 w-4 shrink-0" />
                <a
                  href="mailto:sales@zopkit.com"
                  className="hover:text-foreground transition-colors"
                >
                  sales@zopkit.com
                </a>
              </li>
            </ul>

            <div className="landing-newsletter-box border-border mt-8 rounded-sm border p-4">
              <p className="text-foreground text-sm font-medium">
                Product updates
              </p>
              <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
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
                  className="border-border bg-background focus:ring-ring h-9 min-w-0 flex-1 rounded-sm border px-3 text-sm focus:ring-1 focus:outline-none"
                />
                <button
                  type="submit"
                  className="bg-foreground text-background h-9 shrink-0 cursor-pointer rounded-full px-3.5 text-sm font-medium transition-opacity hover:opacity-[0.88]"
                >
                  Join
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="border-border mt-12 flex flex-col gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground landing-mono text-xs">
            © {new Date().getFullYear()} Zopkit Inc.
          </p>
          <nav
            className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-2 text-xs"
            aria-label="Legal and policy documents"
          >
            {footerPolicyLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="hover:text-foreground cursor-pointer transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  )
}

function FooterHeading({
  children,
  marketing,
  className,
}: {
  children: ReactNode
  marketing?: boolean
  className?: string
}) {
  return (
    <h3
      className={cn(
        'text-foreground/80 text-xs font-medium tracking-[0.12em] uppercase',
        marketing && 'landing-mono',
        className
      )}
    >
      {children}
    </h3>
  )
}

function SocialLink({
  href,
  icon,
  label,
}: {
  href: string
  icon: ReactNode
  label: string
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="border-border bg-background text-muted-foreground hover:text-foreground hover:border-foreground/20 flex h-9 w-9 cursor-pointer items-center justify-center rounded-sm border transition-colors"
      aria-label={label}
    >
      {icon}
    </a>
  )
}

function FooterLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <li>
      <Link
        to={to}
        className="text-muted-foreground hover:text-foreground cursor-pointer text-sm transition-colors"
      >
        {children}
      </Link>
    </li>
  )
}
