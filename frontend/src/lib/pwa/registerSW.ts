import { registerSW } from 'virtual:pwa-register';

let onUpdateAvailable: (() => void) | null = null;

export function setUpdateAvailableHandler(cb: () => void) {
  onUpdateAvailable = cb;
}

export const updateSW = registerSW({
  onNeedRefresh() {
    onUpdateAvailable?.();
  },
  onOfflineReady() {
    // No-op; could show a toast when the app is ready to work offline.
  },
  onRegisteredSW(_swUrl: string, r: ServiceWorkerRegistration | undefined) {
    // Re-check for SW updates every 60 minutes while the tab is open.
    // VitePWA in prompt mode only checks on page load by default.
    if (r) setInterval(() => { r.update(); }, 60 * 60 * 1000);
  },
});
