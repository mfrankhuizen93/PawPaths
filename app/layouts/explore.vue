<script lang="ts" setup>
import AppAuthDrawer from "~/components/auth/AppAuthDrawer.vue";
</script>

<template>
  <UApp
    class="h-dvh overflow-hidden"
    :toaster="{ position: 'top-center', expand: false }"
  >
    <UMain class="h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
      <slot />
    </UMain>
    <AppFooter />
    <AppAuthDrawer />
  </UApp>
</template>
