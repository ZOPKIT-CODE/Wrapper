import { useKindeAuth } from '@kinde-oss/kinde-auth-react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { useAuthStatus } from '@/hooks/useSharedQueries';

const MARKETING_PATHS = ['/', '/landing', '/pricing', '/privacy', '/terms', '/cookies', '/refund-policy', '/security'];
const MARKETING_PREFIXES = ['/products/', '/industries/'];

function isMarketingPath(pathname: string): boolean {
  if (MARKETING_PATHS.includes(pathname)) return true;
  return MARKETING_PREFIXES.some(p => pathname.startsWith(p));
}

/**
 * Shown on marketing pages for authenticated users who haven't completed
 * onboarding. Non-dismissable — they need to act or navigate away.
 * z-[99] keeps it below UpdateAvailableBanner (z-120) and NetworkQualityBanner.
 */
export function OnboardingHintBanner() {
  const { isAuthenticated, user } = useKindeAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: authData } = useAuthStatus();

  if (!isMarketingPath(location.pathname)) return null;
  if (!isAuthenticated || !user) return null;

  const authStatus = authData?.authStatus;
  // Don't render until we know auth status (avoid flash on unauthenticated users)
  if (!authStatus) return null;
  if (!authStatus.isAuthenticated) return null;

  const onboardingCompleted =
    authStatus.onboardingCompleted === true || authStatus.needsOnboarding === false;
  if (onboardingCompleted) return null;

  const firstName = user.givenName || user.email?.split('@')[0] || 'there';

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'fixed left-4 right-4',
        'top-[calc(1rem_+_env(safe-area-inset-top,_0px))]',
        'sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:max-w-lg',
        'z-[99]',
        'flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3',
        'rounded-xl border border-border',
        'dark:border-white/20',
        'bg-background/95 backdrop-blur-sm',
        'supports-[backdrop-filter]:bg-background/80',
        'px-4 py-3',
        'shadow-xl shadow-black/10',
      ].join(' ')}
    >
      <span className="text-sm font-medium flex-1">
        👋 Welcome back, {firstName} — your workspace is one step away.
      </span>
      <div className="flex items-center shrink-0">
        <button
          onClick={() => navigate({ to: '/onboarding' })}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground whitespace-nowrap"
        >
          Complete onboarding →
        </button>
      </div>
    </div>
  );
}
