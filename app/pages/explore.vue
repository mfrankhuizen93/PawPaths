<script lang="ts" setup>
import type {
  LocationListItem,
  LocationsResponse,
} from "#shared/types/locations";
import { useExploreQuery } from "~/composables/states";

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
const activeFilters = useExploreQuery();

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
          @locations-loaded="applyMapResults"
        />
      </ClientOnly>
    </div>

    <!--      <div v-if="!error" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">-->
    <!--        <article-->
    <!--          v-for="location in locations.slice(0, 3)"-->
    <!--          :key="location.id"-->
    <!--          class="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm"-->
    <!--        >-->
    <!--          <img-->
    <!--            v-if="location.photos?.[0]"-->
    <!--            :alt="location.photos[0].alt || location.name"-->
    <!--            :src="location.photos[0].url"-->
    <!--            class="aspect-[4/3] w-full object-cover"-->
    <!--            loading="lazy"-->
    <!--          />-->
    <!--          <div-->
    <!--            v-else-->
    <!--            class="flex aspect-[4/3] w-full items-center justify-center bg-emerald-50 text-sm font-semibold text-emerald-800"-->
    <!--          >-->
    <!--            PawPaths-->
    <!--          </div>-->

    <!--          <div class="flex flex-col gap-3 p-4">-->
    <!--            <div>-->
    <!--              <h2 class="text-lg font-bold text-slate-950">-->
    <!--                {{ location.name }}-->
    <!--              </h2>-->
    <!--              <p class="text-sm text-slate-600">-->
    <!--                {{ [location.city, location.country].filter(Boolean).join(", ") }}-->
    <!--              </p>-->
    <!--            </div>-->

    <!--            <div class="flex flex-wrap gap-2">-->
    <!--              <span-->
    <!--                v-for="type in location.type"-->
    <!--                :key="type"-->
    <!--                class="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800"-->
    <!--              >-->
    <!--                {{ type }}-->
    <!--              </span>-->
    <!--            </div>-->

    <!--            <ul class="flex flex-wrap gap-2">-->
    <!--              <li-->
    <!--                v-for="characteristic in location.characteristics.slice(0, 4)"-->
    <!--                :key="characteristic"-->
    <!--                class="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700"-->
    <!--              >-->
    <!--                {{ characteristic }}-->
    <!--              </li>-->
    <!--            </ul>-->

    <!--            <ul v-if="location.warnings.length" class="flex flex-wrap gap-2">-->
    <!--              <li-->
    <!--                v-for="warning in location.warnings"-->
    <!--                :key="warning"-->
    <!--                :title="getWarningMeta(warning).label"-->
    <!--                class="flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800"-->
    <!--              >-->
    <!--                <UIcon-->
    <!--                  :name="getWarningMeta(warning).icon"-->
    <!--                  class="size-3.5 shrink-0"-->
    <!--                />-->
    <!--                <span>{{ getWarningMeta(warning).label }}</span>-->
    <!--              </li>-->
    <!--            </ul>-->

    <!--            <p class="text-sm text-slate-500">-->
    <!--              <template v-if="location.averageRating != null">-->
    <!--                Rating {{ location.averageRating }} ·-->
    <!--                {{ location.ratingCount }} ratings ·-->
    <!--              </template>-->
    <!--              <template v-else>No rating yet ·</template>-->
    <!--              {{ location.reviewCount }} reviews-->
    <!--            </p>-->

    <!--            <UButton-->
    <!--              :to="getLocationPath(location.name)"-->
    <!--              class="self-start"-->
    <!--              color="primary"-->
    <!--              icon="i-lucide-info"-->
    <!--              size="sm"-->
    <!--            >-->
    <!--              More information-->
    <!--            </UButton>-->
    <!--          </div>-->
    <!--        </article>-->
    <!--      </div>-->
  </div>
</template>

<style scoped></style>
