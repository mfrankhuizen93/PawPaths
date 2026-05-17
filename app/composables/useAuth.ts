import type { AuthUser } from "#shared/types/auth";

type AuthResponse = {
  user: AuthUser | null;
};

export function useAuth() {
  const user = useState<AuthUser | null>("auth:user", () => null);
  const isLoaded = useState("auth:is-loaded", () => false);

  const isSignedIn = computed(() => Boolean(user.value));
  const isAdmin = computed(() => user.value?.role === "admin");
  const isMaintainer = computed(
    () => user.value?.role === "admin" || user.value?.role === "maintainer",
  );

  async function refreshSession() {
    const response = await $fetch<AuthResponse>("/api/auth/session");
    user.value = response.user;
    isLoaded.value = true;

    return response.user;
  }

  async function register(payload: {
    email: string;
    password: string;
    name?: string;
  }) {
    const response = await $fetch<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: payload,
    });
    user.value = response.user;
    isLoaded.value = true;

    return response.user;
  }

  async function login(payload: { email: string; password: string }) {
    const response = await $fetch<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: payload,
    });
    user.value = response.user;
    isLoaded.value = true;

    return response.user;
  }

  async function logout() {
    await $fetch("/api/auth/logout", { method: "POST" });
    user.value = null;
    isLoaded.value = true;
    await navigateTo("/account");
  }

  return {
    user,
    isLoaded,
    isSignedIn,
    isAdmin,
    isMaintainer,
    refreshSession,
    register,
    login,
    logout,
  };
}
