import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, setAuthToken } from "../api/client";
import { AdminUser, AuthResponse } from "../types";

interface AuthContextValue {
  isLoading: boolean;
  token: string | null;
  admin: AdminUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const TOKEN_KEY = "pm_admin_token";
const ADMIN_KEY = "pm_admin_data";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [admin, setAdmin] = useState<AdminUser | null>(null);

  useEffect(() => {
    const loadAuth = async () => {
      try {
        const entries = await AsyncStorage.multiGet([TOKEN_KEY, ADMIN_KEY]);
        const storedToken = entries[0]?.[1] || null;
        const storedAdmin = entries[1]?.[1] || null;

        if (storedToken) {
          setToken(storedToken);
          setAuthToken(storedToken);
        }

        if (storedAdmin) {
          setAdmin(JSON.parse(storedAdmin) as AdminUser);
        }
      } catch (error) {
        setToken(null);
        setAdmin(null);
        setAuthToken(null);
      } finally {
        setIsLoading(false);
      }
    };

    void loadAuth();
  }, []);

  const login = async (username: string, password: string) => {
    const response = await api.post<AuthResponse>("/auth/login", {
      username,
      password
    });

    const nextToken = response.data.token;
    const nextAdmin = response.data.admin;

    await AsyncStorage.multiSet([
      [TOKEN_KEY, nextToken],
      [ADMIN_KEY, JSON.stringify(nextAdmin)]
    ]);

    setToken(nextToken);
    setAdmin(nextAdmin);
    setAuthToken(nextToken);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, ADMIN_KEY]);
    setToken(null);
    setAdmin(null);
    setAuthToken(null);
  };

  const value = useMemo(
    () => ({
      isLoading,
      token,
      admin,
      login,
      logout
    }),
    [isLoading, token, admin]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
};
