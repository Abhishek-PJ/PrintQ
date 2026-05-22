import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { User } from "../models/User";
import { AuthRequest } from "../types";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt";

const REFRESH_COOKIE_NAME = "printq_refresh";

const parseDurationToMs = (value: string): number => {
  // Supports: "30d", "12h", "15m", "60s", or plain milliseconds
  const trimmed = String(value || "").trim();
  const match = trimmed.match(/^([0-9]+)\s*([smhd])?$/i);
  if (!match) return 30 * 24 * 60 * 60 * 1000;
  const amount = Number(match[1]);
  const unit = (match[2] || "ms").toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0) return 30 * 24 * 60 * 60 * 1000;
  switch (unit) {
    case "s":
      return amount * 1000;
    case "m":
      return amount * 60 * 1000;
    case "h":
      return amount * 60 * 60 * 1000;
    case "d":
      return amount * 24 * 60 * 60 * 1000;
    default:
      return amount;
  }
};

const setRefreshCookie = (res: Response, refreshToken: string): void => {
  const isProd = process.env.NODE_ENV === "production";
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/api/auth",
    maxAge: parseDurationToMs(process.env.JWT_REFRESH_EXPIRES_IN || "30d"),
  });
};

const clearRefreshCookie = (res: Response): void => {
  const isProd = process.env.NODE_ENV === "production";
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/api/auth",
  });
};

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

  const tokenId = randomBytes(32).toString("hex");
  user.refreshTokenIdHash = await bcrypt.hash(tokenId, 10);
  user.refreshTokenRotatedAt = new Date();
  await user.save();

  const accessToken = signAccessToken({ userId: user._id.toString(), role: user.role });
  const refreshToken = signRefreshToken({ userId: user._id.toString(), tokenId });
  setRefreshCookie(res, refreshToken);

  res
    .status(201)
    .json({ token: accessToken, user: { id: user._id, name: user.name, email: user.email, role: user.role, mobile: user.mobile } });
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

  const tokenId = randomBytes(32).toString("hex");
  user.refreshTokenIdHash = await bcrypt.hash(tokenId, 10);
  user.refreshTokenRotatedAt = new Date();
  await user.save();

  const accessToken = signAccessToken({ userId: user._id.toString(), role: user.role });
  const refreshToken = signRefreshToken({ userId: user._id.toString(), tokenId });
  setRefreshCookie(res, refreshToken);

  res.json({ token: accessToken, user: { id: user._id, name: user.name, email: user.email, role: user.role, mobile: user.mobile } });
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  const refreshToken = (req as any).cookies?.[REFRESH_COOKIE_NAME] as string | undefined;
  if (!refreshToken) {
    res.status(401).json({ message: "Missing refresh token" });
    return;
  }

  let payload: { userId: string; tokenId: string };
  try {
    const decoded = verifyRefreshToken(refreshToken);
    payload = { userId: decoded.userId, tokenId: decoded.tokenId };
  } catch {
    clearRefreshCookie(res);
    res.status(401).json({ message: "Invalid refresh token" });
    return;
  }

  const user = await User.findById(payload.userId).select("name email role mobile +refreshTokenIdHash");
  if (!user || !user.refreshTokenIdHash) {
    clearRefreshCookie(res);
    res.status(401).json({ message: "Invalid refresh token" });
    return;
  }

  const match = await bcrypt.compare(payload.tokenId, user.refreshTokenIdHash);
  if (!match) {
    clearRefreshCookie(res);
    res.status(401).json({ message: "Invalid refresh token" });
    return;
  }

  const nextTokenId = randomBytes(32).toString("hex");
  user.refreshTokenIdHash = await bcrypt.hash(nextTokenId, 10);
  user.refreshTokenRotatedAt = new Date();
  await user.save();

  const accessToken = signAccessToken({ userId: user._id.toString(), role: user.role });
  const nextRefreshToken = signRefreshToken({ userId: user._id.toString(), tokenId: nextTokenId });
  setRefreshCookie(res, nextRefreshToken);

  res.json({ token: accessToken, user: { id: user._id, name: user.name, email: user.email, role: user.role, mobile: user.mobile } });
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  const refreshToken = (req as any).cookies?.[REFRESH_COOKIE_NAME] as string | undefined;

  if (refreshToken) {
    try {
      const decoded = verifyRefreshToken(refreshToken);
      await User.findByIdAndUpdate(decoded.userId, { refreshTokenIdHash: null, refreshTokenRotatedAt: null });
    } catch {
      // ignore
    }
  }

  clearRefreshCookie(res);
  res.json({ message: "Logged out" });
};

export const me = async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await User.findById(req.user?.userId).select("name email role mobile");
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  res.json({ user });
};
