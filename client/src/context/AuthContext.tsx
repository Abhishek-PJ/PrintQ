import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { loginApi, meApi, registerApi } from "../api/auth";
import { AuthUser } from "../types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (name: string, email: string, password: string, role: "student" | "admin", mobile?: string) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem("printq_token");
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const data = await meApi();
        setUser(data.user);
      } catch {
        localStorage.removeItem("printq_token");
      } finally {
        setLoading(false);
      }
    };
    void init();
  }, []);

  const login = async (email: string, password: string): Promise<AuthUser> => {
    const data = await loginApi({ email, password });
    localStorage.setItem("printq_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    role: "student" | "admin",
    mobile?: string,
  ): Promise<AuthUser> => {
    const data = await registerApi({ name, email, password, role, mobile });
    localStorage.setItem("printq_token", data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = (): void => {
    localStorage.removeItem("printq_token");
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
};
