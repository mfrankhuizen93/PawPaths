<script lang="ts" setup>
import type { LocationFilters } from "#shared/types/locations";

type FilterMode = "include" | "exclude";
type FilterField = "type" | "characteristic";
type PersistedFilters = LocationFilters & {
  searchQuery?: unknown;
  typeModes?: unknown;
  characteristicModes?: unknown;
};

const props = withDefaults(
  defineProps<{
    resultCount?: number;
    total?: number;
  }>(),
  {
    resultCount: 0,
    total: 0,
  },
);

const filters = defineModel<LocationFilters>({
  default: () => ({}),
});

const persistKey = "pawpaths.locationFilters";
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

const searchQuery = computed({
  get: () => filters.value.q ?? "",
  set: (value: string) => {
    setFilterValue("q", value.trim() || undefined);
  },
});

const minRating = computed({
  get: () => filters.value.minRating ?? null,
  set: (value: number | null) => {
    setFilterValue("minRating", value ?? undefined);
  },
});

function getArrayValue(value: string[] | undefined) {
  return Array.isArray(value) ? value : [];
}

function setFilterValue<Key extends keyof LocationFilters>(
  key: Key,
  value: LocationFilters[Key] | undefined,
) {
  const nextFilters = { ...filters.value };

  if (
    value === undefined ||
    (Array.isArray(value) && value.length === 0) ||
    value === ""
  ) {
    delete nextFilters[key];
  } else {
    nextFilters[key] = value;
  }

  filters.value = nextFilters;
}

function getIncludeKey(field: FilterField) {
  return field;
}

function getExcludeKey(field: FilterField) {
  return field === "type" ? "excludeType" : "excludeCharacteristic";
}

function getFilterMode(field: FilterField, value: string): FilterMode | null {
  const includeKey = getIncludeKey(field);
  const excludeKey = getExcludeKey(field);

  if (getArrayValue(filters.value[includeKey]).includes(value)) {
    return "include";
  }
  if (getArrayValue(filters.value[excludeKey]).includes(value)) {
    return "exclude";
  }

  return null;
}

function getNextMode(mode: FilterMode | null) {
  if (!mode) return "include";
  if (mode === "include") return "exclude";
  return null;
}

function toggleFilterMode(field: FilterField, value: string) {
  const includeKey = getIncludeKey(field);
  const excludeKey = getExcludeKey(field);
  const nextMode = getNextMode(getFilterMode(field, value));
  const includedValues = getArrayValue(filters.value[includeKey]).filter(
    (item) => item !== value,
  );
  const excludedValues = getArrayValue(filters.value[excludeKey]).filter(
    (item) => item !== value,
  );
  const nextFilters = { ...filters.value };

  if (nextMode === "include") {
    includedValues.push(value);
  } else if (nextMode === "exclude") {
    excludedValues.push(value);
  }

  if (includedValues.length > 0) {
    nextFilters[includeKey] = includedValues;
  } else {
    delete nextFilters[includeKey];
  }

  if (excludedValues.length > 0) {
    nextFilters[excludeKey] = excludedValues;
  } else {
    delete nextFilters[excludeKey];
  }

  filters.value = nextFilters;
}

function getFilterColor(mode: FilterMode | null) {
  if (mode === "include") return "primary";
  if (mode === "exclude") return "error";
  return "neutral";
}

function getFilterVariant(mode: FilterMode | null) {
  return mode ? "solid" : "outline";
}

function getFilterIcon(mode: FilterMode | null) {
  if (mode === "include") return "i-lucide-check";
  if (mode === "exclude") return "i-lucide-ban";
  return undefined;
}

function getFilterLabel(label: string, mode: FilterMode | null) {
  if (mode === "include") return `With ${label}`;
  if (mode === "exclude") return `Without ${label}`;
  return label;
}

