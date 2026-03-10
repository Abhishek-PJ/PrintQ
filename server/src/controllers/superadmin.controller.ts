import { Response } from "express";
import { Shop } from "../models/Shop";
import { User } from "../models/User";
import { IOrder } from "../models/Order";
import { AuthRequest, ShopStatus } from "../types";

export const getAllShops = async (_req: AuthRequest, res: Response): Promise<void> => {
  const shops = await Shop.find()
    .populate("owner", "name email")
    .sort({ createdAt: -1 });

  res.json({ shops });
};

export const updateShopStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { status } = req.body as { status: ShopStatus };

  if (!status || !["approved", "rejected"].includes(status)) {
    res.status(400).json({ message: "Status must be 'approved' or 'rejected'" });
    return;
  }

  const shop = await Shop.findByIdAndUpdate(id, { status }, { new: true }).populate("owner", "name email");
  if (!shop) {
    res.status(404).json({ message: "Shop not found" });
    return;
  }

  res.json({ message: `Shop ${status}`, shop });
};

export const getAllUsers = async (_req: AuthRequest, res: Response): Promise<void> => {
  const users = await User.find().select("name email role createdAt").sort({ createdAt: -1 });
  res.json({ users });
};

export const setUserRole = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { role } = req.body as { role: "student" | "admin" | "superadmin" };

  if (!role || !["student", "admin", "superadmin"].includes(role)) {
    res.status(400).json({ message: "Invalid role" });
    return;
  }

  const user = await User.findByIdAndUpdate(id, { role }, { new: true }).select("name email role");
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  res.json({ message: "Role updated", user });
};

export const getAllOrders = async (_req: AuthRequest, res: Response): Promise<void> => {
  const orders = await IOrder.find()
    .populate("student", "name email")
    .populate("shop", "name")
    .sort({ createdAt: -1 })
    .limit(500);

  res.json({ orders });
};

export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  if (String(req.user?.userId) === id) {
    res.status(400).json({ message: "You cannot delete your own account." });
    return;
  }

  const user = await User.findByIdAndDelete(id);
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  res.json({ message: "User deleted" });
};

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, email } = req.body as { name?: string; email?: string };

  const user = await User.findByIdAndUpdate(
    id,
    { ...(name && { name }), ...(email && { email }) },
    { new: true }
  ).select("name email role");

  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  res.json({ message: "User updated", user });
};

export const deleteShop = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  const shop = await Shop.findByIdAndDelete(id);
  if (!shop) {
    res.status(404).json({ message: "Shop not found" });
    return;
  }

  res.json({ message: "Shop deleted" });
};

export const updateShop = async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, address, phone, services } = req.body as {
    name?: string;
    address?: string;
    phone?: string;
    services?: string[];
  };

  const shop = await Shop.findByIdAndUpdate(
    id,
    {
      ...(name && { name }),
      ...(address && { address }),
      ...(phone && { phone }),
      ...(services && { services }),
    },
    { new: true }
  ).populate("owner", "name email");

  if (!shop) {
    res.status(404).json({ message: "Shop not found" });
    return;
  }

  res.json({ message: "Shop updated", shop });
};
