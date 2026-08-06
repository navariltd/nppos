/**
 * Service worker registration for NPPOS PWA/offline support.
 *
 * Registers the service worker at the site root (/sw.js). A service worker's
 * scope is always a sub-path of its own URL, so serving it from the root gives
 * it control over /nppos and everything beneath it — this is what makes the
 * app shell load entirely from cache while offline.
 *
 * IMPORTANT: Service workers are only available in SECURE CONTEXTS (HTTPS, or
 * http://localhost). When served over plain HTTP (e.g. over a LAN IP), the
 * browser does not expose `navigator.serviceWorker`. We skip registration
 * silently in that case — the app continues to work normally via Dexie (offline
 * data is fully functional regardless of the service worker).
 *
 * In production Frappe serves nppos/www/sw.js at /sw.js; in dev Vite serves
 * public/sw.js at /sw.js. Both are identical and use the root scope.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RegisterSWOptions = {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onOfflineReady?: () => void;
  onRegisteredSW?: (
    swUrl: string,
    registration: ServiceWorkerRegistration | undefined,
  ) => void;
};

/**
 * Register the root-scoped service worker, updating the cached app shell when
 * a new version is installed. No-op in insecure contexts or when the browser
 * lacks service worker support.
 *
 * @param options - callbacks for refresh/offline-ready/registration events
 * @returns {void}
 */
export function registerSW(options: RegisterSWOptions = {}): void {
  if (!window.isSecureContext) return; // SW requires HTTPS or localhost
  if (!("serviceWorker" in navigator)) return;

  const swUrl = "/sw.js";

  const register = () => {
    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        options.onRegisteredSW?.(swUrl, registration);

        if (import.meta.env.DEV) return;

        // Reload the page when a new worker takes control, and surface a
        // "refresh available" prompt while one is waiting to activate.
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          let refreshing = false;
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
          });

          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              options.onNeedRefresh?.();
            }
          });
        });

        if (registration.waiting && navigator.serviceWorker.controller) {
          options.onNeedRefresh?.();
        }
      })
      .catch((error) => {
        console.warn(
          "PWA: service worker registration skipped:",
          error instanceof Error ? error.message : error,
        );
      });
  };

  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register, { once: true });
  }
}