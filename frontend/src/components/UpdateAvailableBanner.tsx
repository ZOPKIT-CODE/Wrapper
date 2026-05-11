import { useState, useCallback } from 'react';
import { useVersionCheck } from '@/hooks/useVersionCheck';
import { updateSW } from '@/lib/pwa/registerSW';

const DISMISS_KEY = 'update_banner_dismissed_until';

export function UpdateAvailableBanner() {
  const [show, setShow] = useState(false);
  const [forced, setForced] = useState(false);

  const handleUpdateAvailable = useCallback((isForced: boolean) => {
    if (!isForced) {
      const until = Number(localStorage.getItem(DISMISS_KEY) || '0');
      if (Date.now() < until) return;
    }
    setShow(true);
    setForced(isForced);
  }, []);

  useVersionCheck(handleUpdateAvailable);

  if (!show) return null;

  const handleReload = () => {
    updateSW(true).catch(() => window.location.reload());
  };

  const handleDismiss = () => {
    if (forced) return;
    localStorage.setItem(DISMISS_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    setShow(false);
  };

  return (
    <div
      role="alert"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3 shadow-lg"
    >
      <span className="text-sm font-medium">
        {forced
          ? 'A required update is available. Please reload to continue.'
          : 'A new version of Zopkit is available.'}
      </span>
      <button
        onClick={handleReload}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
      >
        Reload now
      </button>
      {!forced && (
        <button
          onClick={handleDismiss}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Later
        </button>
      )}
    </div>
  );
}
