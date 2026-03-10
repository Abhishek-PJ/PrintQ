import { Request } from "express";

export type UserRole = "student" | "admin" | "superadmin";

export type OrderStatus = "pending" | "called" | "printing" | "skipped" | "completed";

export type OrderAction = "call" | "print" | "skip" | "complete";

export type ShopStatus = "pending" | "approved" | "rejected";

export type PaymentStatus = "unpaid" | "paid";

export interface PrintRule {
  fromPage: number;
  toPage: number;
  colorMode: "bw" | "color";
  sided: "single" | "double";
}

export interface AuthPayload {
  userId: string;
  role: UserRole;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}
