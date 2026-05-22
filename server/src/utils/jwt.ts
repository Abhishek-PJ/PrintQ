import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AccessTokenPayload, AuthPayload, RefreshTokenPayload } from "../types";

export const signAccessToken = (payload: AuthPayload): string => {
  const accessPayload: AccessTokenPayload = { ...payload, type: "access" };
  return jwt.sign(accessPayload, env.jwtSecret, {
    expiresIn: env.jwtAccessExpiresIn as jwt.SignOptions["expiresIn"],
  });
};

export const signRefreshToken = (payload: Omit<RefreshTokenPayload, "type">): string => {
  const refreshPayload: RefreshTokenPayload = { ...payload, type: "refresh" };
  return jwt.sign(refreshPayload, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiresIn as jwt.SignOptions["expiresIn"],
  });
};

export const verifyAccessToken = (token: string): AuthPayload => {
  const decoded = jwt.verify(token, env.jwtSecret) as Partial<AccessTokenPayload>;
  if (decoded.type !== "access" || !decoded.userId || !decoded.role) {
    throw new Error("Invalid access token");
  }
  return { userId: decoded.userId, role: decoded.role };
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  const decoded = jwt.verify(token, env.jwtRefreshSecret) as Partial<RefreshTokenPayload>;
  if (decoded.type !== "refresh" || !decoded.userId || !decoded.tokenId) {
    throw new Error("Invalid refresh token");
  }
  return { userId: decoded.userId, tokenId: decoded.tokenId, type: "refresh" };
};

// Backwards-compatible aliases (existing code assumed a single access token)
export const signToken = signAccessToken;
export const verifyToken = verifyAccessToken;
