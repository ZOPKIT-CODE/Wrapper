/**
 * BroadcastChannel-based cross-tab synchronization for version updates.
 *
 * When one tab reloads to apply a new deploy, it announces the version it
 * reloaded to. Other tabs that are still running the old bundle receive the
 * message and can prompt (or schedule) their own reload, preventing stale-UI
 * and API-shape mismatches without requiring the user to visit every tab.
 *
 * BroadcastChannel is supported in all modern browsers. The functions no-op
 * silently in environments where it's unavailable (old browsers, isolated
 * workers, certain privacy modes).
 */

const CHANNEL_NAME = 'zopkit-version-sync';

export interface VersionSyncMessage {
  type: 'reloaded';
  version: string;
}

/**
 * Called by the tab that is about to reload. Broadcasts to all other open
 * tabs that a particular version is being applied, so they can react.
 */
export function announceReloaded(version: string): void {
  try {
    const ch = new BroadcastChannel(CHANNEL_NAME);
    ch.postMessage({ type: 'reloaded', version } satisfies VersionSyncMessage);
    // Close immediately — we only need a one-shot send.
    ch.close();
  } catch {
    // BroadcastChannel unavailable — fail silently.
  }
}

/**
 * Subscribe to peer-reload announcements. Returns a cleanup function that
 * closes the channel when the subscriber unmounts.
 *
 * @param handler  Called with the announced version when another tab reloads.
 */
export function onPeerReloaded(handler: (version: string) => void): () => void {
  try {
    const ch = new BroadcastChannel(CHANNEL_NAME);
    ch.onmessage = (event: MessageEvent<VersionSyncMessage>) => {
      if (event.data?.type === 'reloaded' && event.data?.version) {
        handler(event.data.version);
      }
    };
    return () => ch.close();
  } catch {
    return () => {};
  }
}
