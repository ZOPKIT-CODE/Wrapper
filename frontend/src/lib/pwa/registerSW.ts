// SERVICE WORKER REMOVED.
//
// We no longer cache the app shell. Freshness comes from CloudFront (index.html
// is served no-cache + invalidated on every deploy) and the /api/version banner
// (UpdateAvailableBanner) which prompts a reload when a new build is detected.
//
// Migration of EXISTING installs is handled by the self-destroying `sw.js`
// (vite.config.ts → VitePWA selfDestroying). A browser that still has the old
// SW registered re-fetches `/sw.js` on its own update schedule, gets the
// self-destroying worker, unregisters + clears caches, and reloads — no app code
// required. So this module must NOT call `register()` (re-installing the
// self-destroying worker would loop). It only:
//   • exposes a cache-busting reload for the banner, and
//   • best-effort unregisters any lingering SW + purges caches (safety net for
//     clients whose sw.js fetch failed / for tidying up after migration).

/** Cache-busting full reload — defeats the HTTP cache + any intermediate proxy. */
export async function updateSW(reloadPage = false): Promise<void> {
  if (!reloadPage) return;
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('_v', Date.now().toString(36));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}

/** Unregister any previously-installed service worker and delete its caches.
 *  Does NOT register a worker — there is none anymore. */
export function initSW(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      if (typeof caches !== 'undefined') {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // Best-effort; ignore (private mode, blocked SW, etc.).
    }
  });
}
