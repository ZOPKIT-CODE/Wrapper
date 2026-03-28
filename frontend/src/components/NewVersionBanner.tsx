import { useEffect, useState, useRef } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { isVersionNewer } from '@/lib/utils';
import { X } from 'lucide-react';

const VERSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const INITIAL_CHECK_DELAY = 10 * 1000; // 10 seconds after mount
const DISMISS_STORAGE_KEY = 'newVersionBannerDismissed';

export function NewVersionBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [serverVersion, setServerVersion] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const checkAbortControllerRef = useRef<AbortController | null>(null);

  // Get client version from build-time constant
  const clientVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';

  const checkVersion = async () => {
    // Skip check if document is hidden (tab in background)
    if (document.hidden) {
      return;
    }

    // Skip if already dismissed in this session
    if (sessionStorage.getItem(DISMISS_STORAGE_KEY)) {
      return;
    }

    try {
      // Cancel any pending request
      if (checkAbortControllerRef.current) {
        checkAbortControllerRef.current.abort();
      }

      checkAbortControllerRef.current = new AbortController();
      
      const response = await api.get<{ version: string }>('/version', {
        signal: checkAbortControllerRef.current.signal
      });

      const version = response.data?.version;
      if (version) {
        setServerVersion(version);
        
        // Compare versions - show banner if server version is newer
        if (isVersionNewer(version, clientVersion)) {
          setShowBanner(true);
        } else {
          setShowBanner(false);
        }
      }
    } catch (error: any) {
      // Silently fail - don't show banner on error
      // Only log in development
      if (import.meta.env.DEV && error.name !== 'AbortError') {
        console.debug('Version check failed:', error);
      }
      setShowBanner(false);
    } finally {
      checkAbortControllerRef.current = null;
    }
  };

  useEffect(() => {
    // Initial check after delay
    const initialTimeout = setTimeout(() => {
      checkVersion();
    }, INITIAL_CHECK_DELAY);

    // Set up polling interval
    intervalRef.current = setInterval(() => {
      checkVersion();
    }, VERSION_CHECK_INTERVAL);

    // Check when tab becomes visible again
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        checkVersion();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (checkAbortControllerRef.current) {
        checkAbortControllerRef.current.abort();
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []); // Empty deps - only run on mount/unmount

  const handleRefresh = () => {
    // Clear service worker cache to ensure fresh assets
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(r => r.update());
      });
    }
    window.location.reload();
  };

  const handleDismiss = () => {
    setShowBanner(false);
    // Store dismiss flag in sessionStorage (cleared when tab closes)
    sessionStorage.setItem(DISMISS_STORAGE_KEY, Date.now().toString());
  };

  if (!showBanner) {
    return null;
  }

  return (
    <Alert
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-[40] rounded-none border-b shadow-sm bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
    >
      <div className="container mx-auto px-4 py-2 flex items-center justify-between gap-4">
        <AlertDescription className="flex-1 text-sm text-blue-900 dark:text-blue-100 m-0">
          <span className="font-medium">🚀 A new version is available.</span>
          {serverVersion && (
            <span className="ml-2 text-blue-700 dark:text-blue-300">
              (v{serverVersion})
            </span>
          )}
          {' '}Refresh to get the latest features and improvements.
        </AlertDescription>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleRefresh}
            size="sm"
            className="bg-[#1B2E5A] hover:bg-[#152449] text-white"
          >
            Refresh
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
