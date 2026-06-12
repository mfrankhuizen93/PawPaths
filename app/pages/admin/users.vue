<script lang="ts" setup>
import type { AuthUser, UserRole } from "#shared/types/auth";
import AppPageHeader from "~/components/common/AppPageHeader.vue";
import AppPageToolbar from "~/components/common/AppPageToolbar.vue";
import UserRoleDrawer from "~/components/users/UserRoleDrawer.vue";
import UserRolesTable from "~/components/users/UserRolesTable.vue";

definePageMeta({
  middleware: "admin",
});

type UsersResponse = {
  users: AuthUser[];
};

const { user, isAdmin, isSignedIn } = useAuth();
const authDrawer = useAuthDrawer();
const usersError = ref("");
const users = ref<AuthUser[]>([]);
const isLoadingUsers = ref(false);
const savingRoleFor = ref("");
const selectedUser = ref<AuthUser | null>(null);
const isUserDrawerOpen = computed({
  get: () => Boolean(selectedUser.value),
  set: (open) => {
    if (!open) selectedUser.value = null;
  },
});

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
    if (selectedUser.value?.id === response.user.id) {
      selectedUser.value = response.user;
    }
  } catch (error) {
    usersError.value = getErrorMessage(error);
  } finally {
    savingRoleFor.value = "";
  }
}

function openUser(account: AuthUser) {
  selectedUser.value = account;
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
  <AppPageToolbar>
    <template v-if="isAdmin" #actions>
      <UButton
        :loading="isLoadingUsers"
        aria-label="Refresh users"
        class="border-default/60 bg-default/88 size-12 justify-center rounded-2xl border p-0 shadow-lg backdrop-blur-xl"
        color="neutral"
        icon="i-lucide-refresh-cw"
        size="lg"
        square
        variant="ghost"
        @click="loadUsers"
      />
    </template>
  </AppPageToolbar>

  <div class="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
    <AppPageHeader
      :badge="isAdmin ? users.length : undefined"
      description="Promote trusted reviewers or change account roles."
      eyebrow="Administration"
      title="Users"
    />

    <UAlert
      v-if="!isSignedIn"
      title="Sign in to access administration."
      color="warning"
      icon="i-lucide-lock"
      variant="soft"
    >
      <template #actions>
        <UButton
          icon="i-lucide-log-in"
          label="Sign in"
          @click="authDrawer.show('profile')"
        />
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
      <UAlert
        v-if="usersError"
        :title="usersError"
        color="error"
        icon="i-lucide-circle-alert"
        variant="soft"
      />

      <UserRolesTable
        :loading="isLoadingUsers"
        :users="users"
        @select-user="openUser"
      />
    </section>

    <UserRoleDrawer
      v-model:open="isUserDrawerOpen"
      :role-options="roleOptions"
      :saving="savingRoleFor === selectedUser?.id"
      :user="selectedUser"
      @update-role="updateRole"
    />
  </div>
</template>
