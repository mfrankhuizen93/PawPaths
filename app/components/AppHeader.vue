<script lang="ts" setup></script>

<template>
  <UHeader>
    <template #title>
      <div class="app-title">
        <AppLogo class="app-title__logo" />
        <h1>PawPaths</h1>
      </div>
    </template>
  </UHeader>
</template>

<style scoped>
.app-title {
  @apply flex items-center gap-2;

  .app-title__logo {
    @apply h-6 w-auto;
  }

  h1 {
    @apply text-brand-500 font-title;
  }
}
</style>
