<script setup lang="ts">
defineProps<{
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  actionIcon?: string;
}>();

defineEmits<{
  action: [];
}>();
</script>

<template>
  <UEmpty
    :description="description"
    :icon="icon"
    :title="title"
    class="w-full"
    variant="subtle"
  >
    <template v-if="actionLabel" #actions>
      <UButton
        :icon="actionIcon"
        :label="actionLabel"
        @click="$emit('action')"
      />
    </template>
  </UEmpty>
</template>
