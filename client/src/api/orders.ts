import { api } from "./client";
import { Order, PrintRule, PriceBreakdownItem } from "../types";

export const submitOrderApi = async (form: FormData) => {
  const { data } = await api.post("/orders", form, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
  return data;
};

export const previewPriceApi = async (
  printRules: PrintRule[],
  copies: number,
  shopId: string
): Promise<{ breakdown: PriceBreakdownItem[]; total: number }> => {
  const { data } = await api.post<{ breakdown: PriceBreakdownItem[]; total: number }>(
    "/orders/preview-price",
    { printRules, copies, shopId }
  );
  return data;
};

export const markPaidApi = async (id: string) => {
  const { data } = await api.patch(`/orders/${id}/pay`);
  return data;
};

export const myOrdersApi = async (): Promise<{ orders: Order[] }> => {
  const { data } = await api.get<{ orders: Order[] }>("/orders/my");
  return data;
};

export const queueApi = async (): Promise<{ queue: Order[] }> => {
  const { data } = await api.get<{ queue: Order[] }>("/orders/queue");
  return data;
};

export const historyApi = async (params: {
  status?: "pending" | "called" | "printing" | "skipped" | "completed" | "all";
  colorMode?: "bw" | "color" | "all";
  from?: string;
  to?: string;
  search?: string;
}): Promise<{ orders: Order[] }> => {
  const { data } = await api.get<{ orders: Order[] }>("/orders/history", { params });
  return data;
};

export const actionOrderApi = async (id: string, action: "call" | "print" | "skip" | "complete") => {
  const { data } = await api.patch(`/orders/${id}/action`, { action });
  return data;
};

export const downloadFileApi = async (id: string): Promise<{ url: string }> => {
  const { data } = await api.get<{ url: string }>(`/orders/${id}/download`);
  return data;
};
