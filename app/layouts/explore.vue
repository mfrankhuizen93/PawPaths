<script lang="ts" setup>
import AppHeader from "~/components/AppHeader.vue";
import AppAuthDrawer from "~/components/auth/AppAuthDrawer.vue";
</script>
<template>
  <UApp class="min-h-dvh">
    <AppHeader is-explore />
    <UMain
      class="h-[calc(100vh-var(--ui-header-height))] pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0"
    >
      <slot />
    </UMain>
    <AppFooter />
    <AppAuthDrawer />
  </UApp>
</template>

<style scoped></style>
