import { Schema, model, Document, Types } from "mongoose";
import { ShopStatus } from "../types";

export interface IShopPricing {
  bwSingle: number;
  bwDouble: number;
  colorSingle: number;
  colorDouble: number;
}

export interface IShop extends Document {
  owner: Types.ObjectId;
  name: string;
  address: string;
  phone: string;
  services: string[];
  status: ShopStatus;
  pricing: IShopPricing;
}

const pricingSchema = new Schema<IShopPricing>(
  {
    bwSingle:    { type: Number, required: true, min: 0, default: 2.0 },
    bwDouble:    { type: Number, required: true, min: 0, default: 1.5 },
    colorSingle: { type: Number, required: true, min: 0, default: 5.0 },
    colorDouble: { type: Number, required: true, min: 0, default: 4.0 }
  },
  { _id: false }
);

const shopSchema = new Schema<IShop>(
  {
    owner:    { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    name:     { type: String, required: true, trim: true },
    address:  { type: String, required: true, trim: true },
    phone:    { type: String, required: true, trim: true },
    services: [{ type: String, trim: true }],
    pricing:  { type: pricingSchema, default: () => ({}) },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true
    }
  },
  { timestamps: true }
);

export const Shop = model<IShop>("Shop", shopSchema);
