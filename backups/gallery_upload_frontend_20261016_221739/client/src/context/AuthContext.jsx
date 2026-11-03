import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { apiRequest } from "../services/api.js";

const AuthContext = createContext(null);
const SESSION_STORAGE_KEY = "shms.authSession";
const SELECTED_HOSTEL_STORAGE_KEY = "shms.selectedHostelId";

const readStoredSession = () => {
  try {
    const stored = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (
      typeof parsed?.token === "string" &&
      parsed.token &&
      parsed.user &&
      typeof parsed.user.id === "string" &&
      typeof parsed.user.role === "string"
    ) {
      return parsed;
    }
  } catch {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }
  return null;
};

const storeSession = (session) => {
  try {
    if (session) {
      window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }
};

const readStoredSelectedHostel = () => {
  try {
    return window.sessionStorage.getItem(SELECTED_HOSTEL_STORAGE_KEY) || "";
  } catch {
    return "";
  }
};
export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => readStoredSession());
  const [storedSelectedHostelId, setStoredSelectedHostelId] = useState(() => readStoredSelectedHostel());

  const selectedHostelId = storedSelectedHostelId ||
    (session?.user?.role === "SYSTEM_ADMIN" ? "__ALL_HOSTELS__" : session?.user?.hostelId || "");

  const setSelectedHostelId = useCallback((hostelId) => {
    const next = typeof hostelId === "string" ? hostelId.trim() : "";

    try {
      if (next) {
        window.sessionStorage.setItem(SELECTED_HOSTEL_STORAGE_KEY, next);
      } else {
        window.sessionStorage.removeItem(SELECTED_HOSTEL_STORAGE_KEY);
      }
    } catch {
      // The server remains responsible for authorizing the selected hostel.
    }

    setStoredSelectedHostelId(next);
  }, []);

  const login = useCallback(async (credentials) => {
    const response = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials)
    });

    const account = response.data.user;
    setSelectedHostelId(
      account?.role === "SYSTEM_ADMIN" ? "__ALL_HOSTELS__" : account?.hostelId || ""
    );
    setSession(response.data);
    storeSession(response.data);
    return account;
  }, [setSelectedHostelId]);

  const googleLogin = useCallback(async (credentials) => {
    const response = await apiRequest("/api/auth/google", {
      method: "POST",
      body: JSON.stringify(credentials)
    });

    const account = response.data.user;
    setSelectedHostelId(
      account?.role === "SYSTEM_ADMIN" ? "__ALL_HOSTELS__" : account?.hostelId || ""
    );
    setSession(response.data);
    storeSession(response.data);
    return account;
  }, [setSelectedHostelId]);
  const registerOwner = useCallback(async (profile) => {
    const response = await apiRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(profile)
    });

    setSelectedHostelId(response.data.user?.hostelId || "");
    setSession(response.data);
    storeSession(response.data);
    return response.data.user;
  }, [setSelectedHostelId]);

  const logout = useCallback(() => {
    setSession(null);
    storeSession(null);
    setSelectedHostelId("");
  }, [setSelectedHostelId]);
  const updateUser = useCallback((user) => setSession((current) => {
    if (!current) return current;
    const next = { ...current, user: { ...current.user, ...user } };
    storeSession(next);
    return next;
  }), []);
  const value = useMemo(() => ({
    token: session?.token || null,
    user: session?.user || null,
    selectedHostelId,
    setSelectedHostelId,
    login,
    googleLogin,
    registerOwner,
    logout,
    updateUser
  }), [session, selectedHostelId, setSelectedHostelId, login, googleLogin, registerOwner, logout, updateUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }
  return context;
}
