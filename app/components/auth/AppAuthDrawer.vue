<script setup lang="ts">
import AppAuthForm from "~/components/auth/AppAuthForm.vue";
import AppDrawer from "~/components/drawer/AppDrawer.vue";
import AppDrawerHeader from "~/components/drawer/AppDrawerHeader.vue";

const router = useRouter();
const authDrawer = useAuthDrawer();
const authDrawerOpen = authDrawer.open;
const addLocationDrawerOpen = useAddLocationDrawer();

async function continueIntent() {
  const intent = authDrawer.intent.value;
  authDrawer.close();

  if (intent === "add") {
    addLocationDrawerOpen.value = true;
  } else if (intent === "profile") {
    await router.push("/account");
  }
}
</script>

<template>
  <AppDrawer v-model:open="authDrawerOpen" title="Sign in to PawPaths">
    <template #header>
      <AppDrawerHeader
        description="Access community features and your PawPaths profile."
        eyebrow="Account"
        title="Sign in to PawPaths"
      />
    </template>

    <AppAuthForm @authenticated="continueIntent" />
  </AppDrawer>
</template>
