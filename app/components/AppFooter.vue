<script lang="ts" setup>
import {
  footerNavigationItems,
  getAdminNavigationItems,
} from "~/navigation/items";

const { isAdmin, isMaintainer } = useAuth();
const { count: pendingContributions, refresh } = usePendingContributions();

const navigationItems = computed(() => [
  ...footerNavigationItems,
  ...(isMaintainer.value
    ? [
        getAdminNavigationItems({
          isAdmin: isAdmin.value,
          pendingContributions: pendingContributions.value,
        }).submissionsItem,
      ]
    : []),
]);

watch(
  isMaintainer,
  (canReview) => {
    if (canReview && pendingContributions.value === null) void refresh();
  },
  { immediate: true },
);
</script>

<template>
  <UFooter
    :ui="{
      container: 'h-18 w-full p-0',
      center: 'm-0 flex w-full flex-col',
      left: 'm-0',
    }"
    class="bg-default/95 fixed inset-x-0 bottom-0 z-50 backdrop-blur lg:hidden"
  >
    <USeparator />
    <UNavigationMenu
      :items="navigationItems"
      :ui="{
        root: 'justify-center [&>div]:w-full',
        item: 'w-full py-0',
        list: 'w-full mt-0',
        link: 'flex-col justify-center gap-1 px-3 h-18',
        linkLeadingIcon: 'size-5',
        linkLabel: 'text-[10px]/3 font-normal',
      }"
      class="w-full"
    />
  </UFooter>
</template>

<style scoped></style>
