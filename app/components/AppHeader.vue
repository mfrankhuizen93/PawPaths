<script lang="ts" setup>
import {
  getAdminNavigationItems,
  headerNavigationItems,
} from "~/navigation/items";
import { useExploreQuery } from "~/composables/states";

defineProps({
  isExplore: {
    type: Boolean,
    default: false,
  },
});

defineEmits(["search"]);

const activeFilters = useExploreQuery();
const addLocationDrawerOpen = useAddLocationDrawer();
const authDrawer = useAuthDrawer();
const { isAdmin, isMaintainer, isSignedIn } = useAuth();
const { count: pendingContributions, refresh } = usePendingContributions();

const drawerNavigationItems = computed(() => [
  ...headerNavigationItems,
  ...(isMaintainer.value
    ? [
        getAdminNavigationItems({
          isAdmin: isAdmin.value,
          pendingContributions: pendingContributions.value,
        }).adminGroup,
      ]
    : []),
]);

function openAddLocation() {
  if (isSignedIn.value) {
    addLocationDrawerOpen.value = true;
  } else {
    authDrawer.show("add");
  }
}

watch(
  isMaintainer,
  (canReview) => {
    if (canReview && pendingContributions.value === null) void refresh();
  },
  { immediate: true },
);
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
      <UButton
        v-if="isExplore"
        icon="i-lucide-circle-plus"
        label="Add"
        variant="subtle"
        @click="openAddLocation"
      />

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
      <AppProfileButton />
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
        :items="drawerNavigationItems"
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
