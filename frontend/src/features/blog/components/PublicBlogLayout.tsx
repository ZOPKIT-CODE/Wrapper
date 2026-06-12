import { BlogSearchCommand } from './BlogSearchCommand'

/** Blog content wrapper — marketing chrome comes from `MarketingRouteLayout`. */
export function PublicBlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pt-20 lg:pt-24">{children}</div>
      <BlogSearchCommand />
    </>
  )
}
