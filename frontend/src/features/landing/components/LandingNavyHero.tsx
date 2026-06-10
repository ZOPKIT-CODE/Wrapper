import { Suspense, lazy } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

const OrbitalEcosystem = lazy(() =>
  import('@/features/landing/components/OrbitalEcosystem').then((m) => ({
    default: m.OrbitalEcosystem,
  }))
);

type LandingNavyHeroProps = {
  onBookDemo?: () => void;
};

export function LandingNavyHero({ onBookDemo }: LandingNavyHeroProps) {
  const navigate = useNavigate();

  return (
    <section
      className="relative text-white overflow-hidden"
      style={{ background: 'var(--zk-blue-900)' }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.35]"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 pb-16 sm:pb-20 lg:pb-24">
        <div className="grid lg:grid-cols-2 gap-14 lg:gap-12 items-center">
          <div className="max-w-lg landing-fade-in">
            <h1 className="landing-display text-[2.35rem] sm:text-5xl lg:text-[3.25rem] font-semibold leading-[1.05] text-balance text-white">
              One control plane for CRM, finance, HR, and ops
            </h1>
            <p className="mt-5 text-base sm:text-lg leading-relaxed text-white/70 max-w-[38ch] landing-fade-in landing-fade-in-delay-1">
              Zopkit connects your departments on shared records, permissions, and billing. Less re-entry. Fewer tools.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4 landing-fade-in landing-fade-in-delay-2">
              <Button
                size="lg"
                onClick={onBookDemo}
                className="rounded-sm h-11 px-7 text-sm font-semibold bg-white text-[var(--zk-blue-900)] hover:bg-white/90 shadow-none"
              >
                Book a demo
              </Button>
              <button
                type="button"
                onClick={() => navigate({ to: '/pricing' })}
                className="text-sm font-medium text-white/75 hover:text-white transition-colors cursor-pointer underline-offset-4 hover:underline"
              >
                See pricing
              </button>
            </div>
          </div>

          <div className="relative min-h-[300px] sm:min-h-[360px] lg:min-h-[400px] landing-fade-in landing-fade-in-delay-2">
            <Suspense
              fallback={
                <div className="w-full h-full min-h-[300px] rounded-sm bg-white/5 animate-pulse" />
              }
            >
              <OrbitalEcosystem
                variant="hero"
                theme="dark"
                autoRotate
                showMobileStrip
                layout="stack"
                motionClassName="w-full"
              />
            </Suspense>
          </div>
        </div>
      </div>
    </section>
  );
}
