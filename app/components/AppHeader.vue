<script lang="ts" setup>
import { headerNavigationItems } from "~/navigation/items";
import { useTextSearch } from "~/composables/states";

defineProps({
  isExplore: {
    type: Boolean,
    default: false,
  },
});

defineEmits(["search"]);

const searchQuery = useTextSearch();
</script>

<template>
  <UHeader mode="drawer">
    <template #title>
      <div class="app-title">
        <AppLogo class="app-title__logo" />
        <h1 v-if="!isExplore">PawPaths</h1>
      </div>
    </template>

    <template #right>
      <UInput
        v-model="searchQuery"
        icon="i-lucide-search"
        placeholder="Search for places, areas..."
      />

      <UButton icon="i-lucide-sliders" label="Filters" variant="subtle" />

      <UColorModeButton v-if="!isExplore" />
    </template>

    <template #body>
      <UNavigationMenu
        :items="headerNavigationItems"
        class="w-full"
        orientation="vertical"
      />
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
