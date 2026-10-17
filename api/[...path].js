// server/_core/apiApp.ts
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "webdev_app_session";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";

// server/db.ts
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, boolean } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var academySettings = mysqlTable("academy_settings", {
  id: int("id").autoincrement().primaryKey(),
  scope: varchar("scope", { length: 32 }).notNull().unique(),
  published: text("published").notNull(),
  draft: text("draft").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var ownerAccounts = mysqlTable("owner_accounts", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  mustChangePassword: boolean("mustChangePassword").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var ownerSessions = mysqlTable("owner_sessions", {
  id: int("id").autoincrement().primaryKey(),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
  ownerId: int("ownerId").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});
var auditEvents = mysqlTable("audit_events", {
  id: int("id").autoincrement().primaryKey(),
  action: varchar("action", { length: 64 }).notNull(),
  details: text("details").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull()
});

// server/_core/env.ts
var ENV = {
  get appId() {
    return process.env.MANUS_PROJECT_ID ?? "";
  },
  get cookieSecret() {
    return process.env.MANUS_JWT_SECRET ?? "";
  },
  get databaseUrl() {
    return process.env.DATABASE_URL ?? "";
  },
  get oAuthServerUrl() {
    return process.env.MANUS_OAUTH_API_URL ?? "";
  },
  // Preserve the legacy hint when supplied; otherwise roles remain application data.
  get ownerOpenId() {
    return process.env.OWNER_OPEN_ID ?? "";
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  get forgeApiUrl() {
    return process.env.MANUS_API_URL ?? "";
  },
  get forgeApiKey() {
    return process.env.MANUS_API_KEY ?? "";
  }
};

// server/db.ts
var _db = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return void 0;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}

// server/_core/cookies.ts
function getSessionCookieOptions(_req) {
  return { httpOnly: true, path: "/", sameSite: "none", secure: true };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: MANUS_OAUTH_API_URL is not configured! Set MANUS_OAUTH_API_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    if (!secret) throw new Error("MANUS_JWT_SECRET is unavailable");
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || (!isNonEmptyString(appId) || appId !== ENV.appId) || typeof name !== "string") {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken && req.path.startsWith("/api/scheduled/")) {
      const ticket = cookies.get("app_session_id");
      const identity = await this.verifySession(ticket);
      if (identity?.openId.startsWith(CRON_OPEN_ID_PREFIX)) sessionToken = ticket;
    }
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions2 = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions2, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error instanceof Error ? error.message : "unknown error");
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/publicConfig.ts
function publicPlatformConfig(env = process.env) {
  return {
    projectId: env.MANUS_PROJECT_ID ?? "",
    oauthPortalUrl: env.MANUS_OAUTH_PORTAL_URL ?? "",
    apiUrl: env.MANUS_API_URL ?? "",
    apiBrowserKey: env.MANUS_API_BROWSER_KEY ?? ""
  };
}
function publicPlatformScript(env = process.env) {
  const json = JSON.stringify(publicPlatformConfig(env)).replaceAll("<", "\\u003c");
  return `window.__MANUS_CONFIG__=${json};`;
}

// server/routers.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
import { z as z2 } from "zod";

// server/academy.ts
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { parse } from "cookie";
import { eq as eq2 } from "drizzle-orm";

// shared/academy.ts
var DEFAULT_SETTINGS = {
  academyName: "Old Friend Cricket Academy",
  shortName: "OFCA",
  headline: "Train with Passion. Play with Purpose.",
  heroText: "Professional cricket training for girls and boys aged 8\u201321. Build your technique, improve your game, and develop confidence through regular practice and competitive matches.",
  aboutTitle: "A place to build your game",
  aboutText: "Old Friend Cricket Academy is a welcoming training ground in Bishan Khedi, Bhopal for girls and boys aged 8\u201321. Players get regular opportunities to work on their technique through weekly net practice and apply their learning in monthly cricket matches.",
  address: "89FF+F7, Bhopal, Bishan Khedi, Madhya Pradesh 462038, India",
  phone: "+91 90091 91168",
  whatsappNumber: "919009191168",
  registrationFee: 500,
  monthlyFee: 2e3,
  minAge: 8,
  maxAge: 21,
  footerText: "Professional cricket training for the next innings.",
  registrationIntro: "Tell us a little about the player. We\u2019ll open WhatsApp with a ready-to-review message for the academy team.",
  registrationInstructions: "Registration starts on WhatsApp. Please review the prefilled message and press Send; the academy will confirm the next steps.",
  summerMode: false,
  summerHeadline: "Make the holidays count.",
  summerAnnouncement: "Summer mode is on: a brighter training atmosphere for players building their next innings.",
  defaultTheme: "light",
  accentColor: "#E5B84B",
  requireContact: false,
  showAddressField: true,
  showMessageField: true,
  privacyPolicy: "We use the information you choose to share in the registration form only to prepare your WhatsApp enquiry. We do not silently store completed student registration details in a public database. Essential browser storage may remember your theme and cookie choices.",
  cookiePolicy: "Essential storage supports basic preferences and website functionality. Optional analytics and marketing technologies are currently inactive. You can revisit cookie settings at any time from the footer.",
  featureCards: [
    {
      id: "training",
      eyebrow: "01 / Technique",
      title: "Professional Cricket Training",
      description: "Training opportunities for girls and boys aged 8\u201321, focused on developing cricket skills and confidence.",
      icon: "bat",
      visible: true
    },
    {
      id: "nets",
      eyebrow: "02 / Repetition",
      title: "Weekly Net Practice",
      description: "Regular net practice to work on batting, bowling, technique, and consistency.",
      icon: "net",
      visible: true
    },
    {
      id: "matches",
      eyebrow: "03 / Application",
      title: "Monthly Cricket Matches",
      description: "Monthly match opportunities that help players apply their skills in competitive playing situations.",
      icon: "match",
      visible: true
    }
  ]
};
function sanitizeSettings(value) {
  const merged = { ...DEFAULT_SETTINGS, ...value ?? {} };
  const cards = Array.isArray(merged.featureCards) ? merged.featureCards : DEFAULT_SETTINGS.featureCards;
  return {
    ...DEFAULT_SETTINGS,
    ...merged,
    academyName: String(merged.academyName || DEFAULT_SETTINGS.academyName).slice(0, 100),
    shortName: String(merged.shortName || DEFAULT_SETTINGS.shortName).slice(0, 10),
    registrationFee: Math.max(0, Math.round(Number(merged.registrationFee) || DEFAULT_SETTINGS.registrationFee)),
    monthlyFee: Math.max(0, Math.round(Number(merged.monthlyFee) || DEFAULT_SETTINGS.monthlyFee)),
    minAge: Math.min(21, Math.max(1, Math.round(Number(merged.minAge) || DEFAULT_SETTINGS.minAge))),
    maxAge: Math.min(99, Math.max(1, Math.round(Number(merged.maxAge) || DEFAULT_SETTINGS.maxAge))),
    featureCards: cards.map((card, index) => ({
      id: String(card.id || `card-${index}`),
      eyebrow: String(card.eyebrow || `${String(index + 1).padStart(2, "0")} / Practice`),
      title: String(card.title || "Cricket training"),
      description: String(card.description || "Build skills through focused practice."),
      icon: card.icon === "net" || card.icon === "match" ? card.icon : "bat",
      visible: card.visible !== false
    }))
  };
}

// server/academy.ts
var OWNER_COOKIE = "oldfriend_owner_session";
var INITIAL_OWNER_PASSWORD = "greatcricket";
var SESSION_TTL_MS = 1e3 * 60 * 60 * 8;
var loginAttempts = /* @__PURE__ */ new Map();
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}
function verifyPassword(password, stored) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return expectedBuffer.length === actual.length && timingSafeEqual(actual, expectedBuffer);
}
function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}
function cookieOptions() {
  return { httpOnly: true, sameSite: "none", secure: true, path: "/", maxAge: SESSION_TTL_MS };
}
function setOwnerCookie(res, token) {
  res.cookie(OWNER_COOKIE, token, cookieOptions());
}
function clearOwnerCookie(res) {
  res.clearCookie(OWNER_COOKIE, { ...cookieOptions(), maxAge: 0 });
}
function requestIp(req) {
  return String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "unknown").split(",")[0].trim();
}
function allowLoginAttempt(req) {
  const now = Date.now();
  const key = requestIp(req);
  const current = loginAttempts.get(key);
  if (!current || current.resetAt < now) {
    loginAttempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1e3 });
    return true;
  }
  if (current.count >= 8) return false;
  current.count += 1;
  return true;
}
async function ensureSettingsRecord() {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(academySettings).where(eq2(academySettings.scope, "global")).limit(1);
  if (existing[0]) return existing[0];
  const serialized = JSON.stringify(DEFAULT_SETTINGS);
  await db.insert(academySettings).values({ scope: "global", published: serialized, draft: serialized });
  const created = await db.select().from(academySettings).where(eq2(academySettings.scope, "global")).limit(1);
  return created[0] ?? null;
}
async function readPublishedSettings() {
  const row = await ensureSettingsRecord();
  if (!row) return DEFAULT_SETTINGS;
  try {
    return sanitizeSettings(JSON.parse(row.published));
  } catch {
    return DEFAULT_SETTINGS;
  }
}
async function readOwnerSettings() {
  const row = await ensureSettingsRecord();
  if (!row) return { published: DEFAULT_SETTINGS, draft: DEFAULT_SETTINGS };
  try {
    return {
      published: sanitizeSettings(JSON.parse(row.published)),
      draft: sanitizeSettings(JSON.parse(row.draft))
    };
  } catch {
    return { published: DEFAULT_SETTINGS, draft: DEFAULT_SETTINGS };
  }
}
async function ensureOwnerAccount() {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(ownerAccounts).where(eq2(ownerAccounts.username, "owner")).limit(1);
  if (existing[0]) return existing[0];
  await db.insert(ownerAccounts).values({ username: "owner", passwordHash: hashPassword(INITIAL_OWNER_PASSWORD), mustChangePassword: true });
  const created = await db.select().from(ownerAccounts).where(eq2(ownerAccounts.username, "owner")).limit(1);
  return created[0] ?? null;
}
async function getOwnerAuth(req) {
  const db = await getDb();
  if (!db) return null;
  const token = parse(req.headers.cookie ?? "")[OWNER_COOKIE];
  if (!token) return null;
  const session = (await db.select().from(ownerSessions).where(eq2(ownerSessions.tokenHash, hashToken(token))).limit(1))[0];
  if (!session || session.expiresAt.getTime() <= Date.now()) return null;
  const owner = (await db.select().from(ownerAccounts).where(eq2(ownerAccounts.id, session.ownerId)).limit(1))[0];
  return owner ? { owner, session } : null;
}
async function loginOwner(req, res, password) {
  if (!allowLoginAttempt(req)) return { ok: false, reason: "rate_limited" };
  const db = await getDb();
  const owner = await ensureOwnerAccount();
  if (!db || !owner || !verifyPassword(password, owner.passwordHash)) {
    return { ok: false, reason: "invalid_credentials" };
  }
  const rawToken = randomBytes(32).toString("hex");
  await db.insert(ownerSessions).values({
    tokenHash: hashToken(rawToken),
    ownerId: owner.id,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS)
  });
  setOwnerCookie(res, rawToken);
  return { ok: true, mustChangePassword: owner.mustChangePassword };
}
async function updateOwnerPassword(auth, newPassword) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(ownerAccounts).set({ passwordHash: hashPassword(newPassword), mustChangePassword: false }).where(eq2(ownerAccounts.id, auth.owner.id));
}
async function saveDraftSettings(settings, auth) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const next = sanitizeSettings(settings);
  await db.update(academySettings).set({ draft: JSON.stringify(next) }).where(eq2(academySettings.scope, "global"));
  await db.insert(auditEvents).values({ action: "save_draft", details: JSON.stringify({ ownerId: auth.owner.id, at: (/* @__PURE__ */ new Date()).toISOString() }) });
  return next;
}
async function publishDraft(auth) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const row = await ensureSettingsRecord();
  if (!row) throw new Error("Settings are not available");
  await db.update(academySettings).set({ published: row.draft }).where(eq2(academySettings.scope, "global"));
  await db.insert(auditEvents).values({ action: "publish_settings", details: JSON.stringify({ ownerId: auth.owner.id, at: (/* @__PURE__ */ new Date()).toISOString() }) });
  return readPublishedSettings();
}
async function resetDraft(auth) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const row = await ensureSettingsRecord();
  if (!row) throw new Error("Settings are not available");
  await db.update(academySettings).set({ draft: row.published }).where(eq2(academySettings.scope, "global"));
  await db.insert(auditEvents).values({ action: "reset_draft", details: JSON.stringify({ ownerId: auth.owner.id, at: (/* @__PURE__ */ new Date()).toISOString() }) });
  return readOwnerSettings();
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
async function requireOwner(req) {
  const auth = await getOwnerAuth(req);
  if (!auth) throw new TRPCError3({ code: "UNAUTHORIZED", message: "Owner authentication required" });
  return auth;
}
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions2 = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions2, maxAge: -1 });
      return { success: true };
    })
  }),
  academy: router({
    settings: publicProcedure.query(() => readPublishedSettings())
  }),
  owner: router({
    status: publicProcedure.query(async ({ ctx }) => {
      const auth = await getOwnerAuth(ctx.req);
      return { authenticated: Boolean(auth), mustChangePassword: auth?.owner.mustChangePassword ?? false };
    }),
    login: publicProcedure.input(z2.object({ password: z2.string().min(1).max(200) })).mutation(async ({ ctx, input }) => {
      const result = await loginOwner(ctx.req, ctx.res, input.password);
      if (!result.ok) {
        if (result.reason === "rate_limited") throw new TRPCError3({ code: "TOO_MANY_REQUESTS", message: "Too many attempts. Try again in a few minutes." });
        throw new TRPCError3({ code: "UNAUTHORIZED", message: "That password was not accepted." });
      }
      return result;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      clearOwnerCookie(ctx.res);
      return { success: true };
    }),
    settings: publicProcedure.query(async ({ ctx }) => {
      await requireOwner(ctx.req);
      return readOwnerSettings();
    }),
    changePassword: publicProcedure.input(z2.object({ password: z2.string().min(8).max(200) })).mutation(async ({ ctx, input }) => {
      const auth = await requireOwner(ctx.req);
      await updateOwnerPassword(auth, input.password);
      return { success: true };
    }),
    saveDraft: publicProcedure.input(z2.object({ settings: z2.any() })).mutation(async ({ ctx, input }) => {
      const auth = await requireOwner(ctx.req);
      return saveDraftSettings(input.settings, auth);
    }),
    publish: publicProcedure.mutation(async ({ ctx }) => {
      const auth = await requireOwner(ctx.req);
      return publishDraft(auth);
    }),
    resetDraft: publicProcedure.mutation(async ({ ctx }) => {
      const auth = await requireOwner(ctx.req);
      return resetDraft(auth);
    })
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/apiApp.ts
function createApiApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  const health = (_req, res) => res.json({ status: "ok" });
  app.get(["/api/health", "/health"], health);
  const platformConfig = (_req, res) => {
    res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript());
  };
  app.get(["/api/platform/config.js", "/platform/config.js"], platformConfig);
  registerOAuthRoutes(app);
  const trpcMiddleware = createExpressMiddleware({ router: appRouter, createContext });
  app.use(["/api/trpc", "/trpc"], trpcMiddleware);
  return app;
}

// api/index.ts
var index_default = createApiApp();
export {
  index_default as default
};
