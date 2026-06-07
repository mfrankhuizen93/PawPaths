<script setup lang="ts">
defineProps<{
  eyebrow?: string;
  title: string;
  description?: string;
  badge?: string | number;
}>();
</script>

<template>
  <header
    class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
  >
    <div class="min-w-0">
      <p v-if="eyebrow" class="text-primary text-sm font-semibold">
        {{ eyebrow }}
      </p>

      <div class="mt-1 flex flex-wrap items-center gap-2">
        <h1 class="font-title text-highlighted text-3xl font-extrabold">
          {{ title }}
        </h1>
        <UBadge v-if="badge !== undefined" color="primary" variant="soft">
          {{ badge }}
        </UBadge>
      </div>

      <p v-if="description" class="text-muted mt-2 max-w-2xl text-sm leading-6">
        {{ description }}
      </p>
    </div>

    <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>
