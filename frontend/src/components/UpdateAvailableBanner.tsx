import { useState, useCallback, useEffect, useRef } from 'react';
import { useVersionCheck } from '@/hooks/useVersionCheck';
import { updateSW } from '@/lib/pwa/registerSW';
import { announceReloaded } from '@/lib/pwa/crossTabSync';

// We intentionally do NOT import `useLocation` from @tanstack/react-router here.
// The banner is mounted in `AppRoot.tsx` OUTSIDE the `<RouterProvider>`, so the
// router context is null at this depth and `useLocation()` crashes with
// `Cannot read properties of null (reading 'isServer')`. Instead we subscribe
// to the browser's own navigation events. TanStack Router uses
// `history.pushState`/`replaceState` under the hood, so patching those (plus
// the native `popstate`) covers every navigation source.
function useCurrentPathname(): string {
  const [pathname, setPathname] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/',
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => setPathname(window.location.pathname);

    window.addEventListener('popstate', update);

    const origPush = window.history.pushState;
    const origReplace = window.history.replaceState;
    window.history.pushState = function (...args: Parameters<typeof window.history.pushState>) {
      origPush.apply(this, args);
      update();
    };
    window.history.replaceState = function (...args: Parameters<typeof window.history.replaceState>) {
      origReplace.apply(this, args);
      update();
    };

    return () => {
      window.removeEventListener('popstate', update);
      window.history.pushState = origPush;
      window.history.replaceState = origReplace;
    };
  }, []);

  return pathname;
}

// Soft-dismiss ("Later") suppresses the banner for 24h.
const DISMISS_KEY = 'update_banner_dismissed_until';

// "Reload now" suppresses the banner for the SHA that was being targeted, so
// that if the reload fails to actually swap bundles (CDN cache, intermediate
// proxy, SW skipped) the user does not see the banner immediately reappear and
// loop on the same version. Cleared once __APP_VERSION__ catches up.
const ATTEMPTED_VERSION_KEY = 'update_banner_attempted_version';
const ATTEMPTED_VERSION_EXPIRY_KEY = 'update_banner_attempted_version_expiry';
// 30 minutes — long enough for caches to clear, short enough that a *real*
// new deployment within the window still surfaces a banner.
const ATTEMPTED_VERSION_TTL_MS = 30 * 60 * 1000;

// Hard timeout on the SW handshake. If `updateSW` hasn't navigated us away by
// this point we fall back to a forced reload so the user is never stranded.
const RELOAD_FALLBACK_MS = 4_000;

// Forced updates auto-reload after this many seconds so the user is never
// blocked on a required security patch even if they don't interact.
const FORCED_COUNTDOWN_S = 10;

/**
 * Read the most-recently-polled remote version from the meta tag we get back
 * from `/api/version`. Stored on `window` by `useVersionCheck` so the banner
 * can record exactly which SHA the reload was meant to install.
 */
function readPolledVersion(): string | null {
  const w = window as Window & { __ZK_POLLED_VERSION__?: string };
  return w.__ZK_POLLED_VERSION__ ?? null;
}

