"use client";

import { useFrappeAuth, useFrappeGetDoc } from "frappe-react-sdk";
import * as React from "react";

interface UserContextValue {
  user: any | null;
  isLoading: boolean;
  isLoggedOut: boolean;
  error: any;
  logout: () => Promise<void>;
}

export const UserContext = React.createContext<UserContextValue | null>(null);

const SESSION_KEY = "nppos_session";

function getStoredSession(): { username: string } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredSession(username: string) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ username }));
  } catch {
    /* localStorage may be unavailable */
  }
}

function clearStoredSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* localStorage may be unavailable */
  }
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, isLoading: authLoading, logout } = useFrappeAuth();
  const storedSession = React.useRef(getStoredSession());

  const [optimisticUser, setOptimisticUser] = React.useState<string | null>(
    storedSession.current?.username || null,
  );

  const [authResolved, setAuthResolved] = React.useState(false);

  React.useEffect(() => {
    // Auth is resolved when loading finishes AND we have a definite answer,
    // even if that answer is undefined/null/Guest (meaning not logged in).
    if (!authLoading) {
      setAuthResolved(true);
      if (currentUser && currentUser !== "Guest") {
        setOptimisticUser(currentUser);
        setStoredSession(currentUser);
      } else {
        setOptimisticUser(null);
        clearStoredSession();
      }
    }
  }, [authLoading, currentUser]);

  const isActuallyGuest = authResolved && !optimisticUser;
  const shouldFetch =
    !!optimisticUser && optimisticUser !== "Guest" && authResolved;

  const {
    data: userData,
    error: userError,
    isValidating: userLoading,
  } = useFrappeGetDoc<any>("User", shouldFetch ? optimisticUser : undefined);

  const [userDataResolved, setUserDataResolved] = React.useState(false);

  React.useEffect(() => {
    if (!shouldFetch) {
      setUserDataResolved(true);
    } else if (userData !== undefined || userError) {
      setUserDataResolved(true);
      if (userError) {
        setOptimisticUser(null);
        clearStoredSession();
      }
    } else {
      setUserDataResolved(false);
    }
  }, [shouldFetch, userData, userError]);

  const user = React.useMemo(() => {
    if (!optimisticUser || optimisticUser === "Guest") return null;
    if (!userData) return null;
    return { ...userData };
  }, [userData, optimisticUser]);

  const isLoading = React.useMemo(() => {
    if (!authResolved && storedSession.current?.username) return false;
    if (!authResolved) return true;
    if (!optimisticUser) return false;
    if (!userDataResolved) return true;
    if (shouldFetch && userLoading) return true;
    return false;
  }, [
    authResolved,
    optimisticUser,
    shouldFetch,
    userLoading,
    userDataResolved,
  ]);

  const value = React.useMemo(
    () => ({
      user,
      isLoading,
      isLoggedOut: authResolved && !optimisticUser,
      error: userError,
      logout,
    }),
    [user, isLoading, optimisticUser, authResolved, userError, logout],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = React.useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
