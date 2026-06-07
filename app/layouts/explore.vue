<script lang="ts" setup>
import AppAuthDrawer from "~/components/auth/AppAuthDrawer.vue";
</script>

<template>
  <UApp class="h-dvh overflow-hidden">
    <UMain class="h-dvh">
      <slot />
    </UMain>
    <AppAuthDrawer />
  </UApp>
</template>