export function UpdateAvailableBanner() {
  const pathname = useCurrentPathname();
  const [show, setShow] = useState(false);
  const [forced, setForced] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  // Countdown seconds remaining for forced auto-reload. null = not running.
  const [countdown, setCountdown] = useState<number | null>(null);
  // Guards against double-click / keyboard re-fire starting two parallel SW handshakes.
  const reloadInFlight = useRef(false);
  const countdownIntervalRef = useRef<ReturnType<typeof window.setInterval> | null>(null);

  /**
   * Cache-busting reload. Appending a one-shot query string defeats both the
   * HTTP cache and any intermediate proxy that ignored `cache: 'no-store'`.
   */
  const hardReload = useCallback(() => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('_v', Date.now().toString(36));
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  }, []);

  const handleReload = useCallback(() => {
    if (reloadInFlight.current) return;
    reloadInFlight.current = true;

    // Cancel any running countdown so it doesn't fire a second reload.
    if (countdownIntervalRef.current !== null) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    // 1. Immediate visual feedback.
    setIsReloading(true);

    // 2. Record the attempted version so we don't loop if the reload fails to
    //    actually swap bundles. Cleared automatically by `useVersionCheck` once
    //    the local bundle SHA catches up to the targeted SHA.
    const polled = readPolledVersion();
    if (polled) {
      localStorage.setItem(ATTEMPTED_VERSION_KEY, polled);
      localStorage.setItem(
        ATTEMPTED_VERSION_EXPIRY_KEY,
        String(Date.now() + ATTEMPTED_VERSION_TTL_MS),
      );
      // Notify other open tabs so they can schedule their own reload rather
      // than silently drifting on the old bundle.
      announceReloaded(polled);
    }

    // 3. Hard fallback: if `updateSW` hangs (SW unresponsive, tab backgrounded
    //    mid-handshake), force a cache-busting reload after the timeout.
    const fallbackTimer = window.setTimeout(() => {
      hardReload();
    }, RELOAD_FALLBACK_MS);

    updateSW(true)
      .catch(() => {
        window.clearTimeout(fallbackTimer);
        hardReload();
      });
  }, [hardReload]);

  // Auto-reload countdown for forced (required) updates. Starts a 10-second
  // timer the moment the forced banner appears. The user can hit "Reload now"
  // to skip the wait; if they ignore it, we reload automatically so a required
  // security patch is never indefinitely blocked.
  useEffect(() => {
    if (!show || !forced || isReloading) return;

    setCountdown(FORCED_COUNTDOWN_S);
    countdownIntervalRef.current = window.setInterval(() => {
      setCountdown(prev => {
        if (prev === null) return null;
        // Return 0 as a terminal signal; the separate effect below fires the reload.
        return prev <= 1 ? 0 : prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownIntervalRef.current !== null) {
        window.clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [show, forced, isReloading]);

  // Trigger reload when the countdown drains to zero.
  useEffect(() => {
    if (countdown === 0) handleReload();
  }, [countdown, handleReload]);

  const handleUpdateAvailable = useCallback((isForced: boolean) => {
    // Suppress if user soft-dismissed within the last 24h (not allowed for forced updates).
    if (!isForced) {
      const until = Number(localStorage.getItem(DISMISS_KEY) || '0');
      if (Date.now() < until) return;
    }

    // Suppress if the user already attempted a reload for THIS exact remote
    // version and we haven't moved past it yet. Prevents the "reload doesn't
    // help, banner instantly reappears" loop.
    const attempted = localStorage.getItem(ATTEMPTED_VERSION_KEY);
    const attemptedExpiry = Number(localStorage.getItem(ATTEMPTED_VERSION_EXPIRY_KEY) || '0');
    const polled = readPolledVersion();
    if (
      attempted &&
      polled &&
      attempted === polled &&
      Date.now() < attemptedExpiry
    ) {
      return;
    }

    setShow(true);
    setForced(isForced);
  }, []);

  useVersionCheck(handleUpdateAvailable);

  // Don't interrupt mid-onboarding with a reload prompt.
  if (!show || pathname.startsWith('/onboarding')) return null;

  const handleDismiss = () => {
    if (forced) return;
    localStorage.setItem(DISMISS_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    setShow(false);
  };

  const bannerText = isReloading
    ? 'Reloading to apply update…'
    : forced
      ? countdown !== null && countdown > 0
        ? `A required update is available. Reloading in ${countdown}s…`
        : 'A required update is available. Please reload to continue.'
      : 'A new version of Zopkit is available.';

  return (
    <div
      role="alert"
      aria-live="polite"
      aria-label="Update available — reload to apply"
      className={[
        // Position: full-width on mobile, centered pill on sm+.
        // bottom uses safe-area-inset-bottom so the banner clears iOS home
        // indicators, Android gesture bars, and the macOS Dock in browser windows.
        'fixed left-4 right-4',
        'bottom-[calc(1rem_+_env(safe-area-inset-bottom,_0px))]',
        'sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:max-w-md',
        // Stack above sticky headers, modals, and NetworkQualityBanner (z-[110]).
        'z-[120]',
        // Layout: always a row so the banner stays compact on mobile too.
        'flex flex-row flex-wrap items-center gap-2 sm:gap-3',
        // Shape + elevation.
        'rounded-xl border border-border',
        // Dark theme: stronger border + slightly lighter surface so text pops.
        'dark:border-white/25 dark:bg-neutral-800',
        // Background: slightly frosted; falls back to near-opaque for browsers
        // without backdrop-filter support.
        'bg-background/95 backdrop-blur-sm',
        'supports-[backdrop-filter]:bg-background/80',
        'px-4 py-3',
        'shadow-xl shadow-black/20',
      ].join(' ')}
    >
      <span className="text-sm font-medium text-foreground flex-1 min-w-0">
        {bannerText}
      </span>
      <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
        <button
          onClick={handleReload}
          disabled={isReloading}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isReloading ? 'Reloading…' : 'Reload now'}
        </button>
        {!forced && !isReloading && (
          <button
            onClick={handleDismiss}
            className="text-sm text-muted-foreground hover:text-foreground px-2 py-1.5"
          >
            Later
          </button>
        )}
      </div>
    </div>
  );
}
