<script setup lang="ts">
import type { TabsItem } from "@nuxt/ui/components/Tabs.vue";

defineProps<{
  items: TabsItem[];
}>();
</script>

<template>
  <UTabs
    :items="items"
    class="flex h-full min-h-0 w-full min-w-0"
    color="neutral"
    variant="link"
    :ui="{
      list: 'bg-default sticky top-0 z-20 flex w-full min-w-0 shrink-0 flex-nowrap overflow-x-auto overflow-y-hidden overscroll-x-contain',
      content: 'min-h-0 w-full flex-1',
      trigger: 'shrink-0',
      label: 'whitespace-nowrap',
    }"
  >
    <template
      v-for="item in items"
      :key="String(item.slot)"
      #[item.slot]="slotProps"
    >
      <slot :name="item.slot" v-bind="slotProps" />
    </template>
  </UTabs>
</template>
