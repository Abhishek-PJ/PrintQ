import { api } from "./client";
import { Order, Shop, UserInfo } from "../types";

export const saGetAllShopsApi = async (): Promise<{ shops: Shop[] }> => {
  const { data } = await api.get<{ shops: Shop[] }>("/superadmin/shops");
  return data;
};

export const saUpdateShopStatusApi = async (
  id: string,
  status: "approved" | "rejected"
) => {
  const { data } = await api.patch(`/superadmin/shops/${id}/status`, { status });
  return data;
};

export const saUpdateShopApi = async (
  id: string,
  payload: { name?: string; address?: string; phone?: string; services?: string[] }
) => {
  const { data } = await api.patch(`/superadmin/shops/${id}`, payload);
  return data;
};

export const saDeleteShopApi = async (id: string) => {
  const { data } = await api.delete(`/superadmin/shops/${id}`);
  return data;
};

export const saGetAllUsersApi = async (): Promise<{ users: UserInfo[] }> => {
  const { data } = await api.get<{ users: UserInfo[] }>("/superadmin/users");
  return data;
};

export const saSetUserRoleApi = async (
  id: string,
  role: "student" | "admin" | "superadmin"
) => {
  const { data } = await api.patch(`/superadmin/users/${id}/role`, { role });
  return data;
};

export const saUpdateUserApi = async (
  id: string,
  payload: { name?: string; email?: string }
) => {
  const { data } = await api.patch(`/superadmin/users/${id}`, payload);
  return data;
};

export const saDeleteUserApi = async (id: string) => {
  const { data } = await api.delete(`/superadmin/users/${id}`);
  return data;
};

export const saGetAllOrdersApi = async (): Promise<{ orders: Order[] }> => {
  const { data } = await api.get<{ orders: Order[] }>("/superadmin/orders");
  return data;
};
