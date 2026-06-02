import React from "react"
import { createRoot } from "react-dom/client"
import "@/index.css"
import { initSW } from "./lib/pwa/registerSW"
initSW()

// ── Stale chunk recovery ──────────────────────────────────────────────────
// After a deploy, rsync --delete removes old content-hashed chunks.
// A user who has the app open will get a 404 when lazy-loading a new route.
// We detect this and do ONE automatic reload to pick up the new index.html.
// sessionStorage prevents an infinite reload loop if the chunk is genuinely missing.
const CHUNK_RELOAD_KEY = "chunk_reload_attempted"

function handleChunkError() {
  if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return;
  sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
  // A chunk 404 means the user has a stale index.html referencing a hashed
  // chunk that no longer exists after the latest deploy. A plain reload() can
  // re-serve the same cached index.html through aggressive CDN/proxy layers.
  // Appending a one-shot _v param defeats every cache tier.
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("_v", Date.now().toString(36));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}

window.addEventListener("error", (event) => {
  const msg = event.message ?? ""
  if (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Unable to preload CSS for") ||
    msg.includes("error loading dynamically imported module")
  ) {
    handleChunkError()
  }
})

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason
  const msg: string = reason?.message ?? ""
  if (
    reason?.name === "ChunkLoadError" ||
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Unable to preload CSS for") ||
    msg.includes("error loading dynamically imported module")
  ) {
    event.preventDefault()
    handleChunkError()
  }
})
// ─────────────────────────────────────────────────────────────────────────

const startupStorageResetEnabled = import.meta.env.VITE_RESET_AUTH_STORAGE_ON_BOOT === "true"

if (startupStorageResetEnabled) {
  const explicitSensitiveKeys = new Set([
    "kinde_backup_token",
    "idp_token",
    "idp_refresh_token",
    "authToken",
    "auth_token",
  ])

  const shouldRemoveKey = (key: string) => {
    if (explicitSensitiveKeys.has(key)) return true
    if (/^refreshToken\d+$/i.test(key)) return true
    if (/(access.?token|refresh.?token|id.?token)/i.test(key)) {
      return true
    }
    return false
  }

  const clearStorage = (storage: Storage) => {
    for (let i = storage.length - 1; i >= 0; i -= 1) {
      const key = storage.key(i)
      if (!key) continue
      if (shouldRemoveKey(key)) {
        storage.removeItem(key)
      }
    }
  }

  const clearSensitiveStartupData = () => {
    try {
      clearStorage(localStorage)
      clearStorage(sessionStorage)
    } catch {
      // Ignore storage access failures in restricted browser modes.
    }
  }

  clearSensitiveStartupData()
}

const bootstrap = async () => {
  const { AppRoot } = await import("./AppRoot")
  const rootEl = document.getElementById("root")

  if (!rootEl) {
    document.body.innerHTML = '<div style="padding:2rem;font-family:system-ui;background:#f9fafb;color:#111">Root element #root not found.</div>'
    return
  }

  createRoot(rootEl).render(
    <React.StrictMode>
      <AppRoot />
    </React.StrictMode>
  )
}

// Suppress browser extension warnings for video elements
const originalWarn = console.warn;
console.warn = function (...args) {
  if (args[0] && typeof args[0] === 'string' && args[0].includes('Video element not found')) {
    return;
  }
  originalWarn.apply(console, args);
};
bootstrap()
