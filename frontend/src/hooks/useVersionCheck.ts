import { useEffect } from 'react';
import { setUpdateAvailableHandler } from '@/lib/pwa/registerSW';
import { onPeerReloaded } from '@/lib/pwa/crossTabSync';

const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Keys owned by `UpdateAvailableBanner` — re-declared here so we can clean them
// up the moment we detect the local bundle has caught up to the targeted SHA.
// Kept in sync with the banner: this is a small, well-bounded coupling and
// avoids a circular import.
const ATTEMPTED_VERSION_KEY = 'update_banner_attempted_version';
const ATTEMPTED_VERSION_EXPIRY_KEY = 'update_banner_attempted_version_expiry';

declare global {
  interface Window {
    /**
     * Most recent build SHA returned by `/api/version`. Read by
     * `UpdateAvailableBanner` so it can record exactly which version a
     * "Reload now" click was targeting.
     */
    __ZK_POLLED_VERSION__?: string;
  }
}

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

        // Expose the latest polled version for the banner to read. Used to
        // record which SHA the user attempted to reload to, so we can suppress
        // the banner if the reload fails to actually swap bundles.
        if (version) {
          window.__ZK_POLLED_VERSION__ = version;
        }

        // ATTEMPTED_VERSION lifecycle:
        //
        // Written by: UpdateAvailableBanner.handleReload() — records the remote SHA the
        //   user clicked "Reload now" for, paired with a 30-minute expiry timestamp.
        //
        // Read by: UpdateAvailableBanner.handleUpdateAvailable() — if the polled remote
        //   SHA matches the attempted SHA and the expiry hasn't passed, the banner stays
        //   hidden. This prevents the "reload doesn't help, banner instantly reappears"
        //   loop that occurs when caches (CDN, proxy, SW) serve the old bundle.
        //
        // Cleared here: once __APP_VERSION__ (the running bundle SHA) equals the attempted
        //   SHA, the reload succeeded and suppression is no longer needed.
        //
        // TTL expiry (30 min): if the reload genuinely failed and the user stays on the old
        //   bundle for more than 30 minutes, the banner reappears on the next mismatch poll.
        //   This is intentional — surface the update again rather than suppressing forever.
        //
        // Race window: the polling interval (5 min) is shorter than the TTL (30 min), so a
        //   successful reload will always be detected within one poll cycle before the TTL
        //   expires. The clear path: reload → new bundle loads → __APP_VERSION__ updates →
        //   next poll finds attempted === current → removes both keys.
        const attempted = localStorage.getItem(ATTEMPTED_VERSION_KEY);
        if (attempted && attempted === current) {
          localStorage.removeItem(ATTEMPTED_VERSION_KEY);
          localStorage.removeItem(ATTEMPTED_VERSION_EXPIRY_KEY);
        }

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

    // Cross-tab sync: when another tab reloads for a newer version, schedule a
    // gentle notification in THIS tab after a short delay. This lets users finish
    // whatever they were doing (filling a form, reading an article) rather than
    // being immediately interrupted. If the announced version already matches what
    // we're running, we're up to date and no action is needed.
    const unsubPeer = onPeerReloaded((peerVersion) => {
      if (cancelled) return;
      const current = __APP_VERSION__;
      if (peerVersion === current) return; // Already on the new version.
      // Give the user 8 seconds to finish what they were doing before the banner
      // appears. The banner itself is non-blocking (has a "Later" button).
      window.setTimeout(() => {
        if (!cancelled) onUpdateAvailable(false);
      }, 8_000);
    });

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', visHandler);
      window.clearInterval(id);
      unsubPeer();
    };
  }, [onUpdateAvailable]);
}
