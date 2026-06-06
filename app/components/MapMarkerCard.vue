<script lang="ts" setup>
import {
  locationCoordinateKindOptions,
  type LocationCoordinatePoint,
} from "#shared/types/locations";

const marker = defineModel({
  type: Object as PropType<LocationCoordinatePoint>,
  required: true,
});

defineProps({
  isActive: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["remove"]);

const isGeneralLocation = computed(() => marker.value.kind === "general");

const pointKindOptions = locationCoordinateKindOptions.filter(
  (option) => option.value !== "general",
);
</script>

<template>
  <div
    class="flex justify-between gap-2 rounded border p-3"
    :class="{ 'border-brand-500 bg-brand-50 border': isActive }"
  >
    <UButton color="neutral" icon="i-lucide-crosshair" variant="ghost" />

    <UInput
      v-if="isGeneralLocation"
      v-model="marker.label"
      class="w-full flex-1"
      readonly
    />

    <USelectMenu
      v-else
      v-model="marker.kind"
      :disabled="isGeneralLocation"
      :items="pointKindOptions"
      class="w-full flex-1"
      placeholder="Kind"
      value-key="value"
    />

    <UInput v-if="false" v-model="marker.label" placeholder="Label" />
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
