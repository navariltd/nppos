import { useUser } from "@/contexts/user-context";
import { callGet, callPost } from "@/lib/frappe-service";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

interface POSContextType {
  sessionDefaults: any[] | null;
  posOpeningEntry: any | null;
  posProfile: any | null;
  warehouse: string | null;
  isLoadingMetadata: boolean;
  hasCachedData: boolean;
  refreshPOSMetadata: () => Promise<void>;
}

const STORAGE_KEY_SESSION = "np-pos:sessionDefaults";
const STORAGE_KEY_OPENING = "np-pos:posOpeningEntry";
const STORAGE_KEY_PROFILE = "np-pos:posProfile";

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
  posProfile: null,
  warehouse: null,
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
  const [posProfile, setPosProfile] = useState<any | null>(
    () => loadCached<any>(STORAGE_KEY_PROFILE) ?? null,
  );
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(
    () => !loadCached(STORAGE_KEY_OPENING),
  );
  const [profileName, setProfileName] = useState<string | null>(null);

  const hasCachedData =
    loadCached(STORAGE_KEY_OPENING) !== null ||
    loadCached(STORAGE_KEY_SESSION) !== null;

  const { post: fetchDefaults } = callPost(
    "frappe.core.doctype.session_default_settings.session_default_settings.get_session_default_values",
  );
  const { post: checkOpening } = callPost(
    "erpnext.selling.page.point_of_sale.point_of_sale.check_opening_entry",
  );

  // Reactive hook: fetch POS Profile when profileName changes (from opening entry)
  const { data: profileData } = callGet(
    profileName ? "frappe.client.get" : null,
    profileName
      ? { doctype: "POS Profile", name: profileName }
      : {},
    profileName ? `pos-profile-${profileName}` : undefined as string | undefined,
  );

  // Sync the fetched profile into state + cache
  useEffect(() => {
    if (profileData?.message) {
      setPosProfile(profileData.message);
      saveCache(STORAGE_KEY_PROFILE, profileData.message);
    }
  }, [profileData]);

  const warehouse = useMemo(() => {
    // First try from posProfile
    if (posProfile?.warehouse) return posProfile.warehouse;
    // Fallback to sessionDefaults
    const fromDefaults = sessionDefaults?.find((s: any) => s?.key === "warehouse")?.value;
    if (fromDefaults) return fromDefaults;
    return null;
  }, [posProfile, sessionDefaults]);

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
        const opening = (openingResponse as any).message;
        setPosOpeningEntry(opening);
        saveCache(STORAGE_KEY_OPENING, opening);

        // Extract pos_profile name — the hook will fetch the full doc
        const name = opening?.[0]?.pos_profile || opening?.pos_profile;
        if (name) {
          setProfileName(name);
        }
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
      if (hasCachedData) {
        loadPOSMetadata();
      } else {
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
        posProfile,
        warehouse,
        isLoadingMetadata,
        hasCachedData,
        refreshPOSMetadata: loadPOSMetadata,
      }}
    >
      {children}
    </POSContext.Provider>
  );
}