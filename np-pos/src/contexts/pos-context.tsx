import { useUser } from "@/contexts/user-context";
import { callPost } from "@/lib/frappe-service";
import React, { createContext, useContext, useEffect, useState } from "react";

interface POSContextType {
  sessionDefaults: any[] | null;
  posOpeningEntry: any | null;
  isLoadingMetadata: boolean;
  hasCachedData: boolean;
  refreshPOSMetadata: () => Promise<void>;
}

const STORAGE_KEY_SESSION = "np-pos:sessionDefaults";
const STORAGE_KEY_OPENING = "np-pos:posOpeningEntry";

/**
 * Load cached data from sessionStorage so a remount (navigation away and back)
 * restores instantly without showing loading spinners.
 */
function loadCached<T>(key: string): T | null {
  try {
    const stored = sessionStorage.getItem(key);
    if (stored !== null) {
      return JSON.parse(stored) as T;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function saveCache(key: string, value: any) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore quota errors
  }
}

const POSContext = createContext<POSContextType>({
  sessionDefaults: null,
  posOpeningEntry: null,
  isLoadingMetadata: true,
  hasCachedData: false,
  refreshPOSMetadata: async () => {},
});

export const usePOS = () => useContext(POSContext);

export function POSProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();

  // Initialize from cache if available to avoid loading flash on remount
  const [sessionDefaults, setSessionDefaults] = useState<any[] | null>(
    () => loadCached<any[]>(STORAGE_KEY_SESSION) ?? null,
  );
  const [posOpeningEntry, setPosOpeningEntry] = useState<any | null>(
    () => loadCached<any>(STORAGE_KEY_OPENING) ?? null,
  );
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(
    () => !loadCached(STORAGE_KEY_OPENING),
  );

  const hasCachedData =
    loadCached(STORAGE_KEY_OPENING) !== null ||
    loadCached(STORAGE_KEY_SESSION) !== null;

  const { post: fetchDefaults } = callPost(
    "frappe.core.doctype.session_default_settings.session_default_settings.get_session_default_values",
  );
  const { post: checkOpening } = callPost(
    "erpnext.selling.page.point_of_sale.point_of_sale.check_opening_entry",
  );

  const loadPOSMetadata = async () => {
    if (!user?.name) {
      setIsLoadingMetadata(false);
      return;
    }

    try {
      setIsLoadingMetadata(true);

      const defaultsResponse = await fetchDefaults({});
      if (defaultsResponse && (defaultsResponse as any).message) {
        const parsed = JSON.parse((defaultsResponse as any).message);
        setSessionDefaults(parsed);
        saveCache(STORAGE_KEY_SESSION, parsed);
      }

      const openingResponse = await checkOpening({ user: user.name });
      if (openingResponse && (openingResponse as any).message) {
        setPosOpeningEntry((openingResponse as any).message);
        saveCache(STORAGE_KEY_OPENING, (openingResponse as any).message);
      } else {
        setPosOpeningEntry([]);
        saveCache(STORAGE_KEY_OPENING, []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingMetadata(false);
    }
  };

  // Silently refresh in background on mount, no full loading state display
  useEffect(() => {
    if (user?.name) {
      // If we have cached data, do a silent background refresh
      if (hasCachedData) {
        loadPOSMetadata();
      } else {
        // First load - show loading
        loadPOSMetadata();
      }
    } else {
      setIsLoadingMetadata(false);
    }
  }, [user?.name]);

  return (
    <POSContext.Provider
      value={{
        sessionDefaults,
        posOpeningEntry,
        isLoadingMetadata,
        hasCachedData,
        refreshPOSMetadata: loadPOSMetadata,
      }}
    >
      {children}
    </POSContext.Provider>
  );
}