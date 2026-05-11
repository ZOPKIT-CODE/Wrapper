import { useEffect } from 'react';
import { setUpdateAvailableHandler } from '@/lib/pwa/registerSW';

const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function useVersionCheck(onUpdateAvailable: (forced: boolean) => void) {
  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (!res.ok) return;
        const { version, minRequiredVersion } = await res.json();
        if (cancelled) return;

        const current = __APP_VERSION__;
        if (version && version !== current) {
          // minRequiredVersion is set by the backend for security patches that
          // make older frontends unsafe. If it's set and our SHA doesn't match,
          // the update is forced (user cannot dismiss).
          const forced = !!(minRequiredVersion && minRequiredVersion !== current);
          onUpdateAvailable(forced);
        }
      } catch {
        // Network blip — try again next interval.
      }
    }

    check();

    const visHandler = () => { if (!document.hidden) check(); };
    document.addEventListener('visibilitychange', visHandler);
    const id = window.setInterval(check, POLL_INTERVAL);

    // Also surface SW-detected updates through the same callback.
    setUpdateAvailableHandler(() => onUpdateAvailable(false));

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', visHandler);
      window.clearInterval(id);
    };
  }, [onUpdateAvailable]);
}
