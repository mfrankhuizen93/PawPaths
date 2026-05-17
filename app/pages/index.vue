<script lang="ts" setup>
import type {
  LocationListItem,
  LocationPhoto,
  LocationsResponse,
} from "#shared/types/locations";
import { useExploreQuery } from "~/composables/states";
import AppPhotoModal from "~/components/AppPhotoModal.vue";

const typeOptions: Record<string, { icon: string; label: string }> = {
  park: {
    icon: "i-ph:park",
    label: "Park",
  },
  "nature reserve": {
    icon: "i-material-symbols:forest-rounded",
    label: "Nature Reserve",
  },
  "dog playground": {
    icon: "i-cil:dog",
    label: "Dog Playground",
  },
  beach: {
    icon: "i-tabler:beach",
    label: "Beach",
  },
};
const characteristicOptions: Record<string, { icon: string; label: string }> = {
  "off-leash area": {
    icon: "i-tabler:ease-in-out",
    label: "Off-leash Area",
  },
  fenced: {
    icon: "i-tabler:fence",
    label: "Fenced",
  },
  "food and drink": {
    icon: "i-tabler:coffee",
    label: "Food and Drink",
  },
  "horse trails": {
    icon: "i-tabler:horse",
    label: "Horse trails",
  },
  "mountain bike trails": {
    icon: "i-tabler:bike",
    label: "Mountain bike trails",
  },
  "swimming water": {
    icon: "i-tabler:ripple",
    label: "Swimming water",
  },
  "walking trails": {
    icon: "i-tabler:walk",
    label: "Walking trails",
  },
  "wheelchair accessible": {
    icon: "i-tabler:disabled",
    label: "Wheelchair accessible",
  },
};
const warningOptions: Record<string, { icon: string; label: string }> = {
  "cyclists nearby": {
    icon: "i-lucide-bike",
    label: "Cyclists nearby",
  },
  "livestock nearby": {
    icon: "i-lucide-lab:cow-head",
    label: "Livestock nearby",
  },
  "muddy after rain": {
    icon: "i-lucide-cloud-rain",
    label: "Muddy after rain",
  },
  "traffic nearby": {
    icon: "i-lucide-car",
    label: "Traffic nearby",
  },
};
const activeFilters = useExploreQuery();

const activeSnapPoint = ref<number | null>(null);
const selectedPhoto = ref<LocationPhoto | null>(null);

const items = ref<TabsItem[]>([
  {
    label: "Overview",
    slot: "overview",
  },
  {
    label: "Photos",
    slot: "photos",
  },
  {
    label: "Links",
    slot: "links",
  },
  {
    label: "Reviews",
    slot: "reviews",
  },
]);

const locationsQuery = computed(() => ({
  limit: 20,
  ...activeFilters.value,
}));

const { data, error, pending, refresh } = await useFetch<LocationsResponse>(
  "/api/locations",
  {
    query: locationsQuery,
  },
);

const locations = ref<LocationListItem[]>([]);
const total = ref(0);
const selectedLocation = ref<LocationListItem | null>(null);
const isLocationDrawerOpen = computed({
  get: () => Boolean(selectedLocation.value),
  set: (open) => {
    if (!open) selectedLocation.value = null;
  },
});

const selectedLocationMeta = computed(() =>
  [selectedLocation.value?.city, selectedLocation.value?.country]
    .filter(Boolean)
    .join(", "),
);

const selectedLocationPhoto = computed(
  () => selectedLocation.value?.photos?.[0] ?? null,
);

watch(
  data,
  (response) => {
    locations.value = response?.items ?? [];
    total.value = response?.total ?? 0;
  },
  { immediate: true },
);

function applyMapResults(response: LocationsResponse) {
  locations.value = response.items;
  total.value = response.total;
}

function selectLocation(location: LocationListItem) {
  selectedLocation.value = location;
}

