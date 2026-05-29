<script lang="ts" setup>
import type { LocationCoordinatePoint } from "#shared/types/locations";
import type { SelectItem } from "@nuxt/ui/components/Select.vue";

const marker = defineModel({
  type: Object as PropType<LocationCoordinatePoint>,
  required: true,
});

const props = defineProps({
  isActive: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["select", "remove"]);

const pointKindOptions = locationCoordinateKindOptions;

const isGeneralLocation = computed(() => marker.value.kind === "general");
</script>

<template>
  <div
    class="flex gap-2 rounded border p-3"
    :class="{ 'border-brand-500 bg-brand-50 border': isActive }"
  >
    <UButton
      @click="emit('select', marker.id)"
      icon="i-lucide-crosshair"
      color="neutral"
      variant="ghost"
    />

    <USelectMenu
      v-model="marker.kind"
      :disabled="isGeneralLocation"
      :items="pointKindOptions"
      class="w-48"
      value-key="value"
      placeholder="Kind"
    />

    <UInput v-model="marker.label" placeholder="Label" />
    <UButton
      v-if="isActive && !isGeneralLocation"
      @click="emit('remove', marker.id)"
      icon="i-lucide:trash"
      color="error"
      variant="ghost"
    />
  </div>
</template>

<style scoped></style>
