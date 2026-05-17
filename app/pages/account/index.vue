<script lang="ts" setup>
import type { AuthUser, UserRole } from "#shared/types/auth";

type UsersResponse = {
  users: AuthUser[];
};

const { user, isAdmin, isSignedIn, login, logout, register } = useAuth();

const mode = ref<"login" | "register">("login");
const isSubmitting = ref(false);
const isLoadingUsers = ref(false);
const authError = ref("");
const usersError = ref("");
const users = ref<AuthUser[]>([]);
const savingRoleFor = ref("");

const authForm = reactive({
  name: "",
  email: "",
  password: "",
});

const roleOptions = [
  { label: "User", value: "user" },
  { label: "Maintainer", value: "maintainer" },
  { label: "Administrator", value: "admin" },
] satisfies { label: string; value: UserRole }[];

const roleLabels: Record<UserRole, string> = {
  admin: "Administrator",
  maintainer: "Maintainer",
  user: "User",
};

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error &&
    "data" in error &&
    typeof error.data === "object" &&
    error.data &&
    "statusMessage" in error.data
  ) {
    return String(error.data.statusMessage);
  }

  return "Something went wrong. Please try again.";
}

async function submitAuth() {
  authError.value = "";
  isSubmitting.value = true;

  try {
    if (mode.value === "register") {
      await register({ ...authForm });
    } else {
      await login({
        email: authForm.email,
        password: authForm.password,
      });
    }
  } catch (error) {
    authError.value = getErrorMessage(error);
  } finally {
    isSubmitting.value = false;
  }
}

async function loadUsers() {
  if (!isAdmin.value) return;

  usersError.value = "";
  isLoadingUsers.value = true;

  try {
    const response = await $fetch<UsersResponse>("/api/auth/users");
    users.value = response.users;
  } catch (error) {
    usersError.value = getErrorMessage(error);
  } finally {
    isLoadingUsers.value = false;
  }
}

async function updateRole(targetUser: AuthUser, role: UserRole) {
  usersError.value = "";
  savingRoleFor.value = targetUser.id;

  try {
    const response = await $fetch<{ user: AuthUser }>(
      `/api/auth/users/${targetUser.id}`,
      {
        method: "PATCH",
        body: { role },
      },
    );
    const index = users.value.findIndex((item) => item.id === targetUser.id);

    if (index >= 0) {
      users.value[index] = response.user;
    }

    if (user.value?.id === response.user.id) {
      user.value = response.user;
    }
  } catch (error) {
    usersError.value = getErrorMessage(error);
  } finally {
    savingRoleFor.value = "";
  }
}

watch(isAdmin, (canAdmin) => {
  if (canAdmin) {
    void loadUsers();
  }
});

onMounted(() => {
  if (isAdmin.value) {
    void loadUsers();
  }
});
</script>

<template>
  <div class="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8 sm:px-6">
    <section class="flex flex-col gap-2">
      <p class="text-brand-600 text-sm font-semibold">Account</p>
      <h1 class="font-title text-3xl font-extrabold text-slate-950">
        PawPaths profile
      </h1>
    </section>

    <section
      v-if="!isSignedIn"
      class="grid gap-6 rounded-md border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[0.9fr_1.1fr]"
    >
      <div class="flex flex-col gap-3">
        <div class="flex gap-2">
          <UButton
            :variant="mode === 'login' ? 'solid' : 'subtle'"
            icon="i-lucide-log-in"
            label="Sign in"
            @click="mode = 'login'"
          />
          <UButton
            :variant="mode === 'register' ? 'solid' : 'subtle'"
            icon="i-lucide-user-plus"
            label="Create account"
            @click="mode = 'register'"
          />
        </div>
        <p class="text-sm leading-6 text-slate-600">
          Signed-in users can submit improvements and photos. Maintainers can
          review community changes, and administrators can manage roles.
        </p>
      </div>

      <form class="flex flex-col gap-4" @submit.prevent="submitAuth">
        <UFormField v-if="mode === 'register'" label="Name">
          <UInput
            v-model="authForm.name"
            autocomplete="name"
            icon="i-lucide-user"
            placeholder="Your name"
          />
        </UFormField>

        <UFormField label="Email">
          <UInput
            v-model="authForm.email"
            autocomplete="email"
            icon="i-lucide-mail"
            placeholder="you@example.com"
            required
            type="email"
          />
        </UFormField>

        <UFormField label="Password">
          <UInput
            v-model="authForm.password"
            autocomplete="current-password"
            icon="i-lucide-lock"
            placeholder="At least 10 characters"
            required
            type="password"
          />
        </UFormField>

        <UAlert
          v-if="authError"
          :title="authError"
          color="error"
          icon="i-lucide-circle-alert"
          variant="soft"
        />

        <UButton
          :label="mode === 'register' ? 'Create account' : 'Sign in'"
          :loading="isSubmitting"
          block
          icon="i-lucide-arrow-right"
          type="submit"
        />
      </form>
    </section>

    <section
      v-else
      class="flex flex-col gap-5 rounded-md border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div
        class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 class="font-title text-2xl font-extrabold text-slate-950">
            {{ user?.name }}
          </h2>
          <p class="text-sm text-slate-600">{{ user?.email }}</p>
        </div>

        <div class="flex items-center gap-3">
          <UBadge color="neutral" variant="soft">
            {{ user ? roleLabels[user.role] : "" }}
          </UBadge>
          <UButton
            color="neutral"
            icon="i-lucide-log-out"
            label="Sign out"
            variant="subtle"
            @click="logout"
          />
        </div>
      </div>
    </section>

    <section v-if="isAdmin" class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h2 class="font-title text-2xl font-extrabold text-slate-950">
            User roles
          </h2>
          <p class="text-sm text-slate-600">
            Administrators can promote trusted reviewers to maintainer.
          </p>
        </div>
        <UButton
          :loading="isLoadingUsers"
          icon="i-lucide-refresh-cw"
          variant="subtle"
          @click="loadUsers"
        />
      </div>

      <UAlert
        v-if="usersError"
        :title="usersError"
        color="error"
        icon="i-lucide-circle-alert"
        variant="soft"
      />

      <div class="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div
          v-for="account in users"
          :key="account.id"
          class="grid gap-4 border-b border-slate-100 p-4 last:border-b-0 sm:grid-cols-[1fr_12rem]"
        >
          <div class="min-w-0">
            <p class="truncate font-semibold text-slate-950">
              {{ account.name }}
            </p>
            <p class="truncate text-sm text-slate-600">{{ account.email }}</p>
          </div>

          <USelect
            :disabled="savingRoleFor === account.id"
            :items="roleOptions"
            :loading="savingRoleFor === account.id"
            :model-value="account.role"
            @update:model-value="updateRole(account, $event as UserRole)"
          />
        </div>
      </div>
    </section>
  </div>
</template>
