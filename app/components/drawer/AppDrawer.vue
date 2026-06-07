<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    description?: string;
    loading?: boolean;
  }>(),
  {
    title: undefined,
    description: undefined,
    loading: false,
  },
);

const emit = defineEmits<{
  "update:open": [open: boolean];
}>();

const drawerOpen = computed({
  get: () => props.open,
  set: (open) => emit("update:open", open),
});
</script>

<template>
  <UDrawer
    v-model:open="drawerOpen"
    :description="description"
    direction="bottom"
    :title="title"
    :ui="{
      container: 'mx-auto w-full max-w-5xl',
      body: 'max-h-[70vh] overflow-y-auto',
    }"
  >
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>

    <template #body>
      <slot v-if="!loading" />
      <slot v-else name="loading">
        <div class="flex flex-col gap-4">
          <USkeleton class="h-8 w-2/5" />
          <USkeleton class="h-4 w-3/5" />
          <USkeleton class="h-40 w-full" />
        </div>
      </slot>
    </template>

    <template v-if="$slots.actions" #footer>
      <slot name="actions" />
    </template>
  </UDrawer>
</template>
