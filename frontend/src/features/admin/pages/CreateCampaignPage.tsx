import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreateCampaignForm } from '../components/seasonal-credits/CreateCampaignForm';

const SEASONAL_TAB = { tab: 'seasonal-credits' as const };

export default function CreateCampaignPage() {
  const navigate = useNavigate();

  const goBack = () => {
    navigate({ to: '/company-admin', search: SEASONAL_TAB });
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 py-4 flex items-start gap-3">
          <Button type="button" variant="ghost" size="icon" className="shrink-0 mt-0.5" onClick={goBack} aria-label="Back to Seasonal Credits">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Create Credit Campaign</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure credits, targeting, and optional tenant notification content. You can distribute after creation.
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-16">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6 sm:p-8">
          <CreateCampaignForm onSuccess={goBack} onCancel={goBack} />
        </div>
      </main>
    </div>
  );
}