function getTypeMeta(type: string) {
  return (
    typeOptions[type] ?? {
      icon: "i-ph:park",
      label: type,
    }
  );
}
function getCharacteristicMeta(characteristic: string) {
  return (
    characteristicOptions[characteristic] ?? {
      icon: "i-lucide-triangle-alert",
      label: characteristic,
    }
  );
}
function getWarningMeta(warning: string) {
  return (
    warningOptions[warning] ?? {
      icon: "i-lucide-triangle-alert",
      label: warning,
    }
  );
}

definePageMeta({
  layout: "explore",
});
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-6">
    <div
      v-if="pending && locations.length === 0"
      class="rounded-md border border-slate-200 bg-white p-4 text-slate-600"
    >
      Loading locations...
    </div>

    <div
      v-if="error"
      class="rounded-md border border-red-200 bg-red-50 p-4 text-red-800"
    >
      {{ error }}
      <button
        class="ml-2 font-semibold underline"
        type="button"
        @click="refresh()"
      >
        Retry
      </button>
    </div>

    <div v-if="!error" class="min-h-0 flex-1">
      <ClientOnly>
        <LazyAppLocation
          :filters="activeFilters"
          :limit="60"
          :locations="locations"
          class="h-full"
          variant="search"
          @location-selected="selectLocation"
          @locations-loaded="applyMapResults"
        />
      </ClientOnly>
    </div>

    <UDrawer
      v-model:active-snap-point="activeSnapPoint"
      v-model:open="isLocationDrawerOpen"
      :snap-points="[0.6, 1.0]"
    >
      <template #header>
        <div v-if="selectedLocation" class="flex flex-col gap-4">
          <div v-if="selectedLocation.type && selectedLocationMeta">
            <p class="text-brand-600 text-sm font-semibold">
              {{ getTypeMeta(selectedLocation?.type)?.label }}
            </p>
            <h2 class="font-title text-2xl font-extrabold text-slate-950">
              {{ selectedLocation?.name }}
            </h2>
            <p v-if="selectedLocationMeta" class="text-sm text-slate-600">
              {{ selectedLocationMeta }}
            </p>
          </div>

          <div
            v-if="selectedLocation?.characteristics?.length"
            class="flex flex-wrap gap-2"
          >
            <UBadge
              v-for="characteristic in selectedLocation.characteristics"
              :key="characteristic"
              color="neutral"
              variant="soft"
            >
              <span>{{ getCharacteristicMeta(characteristic).label }}</span>
            </UBadge>
          </div>
          <div class="flex flex-wrap gap-2">
            <UBadge
              v-for="warning in selectedLocation.warnings"
              :key="warning"
              color="error"
              variant="soft"
            >
              {{ getWarningMeta(warning).label }}
            </UBadge>
          </div>

          <AppPhotoLanes
            v-if="activeSnapPoint < 1 && selectedLocation?.photos?.length"
            :photos="selectedLocation?.photos"
          />
        </div>
      </template>
      <template #body>
        <div v-if="activeSnapPoint > 0.6">
          <UTabs :items="items" class="w-full" color="neutral" variant="link">
            <template #overview>
              <UEditor
                v-model="selectedLocation.description"
                :editable="false"
                class="min-h-21 w-full"
                content-type="markdown"
              />
            </template>
            <template #photos>
              <UScrollArea
                v-slot="{ item }"
                :items="selectedLocation?.photos"
                :orientation="orientation"
                :virtualize="{
                  gap: 4,
                  lanes: 2,
                  estimateSize: 480,
                }"
                class="h-128 w-full"
              >
                <img
                  :alt="item.alt"
                  :height="item.height"
                  :src="item.url"
                  :width="item.width"
                  class="size-full rounded-md object-cover"
                  loading="lazy"
                  @click="selectedPhoto = item"
                />
              </UScrollArea>

              <AppPhotoModal v-model="selectedPhoto" />
            </template>
            <template #reviews> Reviews </template>
            <template #links>
              <UButton
                v-for="url in selectedLocation.relatedUrls"
                :to="url.url"
                color="neutral"
                icon="i-lucide-square-arrow-out-up-right"
                target="_blank"
                variant="outline"
              >
                {{ url.label }}
              </UButton>
            </template>
          </UTabs>
        </div>
      </template>
    </UDrawer>
  </div>
</template>

<style scoped></style>
