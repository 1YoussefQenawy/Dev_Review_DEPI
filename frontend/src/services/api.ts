import type { AuthResponse } from "../types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:5000/api";
const TOKEN_KEY = "token";

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

export const tokenStorage = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = tokenStorage.get();

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new ApiError(res.status, data?.message ?? "Something went wrong");
  }
  return data as T;
}

const wait = (ms = 400) => new Promise((resolve) => setTimeout(resolve, ms));

export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    if (USE_MOCK) {
      await wait();
      return {
        token: "mock-token",
        user: { id: "1", name: email.split("@")[0], email },
      };
    }
    return request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  register: async (name: string, email: string, password: string): Promise<AuthResponse> => {
    if (USE_MOCK) {
      await wait();
      return { token: "mock-token", user: { id: "1", name, email } };
    }
    return request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
  },
};