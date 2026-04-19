import { api } from "./client";
import { Shop, ShopPricing } from "../types";

export interface RotateMyAgentSecretResponse {
  message: string;
  shopId: string;
  agentSecret: string;
}

export const registerShopApi = async (payload: {
  name: string;
  address: string;
  phone: string;
  services: string[];
  pricing?: ShopPricing;
}) => {
  const { data } = await api.post("/shops/register", payload);
  return data;
};

export const getMyShopApi = async (): Promise<{ shop: Shop | null }> => {
  const { data } = await api.get<{ shop: Shop | null }>("/shops/mine");
  return data;
};

export const updateMyShopDetailsApi = async (payload: {
  name: string;
  address: string;
  phone: string;
  services: string[];
}): Promise<{ message: string; shop: Shop }> => {
  const { data } = await api.patch<{ message: string; shop: Shop }>("/shops/mine", payload);
  return data;
};

export const getApprovedShopsApi = async (): Promise<{ shops: Shop[] }> => {
  const { data } = await api.get<{ shops: Shop[] }>("/shops/approved");
  return data;
};

export const updateShopPricingApi = async (pricing: ShopPricing): Promise<{ message: string; pricing: ShopPricing }> => {
  const { data } = await api.patch<{ message: string; pricing: ShopPricing }>("/shops/pricing", pricing);
  return data;
};

export const rotateMyAgentSecretApi = async (): Promise<RotateMyAgentSecretResponse> => {
  const { data } = await api.patch<RotateMyAgentSecretResponse>("/shops/mine/agent-secret");
  return data;
};
