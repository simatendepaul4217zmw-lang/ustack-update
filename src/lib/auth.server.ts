import { SignJWT, jwtVerify } from "jose";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (!secret) throw new Error("JWT_SECRET or SESSION_SECRET must be set");
  return new TextEncoder().encode(secret);
}

export interface JWTPayload {
  sub: string;
  username: string;
  email: string;
  iat?: number;
  exp?: number;
}

export async function signAccessToken(payload: Omit<JWTPayload, "iat" | "exp">): Promise<string> {
  return new SignJWT({ username: payload.username, email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());
}

export async function signRefreshToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getJwtSecret());
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return {
      sub: payload.sub as string,
      username: payload["username"] as string,
      email: payload["email"] as string,
    };
  } catch {
    return null;
  }
}

export function generateOtp(): string {
  return String(Math.floor(100_000 + Math.random() * 900_000));
}
