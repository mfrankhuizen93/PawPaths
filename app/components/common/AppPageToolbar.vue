<script setup lang="ts">
import AppProfileButton from "~/components/AppProfileButton.vue";
import { getAppNavigationItems } from "~/navigation/items";

withDefaults(
  defineProps<{
    overlay?: boolean;
  }>(),
  {
    overlay: false,
  },
);

const { isAdmin, isMaintainer } = useAuth();
const { count: pendingContributions, refresh } = usePendingContributions();
const navigationOpen = ref(false);

const navigationItems = computed(() =>
  getAppNavigationItems({
    isAdmin: isAdmin.value,
    isMaintainer: isMaintainer.value,
    pendingContributions: pendingContributions.value,
  }),
);
const showsNavigation = computed(() => navigationItems.value.length > 1);

watch(
  isMaintainer,
  (canReview) => {
    if (canReview && pendingContributions.value === null) void refresh();
  },
  { immediate: true },
);
</script>

<template>
  <header
    :class="[
      'z-30 flex w-full items-start gap-2',
      overlay
        ? 'pointer-events-none absolute inset-x-0 top-0 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-5 sm:pt-[max(1.25rem,env(safe-area-inset-top))]'
        : 'mx-auto max-w-5xl px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:pt-[max(1.5rem,env(safe-area-inset-top))]',
    ]"
  >
    <UButton
      v-if="showsNavigation"
      aria-label="Open navigation"
      class="border-default/60 bg-default/88 pointer-events-auto size-12 shrink-0 justify-center rounded-2xl border p-0 shadow-lg backdrop-blur-xl"
      color="neutral"
      icon="i-lucide-menu"
      size="lg"
      square
      variant="ghost"
      @click="navigationOpen = true"
    />

    <div class="pointer-events-auto flex min-w-0 flex-1 items-center gap-2">
      <slot name="primary" />
    </div>

    <div class="pointer-events-auto flex shrink-0 items-center gap-2">
      <slot name="actions" />
      <AppProfileButton floating />
    </div>
  </header>

  <USidebar
    v-if="showsNavigation"
    v-model:open="navigationOpen"
    :close="false"
    collapsible="offcanvas"
    description="Move between PawPaths sections."
    mode="drawer"
    :menu="{
      direction: 'left',
      ui: {
        content: 'w-[min(22rem,calc(100vw-2rem))] rounded-r-[1.75rem]',
        handle: 'hidden',
      },
    }"
    side="left"
    title="Navigation"
    :ui="{
      root: '[--sidebar-width:min(22rem,calc(100vw-2rem))]',
      inner:
        'bg-default divide-y divide-default rounded-r-[1.75rem] shadow-xl ring ring-default',
      body: 'overflow-y-auto',
    }"
  >
    <template #close />

    <template #default="{ close }">
      <UNavigationMenu
        :items="navigationItems"
        class="w-full"
        orientation="vertical"
        @click="
          close();
          navigationOpen = false;
        "
      />
    </template>

    <template #content="{ close }">
      <UNavigationMenu
        :items="navigationItems"
        class="w-full"
        orientation="vertical"
        @click="
          close();
          navigationOpen = false;
        "
      />
    </template>
  </USidebar>
</template>
