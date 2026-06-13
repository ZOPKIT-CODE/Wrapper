import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md mx-auto text-center space-y-6">
        <p className="text-8xl font-medium text-muted-foreground/25 select-none leading-none">404</p>
        <div className="space-y-2">
          <h1 className="text-2xl font-medium text-foreground">Page not found</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The page you requested does not exist or may have moved.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Button onClick={() => navigate({ to: '/' })} className="gap-2">
            <Home className="w-4 h-4" />
            Go home
          </Button>
          <Button onClick={() => window.history.back()} variant="outline" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Go back
          </Button>
        </div>
      </div>
    </div>
  )
}
