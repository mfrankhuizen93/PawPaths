<script setup lang="ts">
import type { ReverseGeocodeResult } from "#shared/types/geo";
import { isValidLocationCoordinates } from "#shared/utils/location-coordinates";
import { getLocationPlaceDetails } from "~/utils/location-place-details";

const props = defineProps<{
  latitude?: number | null;
  longitude?: number | null;
}>();
const details = ref<ReverseGeocodeResult | null>(null);
const loading = ref(isValidLocationCoordinates(props));
const hasPosition = computed(() => isValidLocationCoordinates(props));
const lines = computed(() => [
  ...new Set(
    [
      details.value?.name,
      details.value?.address ||
        [details.value?.city, details.value?.country]
          .filter(Boolean)
          .join(", "),
    ].filter(
      (line): line is string => typeof line === "string" && Boolean(line),
    ),
  ),
]);

// Lookups are display-only: a response never changes the chosen position or
// the contributor's own point/area name. Ignore results after a point switch.
onMounted(() => {
  watch(
    () => [props.latitude, props.longitude],
    (_, __, onCleanup) => {
      details.value = null;
      loading.value = hasPosition.value;
      if (!isValidLocationCoordinates(props)) return;
      const position = { latitude: props.latitude, longitude: props.longitude };
      let current = true;
      const timer = setTimeout(async () => {
        try {
          const result = await getLocationPlaceDetails(position);
          if (current) details.value = result;
        } catch {
          // The pin remains usable without geographical data.
        } finally {
          if (current) loading.value = false;
        }
      }, 350);
      onCleanup(() => {
        current = false;
        clearTimeout(timer);
      });
    },
    { immediate: true },
  );
});
</script>

<template>
  <div class="text-muted text-sm" aria-live="polite">
    <p v-if="!hasPosition">Choose a position on the map</p>
    <p v-else-if="loading">Finding address or area name…</p>
    <template v-else-if="lines.length">
      <p v-for="line in lines" :key="line">{{ line }}</p>
    </template>
    <p v-else>Position selected on the map. No address or area name found.</p>
  </div>
</template>
