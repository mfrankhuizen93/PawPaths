<script setup lang="ts">
import {
  locationCoordinateKindOptions,
  type LocationCoordinateKind,
} from "#shared/types/locations";

const props = defineProps<{
  markers: {
    id: string;
    label: string;
    kind: LocationCoordinateKind;
    latitude?: number | null;
    longitude?: number | null;
  }[];
  readonly?: boolean;
  activeId?: string | null;
}>();
defineEmits<{
  select: [marker: { id: string; kind: LocationCoordinateKind }];
  move: [marker: { id: string; kind: LocationCoordinateKind }];
  rename: [label: string];
  "change-kind": [kind: LocationCoordinateKind];
  remove: [marker: { id: string; kind: LocationCoordinateKind }];
}>();
const pointKinds = locationCoordinateKindOptions.filter(
  (option) => option.value !== "general",
);
const list = ref<HTMLElement | null>(null);
watch(
  () => props.activeId,
  async () => {
    await nextTick();
    list.value
      ?.querySelector('[aria-pressed="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  },
);
</script>

<template>
  <ul ref="list" class="flex flex-col gap-2" aria-label="Location positions">
    <li
      v-for="(marker, index) in markers"
      :key="readonly ? `${index}-${marker.id}` : marker.id"
      class="border-default rounded-md border p-3"
    >
      <p v-if="readonly" class="text-sm font-medium">{{ marker.label }}</p>
      <UButton
        v-else
        :label="marker.label"
        :aria-pressed="activeId === marker.id"
        :variant="activeId === marker.id ? 'soft' : 'ghost'"
        class="w-full justify-start"
        type="button"
        @click="$emit('select', marker)"
      />
      <p class="text-muted text-sm">
        {{
          locationCoordinateKindOptions.find(
            (option) => option.value === marker.kind,
          )?.label
        }}
      </p>
      <AppLocationPositionSummary
        :latitude="marker.latitude"
        :longitude="marker.longitude"
      />
      <div
        v-if="!readonly && activeId === marker.id"
        class="mt-2 flex flex-col gap-3"
      >
        <template v-if="marker.kind !== 'general'">
          <UFormField label="Point name">
            <UInput
              :model-value="marker.label"
              class="w-full"
              maxlength="120"
              @change="
                $emit('rename', ($event.target as HTMLInputElement).value)
              "
            />
          </UFormField>
          <UFormField label="Point type">
            <USelect
              :model-value="marker.kind"
              :items="pointKinds"
              class="w-full"
              @update:model-value="$emit('change-kind', $event)"
            />
          </UFormField>
        </template>
        <UButton
          label="Replace position"
          variant="subtle"
          icon="i-lucide-map-pin"
          size="sm"
          type="button"
          @click="$emit('move', marker)"
        />
        <UButton
          v-if="marker.kind !== 'general'"
          label="Remove point"
          color="error"
          variant="ghost"
          size="sm"
          type="button"
          @click="$emit('remove', marker)"
        />
      </div>
    </li>
  </ul>
</template>
