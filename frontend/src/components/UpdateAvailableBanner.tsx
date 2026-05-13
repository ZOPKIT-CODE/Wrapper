import { useState, useCallback, useEffect, useRef } from 'react';
import { useVersionCheck } from '@/hooks/useVersionCheck';
import { updateSW } from '@/lib/pwa/registerSW';

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
  // Track the click so re-entrant handlers (double-click, keyboard re-fire)
  // can't kick off two parallel SW handshakes.
  const reloadInFlight = useRef(false);

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

  const handleReload = () => {
    if (reloadInFlight.current) return;
    reloadInFlight.current = true;

    // 1. Immediate visual feedback. Don't leave the banner sitting there while
    //    the SW handshake runs — that's what makes it look "stuck".
    setIsReloading(true);

    // 2. Record the attempted version so we don't loop if the reload fails to
    //    actually swap bundles (CDN cache, proxy cache, SW skipped). This is
    //    cleared automatically by `useVersionCheck` once we detect that the
    //    local bundle has caught up to the targeted SHA.
    const polled = readPolledVersion();
    if (polled) {
      localStorage.setItem(ATTEMPTED_VERSION_KEY, polled);
      localStorage.setItem(
        ATTEMPTED_VERSION_EXPIRY_KEY,
        String(Date.now() + ATTEMPTED_VERSION_TTL_MS),
      );
    }

    // 3. Hard fallback: if `updateSW` is hung (SW unresponsive, browser tab
    //    backgrounded mid-handshake), force a cache-busting reload after the
    //    timeout so the user is never stuck on a frozen banner.
    const fallbackTimer = window.setTimeout(() => {
      hardReload();
    }, RELOAD_FALLBACK_MS);

    updateSW(true)
      .catch(() => {
        // SW path failed — fall through to a hard reload immediately.
        window.clearTimeout(fallbackTimer);
        hardReload();
      });
  };

  /**
   * Cache-busting reload. Appending a one-shot query string defeats both the
   * HTTP cache and any intermediate proxy that ignored `cache: 'no-store'`.
   */
  const hardReload = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('_v', Date.now().toString(36));
      window.location.replace(url.toString());
    } catch {
      window.location.reload();
    }
  };

  const handleDismiss = () => {
    if (forced) return;
    localStorage.setItem(DISMISS_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    setShow(false);
  };

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:max-w-md z-50 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 rounded-lg border border-border bg-background px-4 py-3 shadow-lg"
    >
      <span className="text-sm font-medium flex-1">
        {isReloading
          ? 'Reloading to apply update…'
          : forced
          ? 'A required update is available. Please reload to continue.'
          : 'A new version of Zopkit is available.'}
      </span>
      <div className="flex items-center justify-end gap-2 sm:gap-3 shrink-0">
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
            className="text-sm text-muted-foreground hover:text-foreground px-2 py-1"
          >
            Later
          </button>
        )}
      </div>
    </div>
  );
}
