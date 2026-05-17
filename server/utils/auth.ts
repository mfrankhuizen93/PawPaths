import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { type Db, ObjectId } from "mongodb";
import { type AuthUser, type UserRole, userRoles } from "#shared/types/auth";
import {
  createError,
  deleteCookie,
  getCookie,
  type H3Event,
  setCookie,
} from "h3";
import { getDb } from "./mongodb.js";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "pawpaths_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const PASSWORD_KEY_LENGTH = 64;

type UserDocument = {
  _id: ObjectId;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
};

type SessionDocument = {
  _id: ObjectId;
  userId: ObjectId;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
};

let indexesReady: Promise<void> | null = null;

function normalizeEmail(email: unknown) {
  return String(email ?? "")
    .trim()
    .toLowerCase();
}

function normalizeName(name: unknown, email: string) {
  const value = String(name ?? "").trim();
  return value || email.split("@")[0] || "PawPaths user";
}

function getAdminEmails() {
  return new Set(
    String(process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function toAuthUser(user: UserDocument): AuthUser {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

async function ensureAuthIndexes(db: Db) {
  if (!indexesReady) {
    indexesReady = Promise.all([
      db.collection("users").createIndex({ email: 1 }, { unique: true }),
      db.collection("sessions").createIndex({ tokenHash: 1 }, { unique: true }),
      db
        .collection("sessions")
        .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db.collection("sessions").createIndex({ userId: 1 }),
    ]).then(() => undefined);
  }

  await indexesReady;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(
    password,
    salt,
    PASSWORD_KEY_LENGTH,
  )) as Buffer;

  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, salt, key] = passwordHash.split(":");

  if (algorithm !== "scrypt" || !salt || !key) return false;

  const storedKey = Buffer.from(key, "hex");
  const derivedKey = (await scrypt(password, salt, storedKey.length)) as Buffer;

  return (
    storedKey.length === derivedKey.length &&
    timingSafeEqual(storedKey, derivedKey)
  );
}

export function validateAuthInput(email: unknown, password: unknown) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = String(password ?? "");

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Please enter a valid email address.",
    });
  }

  if (normalizedPassword.length < 10) {
    throw createError({
      statusCode: 400,
      statusMessage: "Passwords must be at least 10 characters.",
    });
  }

  return { email: normalizedEmail, password: normalizedPassword };
}

export async function registerUser(input: {
  email: unknown;
  password: unknown;
  name?: unknown;
}) {
  const db = await getDb();
  await ensureAuthIndexes(db);

  const { email, password } = validateAuthInput(input.email, input.password);
  const now = new Date();
  const users = db.collection<UserDocument>("users");
  const existingUserCount = await users.countDocuments({}, { limit: 1 });
  const adminEmails = getAdminEmails();
  const role: UserRole =
    adminEmails.has(email) || existingUserCount === 0 ? "admin" : "user";

  try {
    const result = await users.insertOne({
      _id: new ObjectId(),
      email,
      name: normalizeName(input.name, email),
      role,
      passwordHash: await hashPassword(password),
      createdAt: now,
      updatedAt: now,
    });

    const user = await users.findOne({ _id: result.insertedId });
    if (!user) throw new Error("User was not created.");

    return toAuthUser(user);
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error &&
      "code" in error &&
      error.code === 11000
    ) {
      throw createError({
        statusCode: 409,
        statusMessage: "An account already exists for this email.",
      });
    }

    throw error;
  }
}

export async function loginUser(emailInput: unknown, passwordInput: unknown) {
  const db = await getDb();
  await ensureAuthIndexes(db);

  const email = normalizeEmail(emailInput);
  const password = String(passwordInput ?? "");
  const user = await db.collection<UserDocument>("users").findOne({ email });

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw createError({
      statusCode: 401,
      statusMessage: "Email or password is incorrect.",
    });
  }

  return toAuthUser(user);
}

export async function createUserSession(event: H3Event, userId: string) {
  const db = await getDb();
  await ensureAuthIndexes(db);

  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);

  await db.collection<SessionDocument>("sessions").insertOne({
    _id: new ObjectId(),
    userId: new ObjectId(userId),
    tokenHash: hashToken(token),
    createdAt: now,
    expiresAt,
  });

  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: isProduction(),
  });
}

export async function clearUserSession(event: H3Event) {
  const token = getCookie(event, SESSION_COOKIE);

  if (token) {
    const db = await getDb();
    await db.collection<SessionDocument>("sessions").deleteOne({
      tokenHash: hashToken(token),
    });
  }

  deleteCookie(event, SESSION_COOKIE, { path: "/" });
}

export async function getCurrentUser(event: H3Event) {
  const token = getCookie(event, SESSION_COOKIE);
  if (!token) return null;

  const db = await getDb();
  await ensureAuthIndexes(db);

  const session = await db.collection<SessionDocument>("sessions").findOne({
    tokenHash: hashToken(token),
    expiresAt: { $gt: new Date() },
  });

  if (!session) {
    deleteCookie(event, SESSION_COOKIE, { path: "/" });
    return null;
  }

  const user = await db.collection<UserDocument>("users").findOne({
    _id: session.userId,
  });

  return user ? toAuthUser(user) : null;
}

export async function requireCurrentUser(event: H3Event) {
  const user = await getCurrentUser(event);

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: "Please sign in to continue.",
    });
  }

  return user;
}

export function hasRole(user: AuthUser, allowedRoles: UserRole[]) {
  return allowedRoles.includes(user.role);
}

export async function requireRole(event: H3Event, allowedRoles: UserRole[]) {
  const user = await requireCurrentUser(event);

  if (!hasRole(user, allowedRoles)) {
    throw createError({
      statusCode: 403,
      statusMessage: "You do not have permission to do that.",
    });
  }

  return user;
}

export async function listUsers(event: H3Event) {
  await requireRole(event, ["admin"]);

  const db = await getDb();
  await ensureAuthIndexes(db);

  const users = await db
    .collection<UserDocument>("users")
    .find({}, { projection: { passwordHash: 0 } })
    .sort({ createdAt: -1 })
    .toArray();

  return users.map((user) => toAuthUser(user as UserDocument));
}

export async function updateUserRole(
  event: H3Event,
  userId: string,
  role: unknown,
) {
  const admin = await requireRole(event, ["admin"]);

  if (!userRoles.includes(role as UserRole)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Unknown role.",
    });
  }

  if (admin.id === userId && role !== "admin") {
    throw createError({
      statusCode: 400,
      statusMessage: "You cannot remove your own administrator role.",
    });
  }

  if (!ObjectId.isValid(userId)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Unknown user.",
    });
  }

  const db = await getDb();
  const result = await db
    .collection<UserDocument>("users")
    .findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { $set: { role: role as UserRole, updatedAt: new Date() } },
      { returnDocument: "after" },
    );

  if (!result) {
    throw createError({
      statusCode: 404,
      statusMessage: "User not found.",
    });
  }

  return toAuthUser(result);
}
