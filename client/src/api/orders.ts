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

export const getOrderQueueStatusApi = async (
  id: string
): Promise<{ inQueue: boolean; position: number; ordersAhead: number; estimatedMinutes: number; totalInQueue: number }> => {
  const { data } = await api.get(`/orders/${id}/queue-status`);
  return data;
};

export const editOrderApi = async (
  id: string,
  payload: { printRules?: PrintRule[]; copies?: number; paperSize?: "A4" | "A3"; binding?: "none" | "spiral" | "staple" }
): Promise<{ order: Order }> => {
  const { data } = await api.patch<{ order: Order }>(`/orders/${id}/edit`, payload);
  return data;
};

export const deleteOrderApi = async (id: string): Promise<void> => {
  await api.delete(`/orders/${id}`);
};

export const setPriorityApi = async (id: string, priority: boolean): Promise<void> => {
  await api.patch(`/orders/${id}/priority`, { priority });
};
