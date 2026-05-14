<script lang="ts" setup>
import AppHeader from "~/components/AppHeader.vue";
</script>
<template>
  <UApp>
    <AppHeader />
    <UMain>
      <slot />
    </UMain>
    <!--    <AppFooter />-->
  </UApp>
</template>

<style scoped></style>