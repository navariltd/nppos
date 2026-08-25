/**
 * Shared cache keys and helpers for the active POS session. The POS context
 * writes/reads these keys and the app header badge reads them; keeping them in
 * one module avoids drift between the writer and readers.
 */

export const POS_PROFILE_CACHE_KEY = "np-pos:posProfile";
export const POS_OPENING_CACHE_KEY = "np-pos:posOpeningEntry";
export const POS_SESSION_CACHE_KEY = "np-pos:sessionDefaults";

/** Name of the window event dispatched whenever the active POS profile changes. */
export const POS_PROFILE_CHANGED_EVENT = "np-pos:profile-changed";

/**
 * Clear the cached active POS session. Used when a session is closed so the
 * header's "open POS profile" badge disappears and the next POS visit starts
 * fresh.
 */
export function clearPOSSession() {
  try {
    sessionStorage.removeItem(POS_PROFILE_CACHE_KEY);
    sessionStorage.removeItem(POS_OPENING_CACHE_KEY);
    sessionStorage.removeItem(POS_SESSION_CACHE_KEY);
  } catch {
    // Ignore storage errors
  }
  window.dispatchEvent(new Event(POS_PROFILE_CHANGED_EVENT));
}