function clearFilters() {
  filters.value = {};
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

function applyStoredModes(
  storedFilters: LocationFilters,
  modes: Record<string, FilterMode>,
  field: FilterField,
) {
  const includeKey = getIncludeKey(field);
  const excludeKey = getExcludeKey(field);

  for (const [value, mode] of Object.entries(modes)) {
    if (mode === "include") {
      storedFilters[includeKey] = [
        ...getArrayValue(storedFilters[includeKey]),
        value,
      ];
    } else {
      storedFilters[excludeKey] = [
        ...getArrayValue(storedFilters[excludeKey]),
        value,
      ];
    }
  }
}

function getStoredRating(value: unknown) {
  return typeof value === "number" && ratingOptions.includes(value)
    ? value
    : undefined;
}

function normalizeStoredFilters(value: PersistedFilters): LocationFilters {
  const storedFilters: LocationFilters = {};
  const searchValue = typeof value.q === "string" ? value.q : value.searchQuery;
  const minRatingValue = getStoredRating(value.minRating);

  if (typeof searchValue === "string" && searchValue.trim()) {
    storedFilters.q = searchValue.trim();
  }
  if (minRatingValue !== undefined) {
    storedFilters.minRating = minRatingValue;
  }
  if (Array.isArray(value.type)) storedFilters.type = value.type;
  if (Array.isArray(value.excludeType)) {
    storedFilters.excludeType = value.excludeType;
  }
  if (Array.isArray(value.characteristic)) {
    storedFilters.characteristic = value.characteristic;
  }
  if (Array.isArray(value.excludeCharacteristic)) {
    storedFilters.excludeCharacteristic = value.excludeCharacteristic;
  }

  applyStoredModes(
    storedFilters,
    getStoredModes(value.typeModes, typeOptions),
    "type",
  );
  applyStoredModes(
    storedFilters,
    getStoredModes(value.characteristicModes, characteristicOptions),
    "characteristic",
  );

  return storedFilters;
}

function readStoredFilters() {
  try {
    const storedValue = window.localStorage.getItem(persistKey);
    return storedValue
      ? normalizeStoredFilters(JSON.parse(storedValue) as PersistedFilters)
      : null;
  } catch {
    return null;
  }
}

function storeFilters() {
  window.localStorage.setItem(persistKey, JSON.stringify(filters.value));
}

onMounted(() => {
  const storedFilters = readStoredFilters();

  if (storedFilters) {
    filters.value = storedFilters;
  }
});

watch(
  filters,
  () => {
    storeFilters();
  },
  { deep: true },
);

onBeforeUnmount(() => {
  storeFilters();
});
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="grid gap-4 lg:grid-cols-[minmax(14rem,1fr)_auto]">
      <label class="flex flex-col gap-2">
        <span class="text-text-primary text-sm font-bold">Search</span>
        <UInput
          v-model="searchQuery"
          :ui="{ trailing: 'pe-1', base: 'text-xs' }"
          icon="i-lucide-search"
          placeholder="Search for places, areas..."
          size="lg"
        >
          <template v-if="searchQuery?.length" #trailing>
            <UButton
              aria-label="Clear input"
              color="neutral"
              icon="i-lucide-circle-x"
              size="sm"
              variant="link"
              @click="searchQuery = ''"
            />
          </template>
        </UInput>
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
            :aria-label="getFilterLabel(type, getFilterMode('type', type))"
            :color="getFilterColor(getFilterMode('type', type))"
            :icon="getFilterIcon(getFilterMode('type', type))"
            :title="getFilterLabel(type, getFilterMode('type', type))"
            :variant="getFilterVariant(getFilterMode('type', type))"
            size="sm"
            @click="toggleFilterMode('type', type)"
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
                getFilterMode('characteristic', characteristic),
              )
            "
            :color="
              getFilterColor(getFilterMode('characteristic', characteristic))
            "
            :icon="
              getFilterIcon(getFilterMode('characteristic', characteristic))
            "
            :title="
              getFilterLabel(
                characteristic,
                getFilterMode('characteristic', characteristic),
              )
            "
            :variant="
              getFilterVariant(getFilterMode('characteristic', characteristic))
            "
            size="sm"
            @click="toggleFilterMode('characteristic', characteristic)"
          >
            {{ characteristic }}
          </UButton>
        </div>
      </div>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <p v-if="resultCount && total" class="text-text-secondaryf text-sm">
        Showing {{ resultCount }} of {{ total }} matching locations
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
  </div>
</template>
