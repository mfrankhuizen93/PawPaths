<script setup lang="ts">
withDefaults(
  defineProps<{
    rows?: number;
  }>(),
  {
    rows: 4,
  },
);
</script>

<template>
  <div
    class="divide-default border-default flex flex-col divide-y rounded-lg border"
  >
    <div v-for="row in rows" :key="row" class="flex items-center gap-3 p-4">
      <USkeleton class="size-10 shrink-0 rounded-full" />
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <USkeleton class="h-4 w-2/5" />
        <USkeleton class="h-3 w-3/5" />
      </div>
      <USkeleton class="hidden h-9 w-24 sm:block" />
    </div>
  </div>
</template>
