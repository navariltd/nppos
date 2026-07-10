import { useUser } from "@/contexts/user-context";
import { callPost } from "@/lib/frappe-service";
import React, { createContext, useContext, useEffect, useState } from "react";

interface POSContextType {
  sessionDefaults: any[] | null;
  posOpeningEntry: any | null;
  isLoadingMetadata: boolean;
  refreshPOSMetadata: () => Promise<void>;
}

const POSContext = createContext<POSContextType>({
  sessionDefaults: null,
  posOpeningEntry: null,
  isLoadingMetadata: true,
  refreshPOSMetadata: async () => {},
});

export const usePOS = () => useContext(POSContext);

export function POSProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const [sessionDefaults, setSessionDefaults] = useState<any[] | null>(null);
  const [posOpeningEntry, setPosOpeningEntry] = useState<any>(null);
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);

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
      }

      const openingResponse = await checkOpening({ user: user.name });
      if (openingResponse && (openingResponse as any).message) {
        setPosOpeningEntry((openingResponse as any).message);
      } else {
        setPosOpeningEntry([]);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingMetadata(false);
    }
  };

  useEffect(() => {
    loadPOSMetadata();
  }, [user?.name]);

  return (
    <POSContext.Provider
      value={{
        sessionDefaults,
        posOpeningEntry,
        isLoadingMetadata,
        refreshPOSMetadata: loadPOSMetadata,
      }}
    >
      {children}
    </POSContext.Provider>
  );
}
