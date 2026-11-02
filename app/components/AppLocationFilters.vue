<script lang="ts" setup>
import type { LocationFilters } from "#shared/types/locations";
import {
  searchFacilities,
  searchHazards,
  searchTypes,
} from "#shared/utils/location-search";
import type { GeocodeResult } from "#shared/types/geo";

withDefaults(defineProps<{ resultCount?: number; total?: number }>(), {
  resultCount: 0,
  total: 0,
});
const filters = defineModel<LocationFilters>({ default: () => ({}) });
const locating = ref(false);
const locationError = ref("");
const radius = ref(10);
const legacyFields = [
  { key: "characteristic", label: "With characteristics" },
  { key: "excludeCharacteristic", label: "Without characteristics" },
  { key: "excludeType", label: "Excluded area types" },
] as const;
const attributeFields = [
  {
    key: "offLeash",
    label: "Off-leash",
    items: [
      { label: "Any", value: "any" },
      { label: "Everywhere allowed", value: "everywhere" },
      { label: "Partially allowed", value: "partial" },
      { label: "Not allowed", value: "not-allowed" },
      { label: "Unknown", value: "unknown" },
    ],
  },
  ...[
    { key: "swimming", label: "Swimming water" },
    { key: "fenced", label: "Fenced" },
    { key: "wheelchairAccessible", label: "Wheelchair accessible" },
  ].map((field) => ({
    ...field,
    items: [
      { label: "Any", value: "any" },
      { label: "Yes", value: "yes" },
      { label: "No", value: "no" },
      { label: "Unknown", value: "unknown" },
    ],
  })),
];
const collectionFields = [
  { key: "type", label: "Area type", values: searchTypes },
  { key: "facility", label: "Facilities", values: searchFacilities },
  { key: "hazard", label: "Recorded hazards", values: searchHazards },
] as const;
function setValue(key: string, value: unknown) {
  const next = { ...filters.value };
  if (
    value === "any" ||
    value === undefined ||
    (Array.isArray(value) && !value.length)
  )
    delete next[key as keyof LocationFilters];
  else Object.assign(next, { [key]: value });
  filters.value = next;
}
function setArea(result: GeocodeResult) {
  filters.value = {
    ...filters.value,
    lat: result.latitude,
    lng: result.longitude,
    radiusKm: radius.value,
  };
}
function clearNearby() {
  const { lat, lng, radiusKm, ...rest } = filters.value;
  filters.value = rest;
}
async function useNearby() {
  locationError.value = "";
  locating.value = true;
  try {
    const position = await new Promise<GeolocationPosition>(
      (resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error("Unavailable"));
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          maximumAge: 60000,
        });
      },
    );
    filters.value = {
      ...filters.value,
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      radiusKm: radius.value,
    };
  } catch {
    locationError.value =
      "Could not get your location. Allow location access or search for an area instead.";
  } finally {
    locating.value = false;
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <p class="text-muted text-sm">
      Filters match recorded information. Missing information never means no.
    </p>
    <template v-for="field in legacyFields" :key="field.key">
      <div
        v-if="filters[field.key]?.length"
        class="flex flex-wrap items-center gap-2"
      >
        <span class="text-sm"
          >{{ field.label }}: {{ filters[field.key]?.join(", ") }}</span
        >
        <UButton
          :aria-label="`Clear ${field.label.toLowerCase()}`"
          label="Clear"
          color="neutral"
          variant="soft"
          @click="setValue(field.key, undefined)"
        />
      </div>
    </template>
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField
        v-for="field in attributeFields"
        :key="field.key"
        :label="field.label"
      >
        <USelect
          :model-value="
            String(filters[field.key as keyof LocationFilters] ?? 'any')
          "
          :items="field.items"
          class="w-full"
          :ui="{ base: 'text-base' }"
          @update:model-value="setValue(field.key, $event)"
        />
      </UFormField>
      <UFormField label="Parking">
        <USelect
          :model-value="filters.parking ?? 'any'"
          :items="[
            { label: 'Any', value: 'any' },
            { label: 'Recorded parking', value: 'yes' },
          ]"
          class="w-full"
          :ui="{ base: 'text-base' }"
          @update:model-value="setValue('parking', $event)"
        />
      </UFormField>
      <UFormField label="Minimum rating">
        <USelect
          :model-value="String(filters.minRating ?? 'any')"
          :items="[
            { label: 'Any rating', value: 'any' },
            ...[1, 2, 3, 4, 5].map((value) => ({
              label: `${value}+ stars`,
              value: String(value),
            })),
          ]"
          class="w-full"
          :ui="{ base: 'text-base' }"
          @update:model-value="
            setValue('minRating', $event === 'any' ? undefined : Number($event))
          "
        />
      </UFormField>
      <UFormField
        v-for="field in collectionFields"
        :key="field.key"
        :label="field.label"
      >
        <USelect
          :model-value="filters[field.key] ?? []"
          multiple
          :items="
            field.values.map((value) => ({
              label: value.replaceAll('-', ' '),
              value,
            }))
          "
          placeholder="Any"
          class="w-full"
          :ui="{ base: 'text-base' }"
          @update:model-value="setValue(field.key, $event)"
        />
      </UFormField>
    </div>
    <USeparator label="Distance" />
    <UFormField label="Search near an area">
      <AppAddressSearch class="w-full" @selected="setArea" />
    </UFormField>
    <UFormField label="Within">
      <USelect
        :model-value="filters.radiusKm ?? radius"
        :items="
          [1, 5, 10, 25, 50, 100].map((value) => ({
            label: `${value} km`,
            value,
          }))
        "
        class="w-full"
        :ui="{ base: 'text-base' }"
        @update:model-value="
          radius = $event;
          filters.radiusKm ? setValue('radiusKm', $event) : undefined;
        "
      />
    </UFormField>
    <div class="flex flex-wrap gap-2">
      <UButton
        label="Near me"
        icon="i-lucide-locate"
        :loading="locating"
        @click="useNearby"
      />
      <UButton
        v-if="filters.radiusKm"
        label="Clear distance"
        variant="soft"
        @click="clearNearby"
      />
    </div>
    <p v-if="filters.radiusKm" role="status" class="text-muted text-sm">
      Within {{ filters.radiusKm }} km of {{ filters.lat?.toFixed(3) }},
      {{ filters.lng?.toFixed(3) }}.
    </p>
    <UAlert v-if="locationError" :title="locationError" color="warning" />
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p role="status" class="text-muted text-sm">
        {{ resultCount }} shown · {{ total }} matching locations
      </p>
      <UButton
        label="Clear filters"
        color="neutral"
        variant="ghost"
        @click="filters = filters.q ? { q: filters.q } : {}"
      />
    </div>
  </div>
</template>
