<script setup lang="ts">
import AppAuthForm from "~/components/auth/AppAuthForm.vue";
import AppProfileForm from "~/components/auth/AppProfileForm.vue";
import AppDrawer from "~/components/drawer/AppDrawer.vue";
import AppDrawerActions from "~/components/drawer/AppDrawerActions.vue";
import AppDrawerHeader from "~/components/drawer/AppDrawerHeader.vue";

const route = useRoute();
const authDrawer = useAuthDrawer();
const authDrawerOpen = authDrawer.open;
const addLocationDrawerOpen = useAddLocationDrawer();
const { isSignedIn, logout, refreshSession, user } = useAuth();

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

async function signOut() {
  authDrawer.close();
  await logout();
}

onMounted(async () => {
  if (route.query.verified === "true" || route.query.profile === "true") {
    await refreshSession();
    authDrawer.show("profile");
  }
});
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

    <AppProfileForm v-if="showsProfile" />

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
      </AppDrawerActions>
    </template>
  </AppDrawer>
</template>
