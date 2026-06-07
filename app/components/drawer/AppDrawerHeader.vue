<script setup lang="ts">
defineProps<{
  eyebrow?: string;
  title: string;
  description?: string;
}>();
</script>

<template>
  <div class="flex min-w-0 items-start gap-3">
    <slot name="leading" />
    <div class="min-w-0 flex-1">
      <p v-if="eyebrow" class="text-primary text-sm font-semibold">
        {{ eyebrow }}
      </p>
      <h2 class="font-title text-highlighted text-2xl font-extrabold">
        {{ title }}
      </h2>
      <p v-if="description" class="text-muted mt-1 text-sm">
        {{ description }}
      </p>
      <slot />
    </div>
  </div>
</template>
