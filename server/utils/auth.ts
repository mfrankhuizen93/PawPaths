import { type Db, MongoClient, ObjectId } from "mongodb";
import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { dash } from "@better-auth/infra";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { createError, type H3Event, toWebRequest } from "h3";
import { type AuthUser, type UserRole, userRoles } from "#shared/types/auth";
import { getMongoConfig } from "./mongodb.js";
import { sendAuthEmail } from "./email.js";

const { uri, dbName } = getMongoConfig();
const mongoClient = new MongoClient(uri);
const authDb = mongoClient.db(dbName);

type BetterAuthUserDocument = {
  _id?: ObjectId | string;
  id?: string;
  email: string;
  emailVerified?: boolean;
  name: string;
  role?: UserRole | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
};

function getAdminEmails() {
  return new Set(
    String(process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function getUrlHost(url: string | undefined) {
  if (!url) return null;

  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function getFallbackAuthUrl() {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  return "http://localhost:3000";
}

function getAuthAllowedHosts() {
  return [
    "localhost:3000",
    "127.0.0.1:3000",
    "*.vercel.app",
    getUrlHost(process.env.BETTER_AUTH_URL),
    process.env.VERCEL_URL,
  ].filter((host): host is string => Boolean(host));
}

function getSocialProviders() {
  const providers: Record<string, { clientId: string; clientSecret: string }> =
    {};

  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    providers.github = {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    };
  }

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.google = {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    };
  }

  if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
    providers.discord = {
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
    };
  }

  return Object.keys(providers).length ? providers : undefined;
}

function getAuthPlugins() {
  const plugins = [
    admin({
      defaultRole: "user",
      adminRoles: ["admin"],
    }),
  ];

  if (process.env.BETTER_AUTH_API_KEY) {
    plugins.push(
      dash({
        apiKey: process.env.BETTER_AUTH_API_KEY,
        apiUrl: process.env.BETTER_AUTH_API_URL,
        kvUrl: process.env.BETTER_AUTH_KV_URL,
      }),
    );
  }

  return plugins;
}

function toDateString(value: Date | string | undefined) {
  if (!value) return new Date().toISOString();
  return value instanceof Date ? value.toISOString() : value;
}

function toMongoId(id: string) {
  return ObjectId.isValid(id) ? new ObjectId(id) : id;
}

function toAuthUser(user: BetterAuthUserDocument): AuthUser {
  const role = userRoles.includes(user.role as UserRole)
    ? (user.role as UserRole)
    : "user";

  return {
    id: user.id ?? user._id?.toString() ?? "",
    email: user.email,
    emailVerified: Boolean(user.emailVerified),
    name: user.name,
    role,
    createdAt: toDateString(user.createdAt),
    updatedAt: toDateString(user.updatedAt),
  };
}

async function getBetterAuthUserCollection(db: Db = authDb) {
  await db.collection("user").createIndex({ email: 1 }, { unique: true });
  return db.collection<BetterAuthUserDocument>("user");
}

export const auth = betterAuth({
  appName: "PawPaths",
  baseURL: {
    allowedHosts: getAuthAllowedHosts(),
    fallback: getFallbackAuthUrl(),
  },
  secret: process.env.BETTER_AUTH_SECRET,
  database: mongodbAdapter(authDb, {
    client: mongoClient,
    transaction: false,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendAuthEmail({
        to: user.email,
        subject: "Reset your PawPaths password",
        text: `Reset your PawPaths password by opening this link:\n${url}\n\nIf you did not request this, you can ignore this email.`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      await sendAuthEmail({
        to: user.email,
        subject: "Verify your PawPaths email",
        text: `Welcome to PawPaths.\n\nVerify your email address by opening this link:\n${url}\n\nThis link expires in 24 hours.`,
      });
    },
  },
  socialProviders: getSocialProviders(),
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const users = await getBetterAuthUserCollection();
          const existingUser = await users.findOne(
            {},
            { projection: { _id: 1 } },
          );
          const adminEmails = getAdminEmails();
          const role =
            adminEmails.has(String(user.email).toLowerCase()) || !existingUser
              ? "admin"
              : "user";

          return {
            data: {
              ...user,
              role,
            },
          };
        },
      },
    },
  },
  plugins: getAuthPlugins(),
});

export async function getCurrentUser(event: H3Event) {
  const session = await auth.api.getSession({
    headers: toWebRequest(event).headers,
  });

  return session?.user
    ? toAuthUser(session.user as BetterAuthUserDocument)
    : null;
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

  const users = await (await getBetterAuthUserCollection())
    .find({})
    .sort({ createdAt: -1 })
    .toArray();

  return users.map(toAuthUser);
}

export async function updateUserRole(
  event: H3Event,
  userId: string,
  role: unknown,
) {
  const adminUser = await requireRole(event, ["admin"]);

  if (!userRoles.includes(role as UserRole)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Unknown role.",
    });
  }

  if (adminUser.id === userId && role !== "admin") {
    throw createError({
      statusCode: 400,
      statusMessage: "You cannot remove your own administrator role.",
    });
  }

  const result = await (
    await getBetterAuthUserCollection()
  ).findOneAndUpdate(
    { _id: toMongoId(userId) },
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
