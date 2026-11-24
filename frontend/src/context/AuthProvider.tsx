import { useState, type ReactNode } from "react";
import { AuthContext } from "./auth-context";
import { authApi, tokenStorage } from "../services/api";
import type { AuthResponse, User } from "../types";

const USER_KEY = "user";

function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => tokenStorage.get());
  const [user, setUser] = useState<User | null>(loadUser);

  const save = (res: AuthResponse) => {
    tokenStorage.set(res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    setToken(res.token);
    setUser(res.user);
  };

  const login = async (email: string, password: string) => {
    save(await authApi.login(email, password));
  };

  const register = async (name: string, email: string, password: string) => {
    save(await authApi.register(name, email, password));
  };

  const logout = () => {
    tokenStorage.clear();
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}