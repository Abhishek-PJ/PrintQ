import { Response } from "express";
import { Shop } from "../models/Shop";
import { AuthRequest } from "../types";
import { generateAgentSecret, hashAgentSecret } from "../utils/agentSecret";

export const registerShop = async (req: AuthRequest, res: Response): Promise<void> => {
  const existing = await Shop.findOne({ owner: req.user?.userId });
  if (existing) {
    res.status(409).json({ message: "You already have a shop registered", shop: existing });
    return;
  }

  const { name, address, phone, services, pricing } = req.body as {
    name: string;
    address: string;
    phone: string;
    services: string[];
    pricing?: { bwSingle: number; bwDouble: number; colorSingle: number; colorDouble: number };
  };

  if (!name || !address || !phone) {
    res.status(400).json({ message: "name, address and phone are required" });
    return;
  }

  const shop = await Shop.create({
    owner: req.user?.userId,
    name,
    address,
    phone,
    services: services || [],
    pricing: pricing || {},
    status: "pending"
  });

  res.status(201).json({ message: "Shop submitted for approval", shop });
};

export const getMyShop = async (req: AuthRequest, res: Response): Promise<void> => {
  const shop = await Shop.findOne({ owner: req.user?.userId });
  res.json({ shop: shop || null });
};

export const updateMyShopDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  const shop = await Shop.findOne({ owner: req.user?.userId });
  if (!shop) {
    res.status(404).json({ message: "Shop not found" });
    return;
  }

  const { name, address, phone, services } = req.body as {
    name?: string;
    address?: string;
    phone?: string;
    services?: string[];
  };

  if (name !== undefined) {
    const normalized = name.trim();
    if (!normalized) {
      res.status(400).json({ message: "Shop name cannot be empty" });
      return;
    }
    shop.name = normalized;
  }

  if (address !== undefined) {
    const normalized = address.trim();
    if (!normalized) {
      res.status(400).json({ message: "Address cannot be empty" });
      return;
    }
    shop.address = normalized;
  }

  if (phone !== undefined) {
    const normalized = phone.trim();
    if (!normalized) {
      res.status(400).json({ message: "Phone cannot be empty" });
      return;
    }
    shop.phone = normalized;
  }

  if (services !== undefined) {
    if (!Array.isArray(services)) {
      res.status(400).json({ message: "services must be an array of strings" });
      return;
    }
    shop.services = Array.from(new Set(services.map((s) => String(s).trim()).filter(Boolean)));
  }

  await shop.save();
  res.json({ message: "Shop details updated", shop });
};

export const updateShopPricing = async (req: AuthRequest, res: Response): Promise<void> => {
  const shop = await Shop.findOne({ owner: req.user?.userId });
  if (!shop) {
    res.status(404).json({ message: "Shop not found" });
    return;
  }

  const { bwSingle, bwDouble, colorSingle, colorDouble } = req.body as {
    bwSingle: number;
    bwDouble: number;
    colorSingle: number;
    colorDouble: number;
  };

  if (
    typeof bwSingle !== "number" || bwSingle < 0 ||
    typeof bwDouble !== "number" || bwDouble < 0 ||
    typeof colorSingle !== "number" || colorSingle < 0 ||
    typeof colorDouble !== "number" || colorDouble < 0
  ) {
    res.status(400).json({ message: "All pricing values must be non-negative numbers" });
    return;
  }

  shop.pricing = { bwSingle, bwDouble, colorSingle, colorDouble };
  await shop.save();

  res.json({ message: "Pricing updated", shop });
};

export const getApprovedShops = async (_req: AuthRequest, res: Response): Promise<void> => {
  const shops = await Shop.find({ status: "approved" })
    .populate("owner", "name email")
    .sort({ name: 1 });

  res.json({ shops });
};

export const rotateMyAgentSecret = async (req: AuthRequest, res: Response): Promise<void> => {
  const shop = await Shop.findOne({ owner: req.user?.userId });
  if (!shop) {
    res.status(404).json({ message: "Shop not found" });
    return;
  }

  if (shop.status !== "approved") {
    res.status(400).json({ message: "Shop must be approved before rotating agent secret" });
    return;
  }

  const agentSecret = generateAgentSecret();
  shop.agentSecretHash = await hashAgentSecret(agentSecret);
  shop.agentSecretRotatedAt = new Date();
  await shop.save();

  res.json({
    message: "Agent secret rotated",
    shopId: String(shop._id),
    agentSecret,
  });
};
