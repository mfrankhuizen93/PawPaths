<script setup lang="ts">
import type { TabsItem } from "@nuxt/ui/components/Tabs.vue";

defineProps<{
  items: TabsItem[];
}>();
</script>

<template>
  <UTabs
    :items="items"
    class="w-full min-w-0"
    color="neutral"
    variant="link"
    :ui="{
      list: 'w-full min-w-0 overflow-x-auto',
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
