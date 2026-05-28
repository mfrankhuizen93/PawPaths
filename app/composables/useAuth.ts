import { createAuthClient } from "better-auth/vue";
import { authClient } from "~/utils/auth-client";
import type {
  AuthUser,
  NavigationAppPreference,
  UserRole,
} from "#shared/types/auth";

type BetterAuthResult<T> = {
  data: T | null;
  error: {
    message?: string;
    status?: number;
    statusText?: string;
  } | null;
};

type BetterAuthSession = {
  user: Partial<AuthUser> & {
    id: string;
    email: string;
    name: string;
    image?: string | null;
    role?: string | null;
  };
  session: unknown;
};

function getRequestAuthClient() {
  if (import.meta.client) return authClient;

  const url = useRequestURL();
  const headers = useRequestHeaders(["cookie"]);

  return createAuthClient({
    baseURL: url.origin,
    fetchOptions: { headers },
  });
}

function toAuthUser(user: BetterAuthSession["user"]): AuthUser {
  const role = ["admin", "maintainer", "user"].includes(String(user.role))
    ? (user.role as UserRole)
    : "user";

  return {
    id: user.id,
    email: user.email,
    emailVerified: Boolean(user.emailVerified),
    name: user.name,
    image: user.image ?? null,
    role,
    navigationAppPreference: ["apple", "google", "waze", "device"].includes(
      String(user.navigationAppPreference),
    )
      ? (user.navigationAppPreference as NavigationAppPreference)
      : "device",
    createdAt: String(user.createdAt ?? new Date().toISOString()),
    updatedAt: String(user.updatedAt ?? new Date().toISOString()),
  };
}

function assertAuthResult<T>(result: BetterAuthResult<T>) {
  if (result.error) {
    throw new Error(result.error.message ?? "Authentication failed.");
  }

  return result.data;
}

export function useAuth() {
  const user = useState<AuthUser | null>("auth:user", () => null);
  const isLoaded = useState("auth:is-loaded", () => false);

  const isSignedIn = computed(() => Boolean(user.value));
  const isAdmin = computed(() => user.value?.role === "admin");
  const isMaintainer = computed(
    () => user.value?.role === "admin" || user.value?.role === "maintainer",
  );

  async function refreshSession() {
    try {
      const response = await $fetch<{ user: AuthUser }>("/api/auth/profile");
      user.value = response.user;
      isLoaded.value = true;

      return user.value;
    } catch {
      // Fall back to Better Auth so auth errors still surface consistently.
    }

    const result =
      (await getRequestAuthClient().getSession()) as BetterAuthResult<BetterAuthSession | null>;
    const session = assertAuthResult(result);
    user.value = session?.user ? toAuthUser(session.user) : null;
    isLoaded.value = true;

    return user.value;
  }

  async function register(payload: {
    email: string;
    password: string;
    name?: string;
    image?: string | null;
    navigationAppPreference?: NavigationAppPreference;
  }) {
    const result = (await getRequestAuthClient().signUp.email({
      name: payload.name?.trim() || payload.email,
      email: payload.email,
      password: payload.password,
      image: payload.image ?? undefined,
      navigationAppPreference: payload.navigationAppPreference ?? "device",
      callbackURL: "/account?verified=true",
    })) as BetterAuthResult<unknown>;

    assertAuthResult(result);
    await refreshSession();

    if (user.value && payload.navigationAppPreference) {
      const response = await $fetch<{ user: AuthUser }>("/api/auth/profile", {
        method: "PATCH",
        body: {
          navigationAppPreference: payload.navigationAppPreference,
        },
      });
      user.value = response.user;
    }

    return user.value;
  }

  async function updateProfile(payload: {
    name?: string;
    image?: string | null;
    navigationAppPreference?: NavigationAppPreference;
  }) {
    const result = (await getRequestAuthClient().updateUser({
      name: payload.name,
      image: payload.image,
    })) as BetterAuthResult<unknown>;

    assertAuthResult(result);

    if (payload.navigationAppPreference) {
      const response = await $fetch<{ user: AuthUser }>("/api/auth/profile", {
        method: "PATCH",
        body: {
          navigationAppPreference: payload.navigationAppPreference,
        },
      });
      user.value = response.user;
      isLoaded.value = true;
      return user.value;
    }

    return await refreshSession();
  }

  async function login(payload: { email: string; password: string }) {
    const result = (await getRequestAuthClient().signIn.email({
      email: payload.email,
      password: payload.password,
      callbackURL: "/account",
    })) as BetterAuthResult<unknown>;

    assertAuthResult(result);
    return await refreshSession();
  }

  async function logout() {
    const result =
      (await getRequestAuthClient().signOut()) as BetterAuthResult<unknown>;
    assertAuthResult(result);

    user.value = null;
    isLoaded.value = true;
    await navigateTo("/account");
  }

  async function sendVerificationEmail(email: string) {
    const result = (await getRequestAuthClient().sendVerificationEmail({
      email,
      callbackURL: "/account?verified=true",
    })) as BetterAuthResult<unknown>;

    return assertAuthResult(result);
  }

  async function requestPasswordReset(email: string) {
    const result = (await getRequestAuthClient().requestPasswordReset({
      email,
      redirectTo: "/account/reset",
    })) as BetterAuthResult<unknown>;

    return assertAuthResult(result);
  }

  async function resetPassword(payload: { token: string; password: string }) {
    const result = (await getRequestAuthClient().resetPassword({
      token: payload.token,
      newPassword: payload.password,
    })) as BetterAuthResult<unknown>;

    return assertAuthResult(result);
  }

  return {
    user,
    isLoaded,
    isSignedIn,
    isAdmin,
    isMaintainer,
    refreshSession,
    register,
    updateProfile,
    login,
    logout,
    sendVerificationEmail,
    requestPasswordReset,
    resetPassword,
  };
}
