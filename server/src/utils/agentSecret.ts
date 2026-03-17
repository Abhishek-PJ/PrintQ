import { compare, hash } from "bcryptjs";
import { randomBytes } from "crypto";

export const generateAgentSecret = (): string => randomBytes(24).toString("base64url");

export const hashAgentSecret = async (secret: string): Promise<string> => hash(secret, 10);

export const verifyAgentSecret = async (secret: string, secretHash: string): Promise<boolean> =>
  compare(secret, secretHash);
