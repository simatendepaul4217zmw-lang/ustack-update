import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (!secret) throw new Error("JWT_SECRET not set");
  return new TextEncoder().encode(secret);
}

export async function signTxAuthToken(userId: string): Promise<string> {
  return new SignJWT({ purpose: "txAuth" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(getJwtSecret());
}

export async function verifyTxAuthToken(userId: string, txAuthToken: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(txAuthToken, getJwtSecret());
    return payload.sub === userId && payload["purpose"] === "txAuth";
  } catch {
    return false;
  }
}

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 12);
}

export async function verifyPinHash(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}
