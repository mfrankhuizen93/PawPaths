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
  readonly: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["remove"]);

const isGeneralLocation = computed(() => marker.value.kind === "general");

const pointKindOptions = locationCoordinateKindOptions.filter(
  (option) => option.value !== "general",
);
const editablePointKind = computed({
  get: () => (marker.value.kind === "general" ? undefined : marker.value.kind),
  set: (
    kind: Exclude<LocationCoordinatePoint["kind"], "general"> | undefined,
  ) => {
    if (kind) marker.value.kind = kind;
  },
});
</script>

<template>
  <div
    class="grid gap-2 rounded border p-3 sm:grid-cols-[auto_minmax(10rem,1fr)_minmax(10rem,1fr)_auto]"
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
      v-model="editablePointKind"
      :disabled="isGeneralLocation || readonly"
      :items="pointKindOptions"
      class="w-full"
      placeholder="Kind"
      value-key="value"
    />

    <UInput
      v-if="!isGeneralLocation"
      v-model="marker.label"
      :readonly="readonly"
      placeholder="Label"
    />
    <UButton
      v-if="isActive && !isGeneralLocation && !readonly"
      icon="i-lucide:trash"
      color="error"
      variant="ghost"
      @click="emit('remove', marker.id)"
    />
  </div>
</template>

<style scoped></style>
