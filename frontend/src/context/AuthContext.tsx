"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface AuthUser {
  id: number;
  name: string;
  email: string;
}

interface AuthContextType {
  isLoggedIn: boolean;
  isAuthLoading: boolean;
  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  authToken: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_TOKEN_KEY = "prelegal_auth_token";

interface AuthPayload {
  token: string;
  user: AuthUser;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  const persistAuth = (payload: AuthPayload) => {
    localStorage.setItem(AUTH_TOKEN_KEY, payload.token);
    setAuthToken(payload.token);
    setUser(payload.user);
  };

  const clearAuth = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setAuthToken(null);
    setUser(null);
  };

  useEffect(() => {
    const restoreAuth = async () => {
      const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!storedToken) {
        setIsAuthLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });
        if (!response.ok) {
          clearAuth();
          setIsAuthLoading(false);
          return;
        }

        const payload = (await response.json()) as { user: AuthUser };
        setAuthToken(storedToken);
        setUser(payload.user);
      } catch {
        clearAuth();
      } finally {
        setIsAuthLoading(false);
      }
    };

    void restoreAuth();
  }, []);

  const signIn = async (email: string, password: string) => {
    const response = await fetch("/api/auth/signin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as
        | { detail?: string }
        | null;
      throw new Error(errorPayload?.detail || "Unable to sign in");
    }

    const payload = (await response.json()) as AuthPayload;
    persistAuth(payload);
  };

  const signUp = async (name: string, email: string, password: string) => {
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, email, password }),
    });

    if (!response.ok) {
      const errorPayload = (await response.json().catch(() => null)) as
        | { detail?: string }
        | null;
      throw new Error(errorPayload?.detail || "Unable to sign up");
    }

    const payload = (await response.json()) as AuthPayload;
    persistAuth(payload);
  };

  const logout = async () => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      await fetch("/api/auth/signout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).catch(() => undefined);
    }
    clearAuth();
  };

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn: Boolean(user && authToken),
        isAuthLoading,
        user,
        signIn,
        signUp,
        logout,
        authToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
