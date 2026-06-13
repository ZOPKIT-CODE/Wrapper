import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="mx-auto max-w-md space-y-6 text-center">
        <p className="text-muted-foreground/25 text-8xl leading-none font-medium select-none">
          404
        </p>
        <div className="space-y-2">
          <h1 className="text-foreground text-2xl font-medium">
            Page not found
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            The page you requested does not exist or may have moved.
          </p>
        </div>
        <div className="flex flex-col justify-center gap-3 pt-2 sm:flex-row">
          <Button onClick={() => navigate({ to: '/' })} className="gap-2">
            <Home className="h-4 w-4" />
            Go home
          </Button>
          <Button
            onClick={() => window.history.back()}
            variant="outline"
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Go back
          </Button>
        </div>
      </div>
    </div>
  )
}
