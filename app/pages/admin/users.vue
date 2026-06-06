<script lang="ts" setup>
import type { AuthUser, UserRole } from "#shared/types/auth";

definePageMeta({
  middleware: "admin",
});

type UsersResponse = {
  users: AuthUser[];
};

const { user, isAdmin, isSignedIn } = useAuth();
const usersError = ref("");
const users = ref<AuthUser[]>([]);
const isLoadingUsers = ref(false);
const savingRoleFor = ref("");

const roleOptions = [
  { label: "User", value: "user" },
  { label: "Maintainer", value: "maintainer" },
  { label: "Administrator", value: "admin" },
] satisfies { label: string; value: UserRole }[];

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

  if (error instanceof Error) return error.message;

  return "Something went wrong. Please try again.";
}

function getInitials(name: string | undefined, email: string | undefined) {
  const label = name?.trim() || email?.trim() || "?";

  return label
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
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

    if (index >= 0) users.value[index] = response.user;

    if (user.value?.id === response.user.id) user.value = response.user;
  } catch (error) {
    usersError.value = getErrorMessage(error);
  } finally {
    savingRoleFor.value = "";
  }
}

watch(
  isAdmin,
  (canAdmin) => {
    if (canAdmin) void loadUsers();
  },
  { immediate: true },
);
</script>

<template>
  <div class="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
    <section class="flex flex-col gap-2">
      <p class="text-brand-600 text-sm font-semibold">Administration</p>
      <h1 class="font-title text-3xl font-extrabold text-slate-950">Users</h1>
      <p class="max-w-2xl text-sm leading-6 text-slate-600">
        Promote trusted reviewers or change account roles.
      </p>
    </section>

    <UAlert
      v-if="!isSignedIn"
      title="Sign in to access administration."
      color="warning"
      icon="i-lucide-lock"
      variant="soft"
    >
      <template #actions>
        <UButton label="Go to account" to="/account" />
      </template>
    </UAlert>

    <UAlert
      v-else-if="!isAdmin"
      title="Only administrators can manage users."
      color="error"
      icon="i-lucide-shield-alert"
      variant="soft"
    />

    <section v-else class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h2 class="font-title text-2xl font-extrabold text-slate-950">
            User accounts
          </h2>
          <p class="text-sm text-slate-600">
            Assign the appropriate access level to each account.
          </p>
        </div>
        <UButton
          :loading="isLoadingUsers"
          aria-label="Refresh users"
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

      <UCard :ui="{ body: 'divide-y divide-slate-100 p-0 sm:p-0' }">
        <div
          v-for="account in users"
          :key="account.id"
          class="grid gap-4 p-4 sm:grid-cols-[1fr_12rem] sm:items-center"
        >
          <div class="flex min-w-0 items-center gap-3">
            <UAvatar
              :alt="account.name"
              :src="account.image || undefined"
              :text="getInitials(account.name, account.email)"
            />
            <div class="min-w-0">
              <p class="truncate font-semibold text-slate-950">
                {{ account.name }}
              </p>
              <p class="truncate text-sm text-slate-600">
                {{ account.email }}
              </p>
            </div>
          </div>

          <USelect
            :disabled="savingRoleFor === account.id"
            :items="roleOptions"
            :loading="savingRoleFor === account.id"
            :model-value="account.role"
            @update:model-value="updateRole(account, $event as UserRole)"
          />
        </div>
      </UCard>
    </section>
  </div>
</template>
