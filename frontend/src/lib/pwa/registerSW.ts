let onUpdateAvailable: (() => void) | null = null;
let _registration: ServiceWorkerRegistration | undefined;

export function setUpdateAvailableHandler(cb: () => void) {
  onUpdateAvailable = cb;
}

export async function updateSW(reloadPage = false): Promise<void> {
  if (_registration) {
    try { await _registration.update(); } catch { /* offline — reload will still happen */ }
  }
  if (_registration?.waiting) {
    _registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    await new Promise<void>((resolve) => {
      const t = setTimeout(resolve, 1500);
      navigator.serviceWorker.addEventListener(
        'controllerchange',
        () => { clearTimeout(t); resolve(); },
        { once: true },
      );
    });
  }
  if (reloadPage) window.location.reload();
}

function trackUpdateReady(reg: ServiceWorkerRegistration) {
  const worker = reg.installing ?? reg.waiting;
  if (!worker) return;

  worker.addEventListener('statechange', () => {
    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
      // New SW installed and waiting — old SW still controlling the page.
      onUpdateAvailable?.();
    }
  });
}

export function initSW(): void {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      _registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

      // Catch update events triggered on this page load.
      _registration.addEventListener('updatefound', () => {
        if (_registration) trackUpdateReady(_registration);
      });

      // Also fire if a waiting SW was already present when we registered
      // (e.g. user navigated back to an old tab).
      if (_registration.waiting && navigator.serviceWorker.controller) {
        onUpdateAvailable?.();
      }

      // Periodically tell the browser to re-fetch sw.js and check for updates.
      setInterval(() => _registration?.update(), 60 * 60 * 1000);
    } catch {
      // Fails silently in dev (no HTTPS) or when SW is blocked.
    }
  });
}
