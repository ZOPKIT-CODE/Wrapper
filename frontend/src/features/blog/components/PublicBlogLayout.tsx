import { MarketingNavbar } from '@/components/layout/MarketingNavbar'
import { MarketingPageShell } from '@/components/layout/MarketingPageShell'
import { useMarketingContactCta } from '@/features/landing/useMarketingContactCta'
import { BlogSearchCommand } from './BlogSearchCommand'

/** Public marketing-site shell for the blog (same nav as the landing page, no footer). */
export function PublicBlogLayout({ children }: { children: React.ReactNode }) {
  const scrollToContact = useMarketingContactCta()

  return (
    <MarketingPageShell>
      <MarketingNavbar minimal onBookDemo={scrollToContact} />
      <main className="pt-20 lg:pt-24">{children}</main>
      <BlogSearchCommand />
    </MarketingPageShell>
  )
}
