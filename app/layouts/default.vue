<script lang="ts" setup>
import AppAuthDrawer from "~/components/auth/AppAuthDrawer.vue";
</script>
<template>
  <UApp class="min-h-dvh">
    <UMain>
      <slot />
    </UMain>
    <AppAuthDrawer />
  </UApp>
</template>

<style scoped></style>
