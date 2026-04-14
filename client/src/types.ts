export type UserRole = "student" | "admin" | "superadmin";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface PrintRule {
  fromPage: number;
  toPage: number;
  colorMode: "bw" | "color";
  sided: "single" | "double";
}

export interface PriceBreakdownItem {
  label: string;
  amount: number;
}

export interface PrintOptions {
  printRules: PrintRule[];
  copies: number;
  paperSize: "A4" | "A3";
  binding: "none" | "spiral" | "staple";
}

export interface Order {
  _id: string;
  token: string;
  status: "pending" | "called" | "printing" | "skipped" | "completed";
  originalFileName: string;
  fileDeleted?: boolean;
  documentPageCount?: number;
  printOptions: PrintOptions;
  totalPrice: number;
  priceBreakdown: PriceBreakdownItem[];
  paymentStatus: "unpaid" | "paid";
  priority?: boolean;
  createdAt: string;
  updatedAt: string;
  student?: {
    name: string;
    email: string;
    mobile?: string;
    phone?: string;
  };
  shop?: {
    _id: string;
    name: string;
  };
}

export interface ShopPricing {
  bwSingle: number;
  bwDouble: number;
  colorSingle: number;
  colorDouble: number;
}

export interface Shop {
  _id: string;
  name: string;
  address: string;
  phone: string;
  services: string[];
  status: "pending" | "approved" | "rejected";
  pricing: ShopPricing;
  owner?: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
}

export interface UserInfo {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}
