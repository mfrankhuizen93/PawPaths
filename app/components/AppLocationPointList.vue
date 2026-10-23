<script setup lang="ts">
import type { LocationCoordinateKind } from "#shared/types/locations";

defineProps<{
  markers: {
    id: string;
    label: string;
    kind: LocationCoordinateKind;
    latitude?: number | null;
    longitude?: number | null;
  }[];
  readonly?: boolean;
  activeId?: string;
}>();
defineEmits<{
  select: [marker: { id: string; kind: LocationCoordinateKind }];
  remove: [marker: { id: string; kind: LocationCoordinateKind }];
}>();
</script>

<template>
  <ul class="flex flex-col gap-2" aria-label="Location positions">
    <li
      v-for="marker in markers"
      :key="marker.id"
      class="border-default rounded-md border p-3"
    >
      <p class="text-sm font-medium">{{ marker.label }}</p>
      <p class="text-muted text-sm tabular-nums">
        <template
          v-if="
            Number.isFinite(marker.latitude) &&
            Number.isFinite(marker.longitude)
          "
        >
          Latitude {{ marker.latitude }}, longitude {{ marker.longitude }}
        </template>
        <template v-else>Choose a position on the map</template>
      </p>
      <div v-if="!readonly" class="mt-2 flex flex-wrap gap-2">
        <UButton
          :label="activeId === marker.id ? 'Placing point' : 'Place point'"
          :variant="activeId === marker.id ? 'solid' : 'subtle'"
          icon="i-lucide-map-pin"
          size="sm"
          type="button"
          @click="$emit('select', marker)"
        />
        <UButton
          v-if="marker.kind !== 'general'"
          label="Remove"
          color="neutral"
          variant="ghost"
          size="sm"
          type="button"
          @click="$emit('remove', marker)"
        />
      </div>
    </li>
  </ul>
</template>
