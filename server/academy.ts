import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { parse } from "cookie";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";
import { DEFAULT_SETTINGS, sanitizeSettings, type AcademySettings } from "@shared/academy";
import { academySettings, auditEvents, ownerAccounts, ownerSessions } from "../drizzle/schema";
import { getDb } from "./db";

export const OWNER_COOKIE = "oldfriend_owner_session";
const INITIAL_OWNER_PASSWORD = "greatcricket";
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return expectedBuffer.length === actual.length && timingSafeEqual(actual, expectedBuffer);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function cookieOptions() {
  return { httpOnly: true, sameSite: "none" as const, secure: true, path: "/", maxAge: SESSION_TTL_MS };
}

export function setOwnerCookie(res: Response, token: string) {
  res.cookie(OWNER_COOKIE, token, cookieOptions());
}

export function clearOwnerCookie(res: Response) {
  res.clearCookie(OWNER_COOKIE, { ...cookieOptions(), maxAge: 0 });
}

function requestIp(req: Request) {
  return String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "unknown").split(",")[0].trim();
}

function allowLoginAttempt(req: Request) {
  const now = Date.now();
  const key = requestIp(req);
  const current = loginAttempts.get(key);
  if (!current || current.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  if (current.count >= 8) return false;
  current.count += 1;
  return true;
}

export type OwnerAuth = {
  owner: typeof ownerAccounts.$inferSelect;
  session: typeof ownerSessions.$inferSelect;
};

async function ensureSettingsRecord() {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(academySettings).where(eq(academySettings.scope, "global")).limit(1);
  if (existing[0]) return existing[0];
  const serialized = JSON.stringify(DEFAULT_SETTINGS);
  await db.insert(academySettings).values({ scope: "global", published: serialized, draft: serialized });
  const created = await db.select().from(academySettings).where(eq(academySettings.scope, "global")).limit(1);
  return created[0] ?? null;
}

export async function readPublishedSettings(): Promise<AcademySettings> {
  const row = await ensureSettingsRecord();
  if (!row) return DEFAULT_SETTINGS;
  try {
    return sanitizeSettings(JSON.parse(row.published));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function readOwnerSettings() {
  const row = await ensureSettingsRecord();
  if (!row) return { published: DEFAULT_SETTINGS, draft: DEFAULT_SETTINGS };
  try {
    return {
      published: sanitizeSettings(JSON.parse(row.published)),
      draft: sanitizeSettings(JSON.parse(row.draft)),
    };
  } catch {
    return { published: DEFAULT_SETTINGS, draft: DEFAULT_SETTINGS };
  }
}

async function ensureOwnerAccount() {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(ownerAccounts).where(eq(ownerAccounts.username, "owner")).limit(1);
  if (existing[0]) return existing[0];
  await db.insert(ownerAccounts).values({ username: "owner", passwordHash: hashPassword(INITIAL_OWNER_PASSWORD), mustChangePassword: true });
  const created = await db.select().from(ownerAccounts).where(eq(ownerAccounts.username, "owner")).limit(1);
  return created[0] ?? null;
}

export async function getOwnerAuth(req: Request): Promise<OwnerAuth | null> {
  const db = await getDb();
  if (!db) return null;
  const token = parse(req.headers.cookie ?? "")[OWNER_COOKIE];
  if (!token) return null;
  const session = (await db.select().from(ownerSessions).where(eq(ownerSessions.tokenHash, hashToken(token))).limit(1))[0];
  if (!session || session.expiresAt.getTime() <= Date.now()) return null;
  const owner = (await db.select().from(ownerAccounts).where(eq(ownerAccounts.id, session.ownerId)).limit(1))[0];
  return owner ? { owner, session } : null;
}

export async function loginOwner(req: Request, res: Response, password: string) {
  if (!allowLoginAttempt(req)) return { ok: false as const, reason: "rate_limited" as const };
  const db = await getDb();
  const owner = await ensureOwnerAccount();
  if (!db || !owner || !verifyPassword(password, owner.passwordHash)) {
    return { ok: false as const, reason: "invalid_credentials" as const };
  }
  const rawToken = randomBytes(32).toString("hex");
  await db.insert(ownerSessions).values({
    tokenHash: hashToken(rawToken),
    ownerId: owner.id,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  setOwnerCookie(res, rawToken);
  return { ok: true as const, mustChangePassword: owner.mustChangePassword };
}

export async function updateOwnerPassword(auth: OwnerAuth, newPassword: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(ownerAccounts).set({ passwordHash: hashPassword(newPassword), mustChangePassword: false }).where(eq(ownerAccounts.id, auth.owner.id));
}

export async function saveDraftSettings(settings: AcademySettings, auth: OwnerAuth) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const next = sanitizeSettings(settings);
  await db.update(academySettings).set({ draft: JSON.stringify(next) }).where(eq(academySettings.scope, "global"));
  await db.insert(auditEvents).values({ action: "save_draft", details: JSON.stringify({ ownerId: auth.owner.id, at: new Date().toISOString() }) });
  return next;
}

export async function publishDraft(auth: OwnerAuth) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const row = await ensureSettingsRecord();
  if (!row) throw new Error("Settings are not available");
  await db.update(academySettings).set({ published: row.draft }).where(eq(academySettings.scope, "global"));
  await db.insert(auditEvents).values({ action: "publish_settings", details: JSON.stringify({ ownerId: auth.owner.id, at: new Date().toISOString() }) });
  return readPublishedSettings();
}

export async function resetDraft(auth: OwnerAuth) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const row = await ensureSettingsRecord();
  if (!row) throw new Error("Settings are not available");
  await db.update(academySettings).set({ draft: row.published }).where(eq(academySettings.scope, "global"));
  await db.insert(auditEvents).values({ action: "reset_draft", details: JSON.stringify({ ownerId: auth.owner.id, at: new Date().toISOString() }) });
  return readOwnerSettings();
}
