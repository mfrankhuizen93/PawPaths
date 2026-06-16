<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    open: boolean;
    title?: string;
    description?: string;
    loading?: boolean;
    dirty?: boolean;
  }>(),
  {
    title: undefined,
    description: undefined,
    loading: false,
    dirty: false,
  },
);

const emit = defineEmits<{
  "update:open": [open: boolean];
}>();

const discardDialogOpen = ref(false);

const drawerOpen = computed({
  get: () => props.open,
  set: (open) => {
    if (!open && props.dirty) {
      discardDialogOpen.value = true;
      return;
    }

    emit("update:open", open);
  },
});

function discardChanges() {
  discardDialogOpen.value = false;
  emit("update:open", false);
}

function keepEditing() {
  discardDialogOpen.value = false;
}

function requestClose() {
  drawerOpen.value = false;
}
</script>

<template>
  <div>
    <UDrawer
      v-model:open="drawerOpen"
      :description="description"
      direction="bottom"
      :title="title"
      :ui="{
        content: 'max-h-[calc(100dvh-1rem)] rounded-t-[1.75rem]',
        container: 'mx-auto w-full max-w-5xl',
        header: 'shrink-0',
        body: 'max-h-[calc(100dvh-12rem)] overflow-y-auto',
        footer: 'shrink-0',
        handle: 'mt-3 h-1.5 w-10 rounded-full',
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
        <slot name="actions" :close="requestClose" />
      </template>
    </UDrawer>

    <UModal
      v-model:open="discardDialogOpen"
      :close="false"
      description="Your changes have not been saved."
      title="Discard unsaved changes?"
    >
      <template #body>
        <p class="text-muted text-sm">
          Choose whether to keep editing or discard the changes and close the
          drawer.
        </p>
      </template>

      <template #footer>
        <div class="flex w-full flex-wrap justify-end gap-2">
          <UButton
            color="neutral"
            label="Keep editing"
            variant="subtle"
            @click="keepEditing"
          />
          <UButton
            color="error"
            label="Discard changes"
            @click="discardChanges"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
