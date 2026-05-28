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
const { user, isSignedIn } = useAuth();
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
      <UDrawer
        v-if="isExplore"
        description="Refine your search by location, type, and more."
        direction="right"
        title="Filter locations"
      >
        <UButton icon="i-lucide-sliders" label="Filters" variant="subtle" />

        <template #body>
          <AppLocationFilters v-model="activeFilters" />
        </template>
      </UDrawer>

      <UColorModeButton v-if="!isExplore" />
    </template>

    <UNavigationMenu
      :items="headerNavigationItems"
      :ui="{
        link: 'gap-1.5',
        linkLeadingIcon: 'size-4',
      }"
    />

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
