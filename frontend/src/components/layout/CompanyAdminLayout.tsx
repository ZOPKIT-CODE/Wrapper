import { Link } from '@tanstack/react-router'
import { Building2 } from 'lucide-react'
import { ThemeToggle } from '@/components/theme/ThemeToggle'

export function CompanyAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <header className="border-border/60 bg-background/55 sticky top-0 z-30 flex h-14 items-center gap-6 border-b px-6 backdrop-blur-xl backdrop-saturate-150">
        <Link
          to="/company-admin"
          className="text-foreground flex items-center gap-2 text-sm font-semibold"
        >
          <Building2 className="text-primary h-5 w-5" aria-hidden="true" />
          Company Admin
        </Link>
        <nav className="text-muted-foreground flex items-center gap-4 text-sm">
          <Link
            to="/company-admin"
            className="hover:text-foreground transition-colors"
          >
            Dashboard
          </Link>
          <Link
            to="/dashboard/applications"
            className="hover:text-foreground transition-colors"
          >
            Workspace
          </Link>
        </nav>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
