import { api } from "./client";
import { AuthUser } from "../types";

interface AuthResponse {
  token: string;
  user: AuthUser;
}

export const registerApi = async (payload: {
  name: string;
  email: string;
  password: string;
  role: "student" | "admin";
  mobile?: string;
}): Promise<AuthResponse> => {
  const { data } = await api.post<AuthResponse>("/auth/register", payload);
  return data;
};

export const loginApi = async (payload: {
  email: string;
  password: string;
}): Promise<AuthResponse> => {
  const { data } = await api.post<AuthResponse>("/auth/login", payload);
  return data;
};

export const meApi = async (): Promise<{ user: AuthUser }> => {
  const { data } = await api.get<{ user: AuthUser }>("/auth/me");
  return data;
};

export const refreshApi = async (): Promise<{ token: string; user: AuthUser }> => {
  const { data } = await api.post<{ token: string; user: AuthUser }>("/auth/refresh");
  return data;
};

export const logoutApi = async (): Promise<{ message: string }> => {
  const { data } = await api.post<{ message: string }>("/auth/logout");
  return data;
};
