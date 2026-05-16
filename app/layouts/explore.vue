<script lang="ts" setup>
import AppHeader from "~/components/AppHeader.vue";
</script>
<template>
  <UApp class="min-h-dvh">
    <AppHeader is-explore />
    <UMain class="pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
      <slot />
    </UMain>
    <AppFooter />
  </UApp>
</template>

<style scoped></style>
