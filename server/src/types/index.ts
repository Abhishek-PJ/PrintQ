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

/** Job payload dispatched from server → local print agent */
export interface PrintJob {
  orderId: string;
  fileUrl: string;
  fileName: string;
  printOptions: {
    printRules: PrintRule[];
    copies: number;
    paperSize: "A4" | "A3";
    binding: "none" | "spiral" | "staple";
  };
  token: string;
}

export type PrintStep = "queued" | "downloading" | "converting" | "splitting" | "printing" | "done" | "error";

/** Progress event forwarded from agent → server → admin UI */
export interface PrintProgress {
  orderId: string;
  step: PrintStep;
  current?: number;
  total?: number;
  message?: string;
}
