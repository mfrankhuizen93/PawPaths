<script lang="ts" setup>
import AppHeader from "~/components/AppHeader.vue";
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
  </UApp>
</template>

<style scoped></style>
