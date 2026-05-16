<script lang="ts" setup>
import { headerNavigationItems } from "~/navigation/items";
import { useExploreQuery } from "~/composables/states";

defineProps({
  isExplore: {
    type: Boolean,
    default: false,
  },
});

defineEmits(["search"]);

const activeFilters = useExploreQuery();
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
        v-model="activeFilters.q"
        :ui="{ trailing: 'pe-1' }"
        icon="i-lucide-search"
        placeholder="Search for places, areas..."
      >
        <template v-if="activeFilters.q?.length" #trailing>
          <UButton
            aria-label="Clear input"
            color="neutral"
            icon="i-lucide-circle-x"
            size="sm"
            variant="link"
            @click="activeFilters.q = ''"
          />
        </template>
      </UInput>

      <USlideover close-icon="i-lucide-arrow-right" title="Filter locations">
        <UButton icon="i-lucide-sliders" label="Filters" variant="subtle" />

        <template #body>
          <AppLocationFilters v-model="activeFilters" />
        </template>
      </USlideover>

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
