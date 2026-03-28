// banner-test-v2
import { useEffect, useState, useRef, useCallback } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

const CHECK_INTERVAL = 60 * 1000; // 60 seconds
const DISMISS_STORAGE_KEY = 'newVersionBannerDismissed';

/**
 * Detects new deployments by comparing the build hash in the current page's
 * <meta name="app-version"> tag against a fresh fetch of /index.html.
 * Zero backend API calls, zero service worker complexity.
 */
export function NewVersionBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Read the build hash baked into the currently loaded page
  const currentVersion = useRef(
    document.querySelector<HTMLMetaElement>('meta[name="app-version"]')?.content ?? ''
  );

  const checkForUpdate = useCallback(async () => {
    // Skip if tab is hidden or already dismissed this session
    if (document.hidden) return;
    if (sessionStorage.getItem(DISMISS_STORAGE_KEY)) return;
    if (!currentVersion.current) return; // no meta tag in dev mode

    try {
      const res = await fetch('/index.html', { cache: 'no-store' });
      const html = await res.text();
      const match = html.match(/<meta\s+name="app-version"\s+content="([^"]+)"/);
      const remoteVersion = match?.[1] ?? '';

      if (remoteVersion && remoteVersion !== currentVersion.current) {
        setShowBanner(true);
      }
    } catch {
      // Silently fail — network error or offline
    }
  }, []);

  useEffect(() => {
    // First check after 10 seconds
    const timeout = setTimeout(checkForUpdate, 10_000);
    // Then every 60 seconds
    intervalRef.current = setInterval(checkForUpdate, CHECK_INTERVAL);
    // Also check when tab regains focus
    const onFocus = () => { checkForUpdate(); };
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [checkForUpdate]);

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleDismiss = () => {
    setShowBanner(false);
    sessionStorage.setItem(DISMISS_STORAGE_KEY, Date.now().toString());
  };

  if (!showBanner) return null;

  return (
    <Alert
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[40] rounded-none border-b shadow-sm bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
    >
      <div className="container mx-auto px-4 py-2 flex items-center justify-between gap-4">
        <AlertDescription className="flex-1 text-sm text-blue-900 dark:text-blue-100 m-0">
          <span className="font-medium">A new version is available.</span>
          {' '}Click Update to get the latest features.
        </AlertDescription>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleRefresh}
            size="sm"
            className="bg-[#1B2E5A] hover:bg-[#152449] text-white"
          >
            Update now
          </Button>
          <Button
            onClick={handleDismiss}
            size="sm"
            variant="ghost"
            className="text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Alert>
  );
}
