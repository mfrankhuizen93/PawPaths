<script lang="ts" setup>
import type {
  LocationFilters,
  LocationListItem,
  LocationsResponse,
} from "#shared/types/locations";
import { getLocationPath } from "#shared/utils/location-route";
import { useTextSearch } from "~/composables/states";

type FilterMode = "include" | "exclude";
type PersistedFilters = {
  searchQuery?: unknown;
  minRating?: unknown;
  typeModes?: unknown;
  characteristicModes?: unknown;
};

const typeOptions = ["beach", "dog playground", "nature reserve", "park"];
const characteristicOptions = [
  "off-leash area",
  "fenced",
  "food and drink",
  "horse trails",
  "mountain bike trails",
  "swimming water",
  "walking trails",
  "wheelchair accessible",
];
const ratingOptions = [5, 4, 3, 2, 1];
const warningOptions: Record<string, { icon: string; label: string }> = {
  "cyclists nearby": {
    icon: "i-lucide-bike",
    label: "Cyclists nearby",
  },
  "livestock nearby": {
    icon: "i-lucide-triangle-alert",
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
const filtersStorageKey = "pawpaths.locationFilters";

const searchQuery = useTextSearch();
const minRating = ref<number | null>(null);
const typeModes = ref<Record<string, FilterMode>>({});
const characteristicModes = ref<Record<string, FilterMode>>({});

const includedTypes = computed(() =>
  getValuesByMode(typeModes.value, "include"),
);
const excludedTypes = computed(() =>
  getValuesByMode(typeModes.value, "exclude"),
);
const includedCharacteristics = computed(() =>
  getValuesByMode(characteristicModes.value, "include"),
);
const excludedCharacteristics = computed(() =>
  getValuesByMode(characteristicModes.value, "exclude"),
);

const activeFilters = computed<LocationFilters>(() => {
  const filters: LocationFilters = {};
  const q = searchQuery.value.trim();

  if (q) filters.q = q;
  if (minRating.value !== null) filters.minRating = minRating.value;
  if (includedTypes.value.length > 0) filters.type = includedTypes.value;
  if (excludedTypes.value.length > 0) {
    filters.excludeType = excludedTypes.value;
  }
  if (includedCharacteristics.value.length > 0) {
    filters.characteristic = includedCharacteristics.value;
  }
  if (excludedCharacteristics.value.length > 0) {
    filters.excludeCharacteristic = excludedCharacteristics.value;
  }

  return filters;
});

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

function getValuesByMode(modes: Record<string, FilterMode>, mode: FilterMode) {
  return Object.entries(modes)
    .filter(([, value]) => value === mode)
    .map(([key]) => key);
}

function isFilterMode(value: unknown): value is FilterMode {
  return value === "include" || value === "exclude";
}

function getStoredModes(
  value: unknown,
  allowedOptions: string[],
): Record<string, FilterMode> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const allowedValues = new Set(allowedOptions);

  return Object.fromEntries(
    Object.entries(value).filter(
      ([key, mode]) => allowedValues.has(key) && isFilterMode(mode),
    ),
  );
}

function getStoredRating(value: unknown) {
  return typeof value === "number" && ratingOptions.includes(value)
    ? value
    : null;
}

function readStoredFilters(): PersistedFilters | null {
  try {
    const storedValue = window.localStorage.getItem(filtersStorageKey);
    return storedValue ? (JSON.parse(storedValue) as PersistedFilters) : null;
  } catch {
    return null;
  }
}

function storeFilters() {
  window.localStorage.setItem(
    filtersStorageKey,
    JSON.stringify({
      searchQuery: searchQuery.value,
      minRating: minRating.value,
      typeModes: typeModes.value,
      characteristicModes: characteristicModes.value,
    }),
  );
}

function getNextMode(mode?: FilterMode) {
  if (!mode) return "include";
  if (mode === "include") return "exclude";
  return null;
}

function toggleMode(modes: Record<string, FilterMode>, value: string) {
  const nextMode = getNextMode(modes[value]);
  const nextModes = { ...modes };

  if (nextMode) {
    nextModes[value] = nextMode;
  } else {
    delete nextModes[value];
  }

  return nextModes;
}

function toggleType(type: string) {
  typeModes.value = toggleMode(typeModes.value, type);
}

function toggleCharacteristic(characteristic: string) {
  characteristicModes.value = toggleMode(
    characteristicModes.value,
    characteristic,
  );
}

function getFilterColor(mode?: FilterMode) {
  if (mode === "include") return "primary";
  if (mode === "exclude") return "error";
  return "neutral";
}

function getFilterVariant(mode?: FilterMode) {
  return mode ? "solid" : "outline";
}

function getFilterIcon(mode?: FilterMode) {
  if (mode === "include") return "i-lucide-check";
  if (mode === "exclude") return "i-lucide-ban";
  return undefined;
}

function getFilterLabel(label: string, mode?: FilterMode) {
  if (mode === "include") return `With ${label}`;
  if (mode === "exclude") return `Without ${label}`;
  return label;
}

function getWarningMeta(warning: string) {
  return (
    warningOptions[warning] ?? {
      icon: "i-lucide-triangle-alert",
      label: warning,
    }
  );
}

function clearFilters() {
  searchQuery.value = "";
  minRating.value = null;
  typeModes.value = {};
  characteristicModes.value = {};
}

onMounted(() => {
  const storedFilters = readStoredFilters();

  if (!storedFilters) return;

  searchQuery.value =
    typeof storedFilters.searchQuery === "string"
      ? storedFilters.searchQuery
      : "";
  minRating.value = getStoredRating(storedFilters.minRating);
  typeModes.value = getStoredModes(storedFilters.typeModes, typeOptions);
  characteristicModes.value = getStoredModes(
    storedFilters.characteristicModes,
    characteristicOptions,
  );
});

watch([searchQuery, minRating, typeModes, characteristicModes], storeFilters, {
  deep: true,
  flush: "sync",
});

onBeforeRouteLeave(() => {
  storeFilters();
});

definePageMeta({
  layout: "explore",
});
</script>

<template>
  <UContainer class="flex flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
    <section
      class="border-border bg-surface shadow-card flex flex-col gap-5 rounded-md border p-4 sm:p-5"
    >
      <div class="grid gap-4 lg:grid-cols-[minmax(14rem,1fr)_auto]">
        <label class="flex flex-col gap-2">
          <span class="text-text-primary text-sm font-bold">Search</span>
          <UInput
            v-model="searchQuery"
            icon="i-lucide-search"
            placeholder="Search for places, areas..."
            size="lg"
          />
        </label>

        <label class="flex min-w-48 flex-col gap-2">
          <span class="text-text-primary text-sm font-bold">Rating</span>
          <USelect
            v-model="minRating"
            :items="[
              { label: 'Any rating', value: null },
              ...ratingOptions.map((rating) => ({
                label: `${rating}+ stars`,
                value: rating,
              })),
            ]"
            placeholder="Any rating"
            size="lg"
          />
        </label>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <div class="flex flex-col gap-2">
          <span class="text-text-primary text-sm font-bold">Type</span>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="type in typeOptions"
              :key="type"
              :aria-label="getFilterLabel(type, typeModes[type])"
              :color="getFilterColor(typeModes[type])"
              :icon="getFilterIcon(typeModes[type])"
              :title="getFilterLabel(type, typeModes[type])"
              :variant="getFilterVariant(typeModes[type])"
              size="sm"
              @click="toggleType(type)"
            >
              {{ type }}
            </UButton>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <span class="text-text-primary text-sm font-bold">
            Characteristics
          </span>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="characteristic in characteristicOptions"
              :key="characteristic"
              :aria-label="
                getFilterLabel(
                  characteristic,
                  characteristicModes[characteristic],
                )
              "
              :color="getFilterColor(characteristicModes[characteristic])"
              :icon="getFilterIcon(characteristicModes[characteristic])"
              :title="
                getFilterLabel(
                  characteristic,
                  characteristicModes[characteristic],
                )
              "
              :variant="getFilterVariant(characteristicModes[characteristic])"
              size="sm"
              @click="toggleCharacteristic(characteristic)"
            >
              {{ characteristic }}
            </UButton>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-text-secondary text-sm">
          Showing {{ locations.length }} of {{ total }} matching locations
        </p>
        <UButton
          color="neutral"
          icon="i-lucide-rotate-ccw"
          size="sm"
          variant="ghost"
          @click="clearFilters"
        >
          Clear
        </UButton>
      </div>
    </section>

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

    <ClientOnly v-if="!error">
      <LazyAppLocation
        :filters="activeFilters"
        :limit="60"
        :locations="locations"
        variant="search"
        @locations-loaded="applyMapResults"
      />
    </ClientOnly>

    <div v-if="!error" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="location in locations.slice(0, 3)"
        :key="location.id"
        class="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm"
      >
        <img
          v-if="location.photos?.[0]"
          :alt="location.photos[0].alt || location.name"
          :src="location.photos[0].url"
          class="aspect-[4/3] w-full object-cover"
          loading="lazy"
        />
        <div
          v-else
          class="flex aspect-[4/3] w-full items-center justify-center bg-emerald-50 text-sm font-semibold text-emerald-800"
        >
          PawPaths
        </div>

        <div class="flex flex-col gap-3 p-4">
          <div>
            <h2 class="text-lg font-bold text-slate-950">
              {{ location.name }}
            </h2>
            <p class="text-sm text-slate-600">
              {{ [location.city, location.country].filter(Boolean).join(", ") }}
            </p>
          </div>

          <div class="flex flex-wrap gap-2">
            <span
              v-for="type in location.type"
              :key="type"
              class="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800"
            >
              {{ type }}
            </span>
          </div>

          <ul class="flex flex-wrap gap-2">
            <li
              v-for="characteristic in location.characteristics.slice(0, 4)"
              :key="characteristic"
              class="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700"
            >
              {{ characteristic }}
            </li>
          </ul>

          <ul v-if="location.warnings.length" class="flex flex-wrap gap-2">
            <li
              v-for="warning in location.warnings"
              :key="warning"
              :title="getWarningMeta(warning).label"
              class="flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800"
            >
              <UIcon
                :name="getWarningMeta(warning).icon"
                class="size-3.5 shrink-0"
              />
              <span>{{ getWarningMeta(warning).label }}</span>
            </li>
          </ul>

          <p class="text-sm text-slate-500">
            <template v-if="location.averageRating != null">
              Rating {{ location.averageRating }} ·
              {{ location.ratingCount }} ratings ·
            </template>
            <template v-else>No rating yet ·</template>
            {{ location.reviewCount }} reviews
          </p>

          <UButton
            :to="getLocationPath(location.name)"
            class="self-start"
            color="primary"
            icon="i-lucide-info"
            size="sm"
          >
            More information
          </UButton>
        </div>
      </article>
    </div>
  </UContainer>
</template>

<style scoped></style>
