import { MarketingNavbar } from '@/components/layout/MarketingNavbar';
import { BlogSearchCommand } from './BlogSearchCommand';

/** Public marketing-site shell for the blog (same nav as the landing page, no footer). */
export function PublicBlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNavbar />
      {/* MarketingNavbar is fixed (top-0, z-[100]); pad so blog content clears it. */}
      <main className="pt-20 lg:pt-24">{children}</main>
      {/* ⌘K search, available on every public blog page */}
      <BlogSearchCommand />
    </div>
  );
}
