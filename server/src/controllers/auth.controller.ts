import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/User";
import { AuthRequest } from "../types";
import { signToken } from "../utils/jwt";

export const register = async (req: Request, res: Response): Promise<void> => {
  const { name, email, password, role, mobile } = req.body as {
    name: string;
    email: string;
    password: string;
    role?: "student" | "admin";
    mobile?: string;
  };

  if (!name || !email || !password) {
    res.status(400).json({ message: "name, email and password are required" });
    return;
  }

  // Server-side format guards
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email)) {
    res.status(400).json({ message: "Invalid email address" });
    return;
  }

  if (mobile && !/^[6-9]\d{9}$/.test(mobile)) {
    res.status(400).json({ message: "Mobile must be a valid 10-digit Indian number" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ message: "Password must be at least 8 characters" });
    return;
  }

  const sanitizedRole = role === "admin" ? "admin" : "student";

  const existing = await User.findOne({ email });
  if (existing) {
    console.log(`Registration attempt with existing email: ${existing.email}`);
    res.status(409).json({ message: "Email already exists" });
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, password: hashed, role: sanitizedRole, mobile: mobile ?? null });

  const token = signToken({ userId: user._id.toString(), role: user.role });
  res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role, mobile: user.mobile } });
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email: string; password: string };

  const user = await User.findOne({ email });
  if (!user) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  const token = signToken({ userId: user._id.toString(), role: user.role });
  res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
};

export const me = async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await User.findById(req.user?.userId).select("name email role");
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  res.json({ user });
};
