import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AuthPayload } from "../types";

export const signToken = (payload: AuthPayload): string => {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"]
  });
};

export const verifyToken = (token: string): AuthPayload => {
  return jwt.verify(token, env.jwtSecret) as AuthPayload;
};
