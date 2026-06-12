<script setup lang="ts">
import type { UserRole } from "#shared/types/auth";
import AppAuthForm from "~/components/auth/AppAuthForm.vue";
import AppDrawer from "~/components/drawer/AppDrawer.vue";
import AppDrawerActions from "~/components/drawer/AppDrawerActions.vue";
import AppDrawerHeader from "~/components/drawer/AppDrawerHeader.vue";

const router = useRouter();
const authDrawer = useAuthDrawer();
const authDrawerOpen = authDrawer.open;
const addLocationDrawerOpen = useAddLocationDrawer();
const { isSignedIn, logout, user } = useAuth();

const roleLabels: Record<UserRole, string> = {
  admin: "Administrator",
  maintainer: "Maintainer",
  user: "User",
};

const showsProfile = computed(
  () => authDrawer.intent.value === "profile" && isSignedIn.value,
);
const drawerTitle = computed(() =>
  showsProfile.value ? "Profile" : "Sign in to PawPaths",
);

const initials = computed(() => {
  const label = user.value?.name?.trim() || user.value?.email?.trim() || "?";

  return label
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
});

async function continueIntent() {
  const intent = authDrawer.intent.value;

  if (intent === "add") {
    authDrawer.close();
    addLocationDrawerOpen.value = true;
  }
}

async function openAccount() {
  authDrawer.close();
  await router.push("/account");
}

async function signOut() {
  authDrawer.close();
  await logout();
}
</script>

<template>
  <AppDrawer v-model:open="authDrawerOpen" :title="drawerTitle">
    <template #header>
      <AppDrawerHeader
        :description="
          showsProfile
            ? user?.email
            : 'Access community features and your PawPaths profile.'
        "
        eyebrow="Account"
        :title="drawerTitle"
      >
        <template v-if="showsProfile" #leading>
          <UAvatar
            :alt="user?.name || 'Profile'"
            size="xl"
            :src="user?.image || undefined"
            :text="initials"
          />
        </template>
      </AppDrawerHeader>
    </template>

    <div v-if="showsProfile" class="flex flex-col gap-4">
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="border-default rounded-md border p-4">
          <p class="text-muted text-sm">Display name</p>
          <p class="text-highlighted mt-1 font-medium">
            {{ user?.name }}
          </p>
        </div>
        <div class="border-default rounded-md border p-4">
          <p class="text-muted text-sm">Access</p>
          <p class="text-highlighted mt-1 font-medium">
            {{ user ? roleLabels[user.role] : "" }}
          </p>
        </div>
      </div>

      <UAlert
        :color="user?.emailVerified ? 'success' : 'warning'"
        :description="
          user?.emailVerified
            ? 'Your email address is verified.'
            : 'Verify your email address from your account settings.'
        "
        :icon="
          user?.emailVerified ? 'i-lucide-badge-check' : 'i-lucide-circle-alert'
        "
        :title="user?.emailVerified ? 'Verified account' : 'Email not verified'"
        variant="soft"
      />
    </div>

    <AppAuthForm v-else @authenticated="continueIntent" />

    <template v-if="showsProfile" #actions>
      <AppDrawerActions>
        <UButton
          color="neutral"
          icon="i-lucide-log-out"
          label="Sign out"
          variant="ghost"
          @click="signOut"
        />
        <UButton
          icon="i-lucide-settings"
          label="Manage profile"
          @click="openAccount"
        />
      </AppDrawerActions>
    </template>
  </AppDrawer>
</template>
