import type { DashboardPermissions } from "./dashboard-permissions";

const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signingKey() {
  const secret = process.env.DASHBOARD_SESSION_SECRET;
  if (!secret) throw new Error("DASHBOARD_SESSION_SECRET is not configured.");

  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export type DashboardSession = {
  username: string;
  role: "admin" | "user";
  salesRepId: number | null;
  salesRepName: string | null;
  permissions: DashboardPermissions;
  expiresAt: number;
};

export async function createDashboardSession(
  username: string,
  role: "admin" | "user",
  salesRepId: number | null = null,
  salesRepName: string | null = null,
  permissions: DashboardPermissions = {}
) {
  const payload = bytesToBase64Url(
    encoder.encode(
      JSON.stringify({
        username,
        role,
        salesRepId,
        salesRepName,
        permissions,
        expiresAt: Date.now() + 8 * 60 * 60 * 1000,
      })
    )
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(),
    encoder.encode(payload)
  );
  return `${payload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function readDashboardSession(
  token?: string
): Promise<DashboardSession | null> {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  try {
    const valid = await crypto.subtle.verify(
      "HMAC",
      await signingKey(),
      base64UrlToBytes(signature),
      encoder.encode(payload)
    );
    if (!valid) return null;

    const session = JSON.parse(
      new TextDecoder().decode(base64UrlToBytes(payload))
    );
    const validSession =
      typeof session.username === "string" &&
      (session.role === "admin" || session.role === "user") &&
      (session.salesRepId === null || typeof session.salesRepId === "number") &&
      (session.salesRepName === null || typeof session.salesRepName === "string") &&
      session.permissions !== null && typeof session.permissions === "object" &&
      typeof session.expiresAt === "number" &&
      session.expiresAt > Date.now();
    return validSession ? session : null;
  } catch {
    return null;
  }
}

export async function verifyDashboardSession(token?: string) {
  return Boolean(await readDashboardSession(token));
}

export function createPasswordSalt() {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(16)));
}

export async function hashDashboardPassword(
  password: string,
  salt: string
) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: base64UrlToBytes(salt),
      iterations: 150000,
    },
    key,
    256
  );
  return bytesToBase64Url(new Uint8Array(derived));
}
