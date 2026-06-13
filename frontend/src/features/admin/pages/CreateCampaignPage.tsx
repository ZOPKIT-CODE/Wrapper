import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CreateCampaignForm } from '../components/seasonal-credits/CreateCampaignForm'

const SEASONAL_TAB = { tab: 'seasonal-credits' as const }

export default function CreateCampaignPage() {
  const navigate = useNavigate()

  const goBack = () => {
    navigate({ to: '/company-admin', search: SEASONAL_TAB })
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex w-full max-w-4xl items-start gap-3 px-4 py-4 sm:px-6">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-0.5 shrink-0"
            onClick={goBack}
            aria-label="Back to Seasonal Credits"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Create Credit Campaign
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Configure credits, targeting, and optional tenant notification
              content. You can distribute after creation.
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 pb-16 sm:px-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <CreateCampaignForm onSuccess={goBack} onCancel={goBack} />
        </div>
      </main>
    </div>
  )
}
