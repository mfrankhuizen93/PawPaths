<script lang="ts" setup>
import AppHeader from "~/components/AppHeader.vue";
import AppFooter from "~/components/AppFooter.vue";
</script>
<template>
  <UApp>
    <AppHeader />
    <UMain>
      <slot />
    </UMain>
    <AppFooter />
  </UApp>
</template>

<style scoped></style>