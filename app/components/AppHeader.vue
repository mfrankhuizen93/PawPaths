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

      <UButton
        :avatar="
          isSignedIn
            ? {
                alt: user?.name,
                text: user?.name?.slice(0, 1),
              }
            : undefined
        "
        :icon="isSignedIn ? undefined : 'i-lucide-circle-user-round'"
        :label="isSignedIn ? undefined : 'Account'"
        to="/account"
        variant="subtle"
      />
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
