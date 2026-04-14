import { Schema, model, Document, Types } from "mongoose";
import { OrderStatus, PrintRule, PaymentStatus } from "../types";

export interface IPrintOptions {
  printRules: PrintRule[];
  copies: number;
  paperSize: "A4" | "A3";
  binding: "none" | "spiral" | "staple";
}

export interface IPriceBreakdownItem {
  label: string;
  amount: number;
}

export interface IOrder extends Document {
  student: Types.ObjectId;
  shop: Types.ObjectId;
  token: string;
  originalFileName: string;
  storedFileName: string;
  filePath: string;
  fileKey: string;
  fileUrl: string;
  fileDeleted: boolean;
  documentPageCount?: number;
  printOptions: IPrintOptions;
  totalPrice: number;
  priceBreakdown: IPriceBreakdownItem[];
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  priority: boolean;
}

const printRuleSchema = new Schema<PrintRule>(
  {
    fromPage: { type: Number, required: true, min: 1 },
    toPage: { type: Number, required: true, min: 1 },
    colorMode: { type: String, enum: ["bw", "color"], required: true },
    sided: { type: String, enum: ["single", "double"], required: true }
  },
  { _id: false }
);

const printOptionsSchema = new Schema<IPrintOptions>(
  {
    printRules: { type: [printRuleSchema], required: true },
    copies: { type: Number, required: true, min: 1 },
    paperSize: { type: String, enum: ["A4", "A3"], required: true },
    binding: { type: String, enum: ["none", "spiral", "staple"], default: "none" }
  },
  { _id: false }
);

const priceBreakdownItemSchema = new Schema<IPriceBreakdownItem>(
  {
    label: { type: String, required: true },
    amount: { type: Number, required: true }
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    student: { type: Schema.Types.ObjectId, ref: "User", required: true },
    shop: { type: Schema.Types.ObjectId, ref: "Shop", required: true },
    token: { type: String, required: true, unique: true, index: true },
    originalFileName: { type: String, required: true },
    storedFileName: { type: String, default: "" },
    filePath: { type: String, default: "" },
    fileKey: { type: String, default: "" },
    fileUrl: { type: String, default: "" },
    fileDeleted: { type: Boolean, default: false },
    documentPageCount: { type: Number, min: 1, required: false },
    printOptions: { type: printOptionsSchema, required: true },
    totalPrice: { type: Number, required: true, default: 0 },
    priceBreakdown: { type: [priceBreakdownItemSchema], default: [] },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid"],
      default: "unpaid"
    },
    status: {
      type: String,
      enum: ["pending", "called", "printing", "skipped", "completed"],
      default: "pending",
      index: true
    },
    priority: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export const IOrder = model<IOrder>("Order", orderSchema);
