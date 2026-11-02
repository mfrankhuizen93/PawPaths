<script lang="ts" setup>
import type {
  EditableLocationFields,
  LocationFilters,
  LocationListItem,
  LocationReview,
  LocationsResponse,
} from "#shared/types/locations";
import {
  readLocationSearch,
  writeLocationSearch,
} from "#shared/utils/location-search";
import type { SearchBounds } from "#shared/utils/location-search";
import LocationSearchToolbar from "~/components/location/LocationSearchToolbar.vue";
import LocationSearchResults from "~/components/location/LocationSearchResults.vue";
import LocationSearchCard from "~/components/location/LocationSearchCard.vue";
import LocationNavigation from "~/components/location/LocationNavigation.vue";
import AppDrawer from "~/components/drawer/AppDrawer.vue";
import AppDrawerActions from "~/components/drawer/AppDrawerActions.vue";
import {
  canDeleteLocation,
  canSuggestLocationUnavailable,
} from "#shared/utils/location-permissions";

const route = useRoute();
const router = useRouter();
const { isAdmin, isSignedIn, user } = useAuth();
const authDrawer = useAuthDrawer();
const addLocationDrawerOpen = useAddLocationDrawer();
const toast = useToast();

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
const searchState = computed(() => readLocationSearch(route.query));
const activeFilters = computed({
  get: () => searchState.value.filters,
  set: (filters) => {
    const spatialChanged = (["lat", "lng", "radiusKm"] as const).some(
      (key) => filters[key] !== activeFilters.value[key],
    );
    void router.replace({
      query: writeLocationSearch(
        {
          ...searchState.value,
          filters,
          bounds: spatialChanged ? undefined : searchState.value.bounds,
        },
        route.query,
      ),
    });
  },
});
const searchMode = computed({
  get: () => searchState.value.mode,
  set: (mode) => {
    previewLocation.value = null;
    void router.replace({
      query: writeLocationSearch({ ...searchState.value, mode }, route.query),
    });
  },
});
const previewLocation = ref<LocationListItem | null>(null);
const mapResults = ref<LocationsResponse | null>(null);
function setSearchBounds(bounds: SearchBounds) {
  if (
    (["west", "east", "south", "north"] as const).every(
      (key) => bounds[key] === searchState.value.bounds?.[key],
    )
  )
    return;
  void router.replace({
    query: writeLocationSearch({ ...searchState.value, bounds }, route.query),
  });
}
const displayedCount = computed(() =>
  searchMode.value === "map"
    ? (mapResults.value?.items.length ?? locations.value.length)
    : locations.value.length,
);
const displayedTotal = computed(() =>
  searchMode.value === "map"
    ? (mapResults.value?.total ?? total.value)
    : total.value,
);
const loadingMore = ref(false);
const loadMoreError = ref("");
const nextCursor = ref<string | null>(null);
async function loadMoreLocations() {
  if (!nextCursor.value || loadingMore.value || pending.value) return;
  loadingMore.value = true;
  loadMoreError.value = "";
  const queryKey = JSON.stringify(locationsQuery.value);
  try {
    const response = await $fetch<LocationsResponse>("/api/locations", {
      query: { ...locationsQuery.value, cursor: nextCursor.value },
    });
    if (queryKey !== JSON.stringify(locationsQuery.value)) return;
    locations.value = [...locations.value, ...response.items];
    nextCursor.value = response.nextCursor ?? null;
  } catch {
    if (queryKey === JSON.stringify(locationsQuery.value)) {
      loadMoreError.value = "Could not load more locations. Please try again.";
    }
  } finally {
    loadingMore.value = false;
  }
}
function clearSearch() {
  previewLocation.value = null;
  void router.replace({
    query: writeLocationSearch(
      { filters: {}, mode: searchMode.value, bounds: undefined },
      route.query,
    ),
  });
}

const isSubmittingChange = ref(false);
const isSubmittingReview = ref(false);
const contributionMessage = ref("");
const contributionError = ref("");
const reviewMessage = ref("");
const reviewError = ref("");
const locationMode = ref<"view" | "edit">("view");
const changeBaseline = ref("");
const deleteDialogOpen = ref(false);
const isDeletingLocation = ref(false);
const changeForm = reactive<EditableLocationFields>({
  name: "",
  city: "",
  province: "",
  country: "",
  latitude: null,
  longitude: null,
  type: [],
  characteristics: [],
  description: "",
  relatedUrls: [],
  photos: [],
  coordinatePoints: [],
});
const reviewForm = reactive({
  rating: 5,
  text: "",
});

const locationsQuery = computed<LocationFilters & { limit: number }>(
  (previous) => {
    const query = { limit: 20, ...activeFilters.value };
    // Viewport and mode changes must not refetch or reset the paginated list.
    return previous && JSON.stringify(previous) === JSON.stringify(query)
      ? previous
      : query;
  },
);

const { data, error, pending, refresh } = await useFetch<LocationsResponse>(
  "/api/locations",
  {
    query: locationsQuery,
  },
);

const locations = ref<LocationListItem[]>([]);
const total = ref(0);
const selectedLocation = ref<LocationListItem | null>(null);
const selectedLocationError = ref("");
const isLocationDrawerOpen = computed({
  get: () => Boolean(selectedLocation.value),
  set: (open) => {
    if (open) return;

    closeLocationDrawer();
  },
});
const hasUnsavedLocationChanges = computed(
  () =>
    locationMode.value === "edit" &&
    JSON.stringify(changeForm) !== changeBaseline.value,
);
const currentRole = computed(() => user.value?.role ?? null);
const locationMenuItems = computed(() => [
  [
    {
      label: "Edit",
      icon: "i-lucide-pencil",
      onSelect() {
        requestSuggestEdit();
      },
    },
    ...(canSuggestLocationUnavailable(currentRole.value) &&
    !canDeleteLocation(currentRole.value)
      ? [
          {
            label: "Suggest unavailable",
            icon: "i-lucide-ban",
            onSelect() {
              void suggestLocationUnavailable();
            },
          },
        ]
      : []),
    ...(canDeleteLocation(currentRole.value)
      ? [
          {
            label: "Delete",
            icon: "i-lucide-trash-2",
            color: "error" as const,
            onSelect() {
              deleteDialogOpen.value = true;
            },
          },
        ]
      : []),
  ],
]);

function closeLocationDrawer() {
  locationMode.value = "view";
  selectedLocation.value = null;
  selectedLocationError.value = "";
  replaceLocationQuery(null);
}

function beginEditing() {
  syncChangeForm(selectedLocation.value);
  changeBaseline.value = JSON.stringify(changeForm);
  contributionError.value = "";
  contributionMessage.value = "";
  locationMode.value = "edit";
}

function requestSuggestEdit() {
  if (!isSignedIn.value) {
    authDrawer.show("suggest-edit");
    return;
  }

  beginEditing();
}

const selectedLocationMeta = computed(() =>
  [selectedLocation.value?.city, selectedLocation.value?.country]
    .filter(Boolean)
    .join(", "),
);
watch(
  data,
  (response) => {
    loadMoreError.value = "";
    locations.value = response?.items ?? [];
    total.value = response?.total ?? 0;
    nextCursor.value = response?.nextCursor ?? null;
  },
  { immediate: true },
);

watch(
  () => [isSignedIn.value, authDrawer.intent.value] as const,
  ([signedIn, intent]) => {
    if (!signedIn || intent !== "suggest-edit") return;

    authDrawer.close();

    if (selectedLocation.value) {
      beginEditing();
    }
  },
);

function applyMapResults(response: LocationsResponse) {
  mapResults.value = response;
}

function openAddLocation() {
  if (isSignedIn.value) {
    addLocationDrawerOpen.value = true;
  } else {
    authDrawer.show("add");
  }
}

function getErrorMessage(errorValue: unknown) {
  if (
    typeof errorValue === "object" &&
    errorValue &&
    "data" in errorValue &&
    typeof errorValue.data === "object" &&
    errorValue.data &&
    "statusMessage" in errorValue.data
  ) {
    return String(errorValue.data.statusMessage);
  }

  return errorValue instanceof Error
    ? errorValue.message
    : "Something went wrong. Please try again.";
}

function syncChangeForm(location: LocationListItem | null) {
  changeForm.name = location?.name ?? "";
  changeForm.city = location?.city ?? "";
  changeForm.province = location?.province ?? "";
  changeForm.country = location?.country ?? "Netherlands";
  changeForm.latitude = location?.latitude ?? null;
  changeForm.longitude = location?.longitude ?? null;
  changeForm.type = [...(location?.type ?? [])];
  changeForm.characteristics = [...(location?.characteristics ?? [])];
  changeForm.attributes = location?.attributes
    ? { ...location.attributes }
    : undefined;
  changeForm.routes = location?.routes?.map((route) => ({ ...route }));
  changeForm.description = location?.description ?? "";
  changeForm.relatedUrls = (location?.relatedUrls ?? []).map((url) => ({
    ...url,
  }));
  changeForm.photos = (location?.photos ?? []).map((photo) => ({ ...photo }));
  changeForm.coordinatePoints = (location?.coordinatePoints ?? []).map(
    (point) => ({ ...point }),
  );
}

function getReviewName(review: LocationReview) {
  return review.reviewer ?? review.reviewerName ?? "PawPaths user";
}

function getReviewDate(review: LocationReview) {
  if (review.dateText) return review.dateText;
  if (typeof review.date === "string") return review.date.slice(0, 10);

  return "";
}

async function submitChange() {
  if (!selectedLocation.value || isSubmittingChange.value) return;

  contributionError.value = "";
  contributionMessage.value = "";
  isSubmittingChange.value = true;

  try {
    await $fetch(`/api/locations/${selectedLocation.value.slug}/changes`, {
      method: "POST",
      body: changeForm,
    });
    syncChangeForm(selectedLocation.value);
    changeBaseline.value = JSON.stringify(changeForm);
    locationMode.value = "view";
    toast.add({
      title: "Changes submitted",
      description: "Your changes will be reviewed before they appear.",
      color: "success",
      icon: "i-lucide-circle-check",
    });
  } catch (errorValue) {
    contributionError.value = getErrorMessage(errorValue);
  } finally {
    isSubmittingChange.value = false;
  }
}

function getUnavailableSuggestionDescription(description: string | undefined) {
  const note =
    "**Maintainer note**\nThis location may no longer be available, relevant, or open. Please verify before keeping it published.";
  const currentDescription = description?.trim();

  return currentDescription ? `${note}\n\n${currentDescription}` : note;
}

async function suggestLocationUnavailable() {
  if (
    !selectedLocation.value ||
    !canSuggestLocationUnavailable(currentRole.value) ||
    canDeleteLocation(currentRole.value) ||
    isSubmittingChange.value
  ) {
    return;
  }

  syncChangeForm(selectedLocation.value);
  changeForm.description = getUnavailableSuggestionDescription(
    changeForm.description,
  );
  changeBaseline.value = JSON.stringify({});

  await submitChange();
}

async function deleteLocation() {
  if (!selectedLocation.value || !canDeleteLocation(currentRole.value)) return;

  isDeletingLocation.value = true;

  try {
    await $fetch(`/api/locations/${selectedLocation.value.slug}`, {
      method: "DELETE",
    });
    locations.value = locations.value.filter(
      (location) => location.id !== selectedLocation.value?.id,
    );
    deleteDialogOpen.value = false;
    closeLocationDrawer();
  } catch (errorValue) {
    selectedLocationError.value = getErrorMessage(errorValue);
  } finally {
    isDeletingLocation.value = false;
  }
}

async function submitReview() {
  if (!selectedLocation.value) return;

  reviewError.value = "";
  reviewMessage.value = "";
  isSubmittingReview.value = true;

  try {
    const response = await $fetch<{ review: LocationReview }>(
      `/api/locations/${selectedLocation.value.slug}/reviews`,
      {
        method: "POST",
        body: reviewForm,
      },
    );
    selectedLocation.value.reviews = [
      ...(selectedLocation.value.reviews ?? []),
      response.review,
    ];
    selectedLocation.value.reviewCount += 1;
    reviewForm.rating = 5;
    reviewForm.text = "";
    reviewMessage.value = "Review added. Thank you.";
  } catch (errorValue) {
    reviewError.value = getErrorMessage(errorValue);
  } finally {
    isSubmittingReview.value = false;
  }
}

function getLocationQuerySlug() {
  const value = route.query.location;

  if (Array.isArray(value)) return value[0] ?? "";

  return typeof value === "string" ? value : "";
}

function replaceLocationQuery(slug: string | null) {
  const query = { ...route.query };

  if (slug) {
    query.location = slug;
  } else {
    delete query.location;
  }

  void router.replace({ query });
}

async function openLocationBySlug(
  slug: string,
  options: { force?: boolean } = {},
) {
  if (!slug) {
    selectedLocation.value = null;
    selectedLocationError.value = "";
    return;
  }

  if (!options.force && selectedLocation.value?.slug === slug) return;

  selectedLocationError.value = "";

  try {
    selectedLocation.value = await $fetch<LocationListItem>(
      `/api/locations/${slug}`,
    );
  } catch {
    selectedLocation.value = null;
    selectedLocationError.value = "Location not found";
  }
}

function selectLocation(location: LocationListItem) {
  previewLocation.value = null;
  locationMode.value = "view";
  selectedLocation.value = location;
  selectedLocationError.value = "";
  syncChangeForm(location);
  replaceLocationQuery(location.slug);
  void openLocationBySlug(location.slug, { force: true });
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

watch(
  () => JSON.stringify(activeFilters.value),
  () => {
    previewLocation.value = null;
    mapResults.value = null;
  },
);

definePageMeta({
  layout: "explore",
});

await openLocationBySlug(getLocationQuerySlug());

watch(
  () => getLocationQuerySlug(),
  (slug) => {
    void openLocationBySlug(slug);
  },
);

watch(
  selectedLocation,
  (location) => {
    syncChangeForm(location);
    changeBaseline.value = JSON.stringify(changeForm);
    contributionError.value = "";
    contributionMessage.value = "";
    reviewError.value = "";
    reviewMessage.value = "";
  },
  { immediate: true },
);
</script>

<template>
  <div class="relative flex h-full min-h-0 flex-col">
    <LocationSearchToolbar
      v-model="activeFilters"
      v-model:mode="searchMode"
      :result-count="displayedCount"
      :total="displayedTotal"
      :truncated="searchMode === 'map' && mapResults?.metadata.truncated"
      @add="openAddLocation"
    />
    <UAlert
      v-if="error || selectedLocationError"
      :title="selectedLocationError || 'Could not load locations'"
      color="error"
      :actions="[{ label: 'Retry', onClick: () => refresh() }]"
    />
    <div class="relative min-h-0 flex-1">
      <LocationSearchResults
        v-if="searchMode === 'list'"
        :locations="locations"
        :pending="pending"
        :more="Boolean(nextCursor)"
        :loading-more="loadingMore"
        :load-more-error="loadMoreError"
        :load-more="loadMoreLocations"
        @select="selectLocation"
        @clear="clearSearch"
      />
      <ClientOnly v-else>
        <LazyAppLocation
          :filters="activeFilters"
          :search-bounds="searchState.bounds"
          :show-toolbar="false"
          :limit="1000"
          :location="previewLocation ?? selectedLocation"
          :locations="locations"
          class="h-full"
          variant="search"
          @location-selected="previewLocation = $event"
          @locations-loaded="applyMapResults"
          @bounds-changed="setSearchBounds"
        />
        <template #fallback
          ><USkeleton class="size-full rounded-none"
        /></template>
      </ClientOnly>
      <div
        v-if="searchMode === 'map' && previewLocation"
        class="absolute inset-x-3 bottom-[max(2.5rem,env(safe-area-inset-bottom))] z-10 mx-auto max-w-md"
        aria-live="polite"
      >
        <LocationSearchCard
          :location="previewLocation"
          @select="selectLocation"
        />
      </div>
    </div>

    <AppDrawer
      :dirty="hasUnsavedLocationChanges"
      full-height
      :open="isLocationDrawerOpen"
      :title="selectedLocation?.name"
      @update:open="isLocationDrawerOpen = $event"
    >
      <template #header>
        <div v-if="selectedLocation" class="flex flex-col gap-4">
          <div class="flex items-start gap-3">
            <div class="min-w-0 flex-1">
              <p
                v-if="selectedLocation?.type?.[0]"
                class="text-primary text-sm font-semibold"
              >
                {{ getTypeMeta(selectedLocation.type[0])?.label }}
              </p>
              <h2 class="font-title text-highlighted text-2xl font-extrabold">
                {{ selectedLocation?.name }}
              </h2>
              <p v-if="selectedLocationMeta" class="text-muted text-sm">
                {{ selectedLocationMeta }}
              </p>
            </div>

            <UDropdownMenu :items="locationMenuItems">
              <UButton
                aria-label="Location actions"
                color="neutral"
                icon="i-lucide-ellipsis-vertical"
                variant="ghost"
              />
            </UDropdownMenu>
          </div>

          <div class="flex gap-3 overflow-x-auto pb-1">
            <LocationNavigation
              :key="selectedLocation.id"
              :points="selectedLocation.coordinatePoints"
              :general-location="selectedLocation"
            />
            <UButton
              color="neutral"
              icon="i-lucide-pencil"
              label="Suggest edit"
              variant="soft"
              @click="requestSuggestEdit"
            />
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
        </div>
      </template>
      <template #default>
        <LazyAppLocationForm
          v-if="selectedLocation"
          v-model="changeForm"
          :can-generate-description="isAdmin"
          :contained="false"
          :error="contributionError"
          form-id="location-detail-form"
          :message="contributionMessage"
          :readonly="locationMode === 'view'"
          :reset-key="`${selectedLocation.id}-${locationMode}`"
          :show-features="locationMode === 'edit'"
          :show-reviews="locationMode === 'view'"
          :show-submit="false"
          :submitting="isSubmittingChange"
          @submit="submitChange"
        >
          <template #reviews>
            <div class="flex flex-col gap-5 pt-4">
              <form
                v-if="isSignedIn"
                class="flex flex-col gap-3 rounded-md border border-slate-200 bg-white p-4"
                @submit.prevent="submitReview"
              >
                <div class="grid gap-3 sm:grid-cols-[8rem_1fr]">
                  <UFormField label="Rating">
                    <UInput
                      v-model.number="reviewForm.rating"
                      max="5"
                      min="1"
                      type="number"
                    />
                  </UFormField>
                  <UFormField label="Review">
                    <UTextarea
                      v-model="reviewForm.text"
                      autoresize
                      class="w-full"
                      required
                    />
                  </UFormField>
                </div>
                <UAlert
                  v-if="reviewError"
                  :title="reviewError"
                  color="error"
                  icon="i-lucide-circle-alert"
                  variant="soft"
                />
                <UAlert
                  v-if="reviewMessage"
                  :title="reviewMessage"
                  color="success"
                  icon="i-lucide-circle-check"
                  variant="soft"
                />
                <div>
                  <UButton
                    :loading="isSubmittingReview"
                    icon="i-lucide-star"
                    label="Add review"
                    type="submit"
                  />
                </div>
              </form>

              <UAlert
                v-else
                color="warning"
                icon="i-lucide-lock"
                title="Sign in to add a review."
                variant="soft"
              />

              <div class="flex flex-col gap-3">
                <article
                  v-for="(review, index) in selectedLocation.reviews"
                  :key="`${getReviewName(review)}-${index}`"
                  class="rounded-md border border-slate-200 bg-white p-4"
                >
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="font-semibold text-slate-950">
                      {{ getReviewName(review) }}
                    </p>
                    <UBadge v-if="review.rating" color="neutral" variant="soft">
                      {{ review.rating }}/5
                    </UBadge>
                    <span class="text-xs text-slate-500">
                      {{ getReviewDate(review) }}
                    </span>
                  </div>
                  <p
                    class="mt-2 text-sm leading-6 whitespace-pre-line text-slate-700"
                  >
                    {{ review.text }}
                  </p>
                </article>
              </div>
            </div>
          </template>
        </LazyAppLocationForm>
      </template>

      <template
        v-if="selectedLocation && locationMode === 'edit'"
        #actions="{ close }"
      >
        <AppDrawerActions>
          <UButton
            color="neutral"
            label="Cancel"
            type="button"
            variant="subtle"
            @click="close"
          />
          <UButton
            form="location-detail-form"
            icon="i-lucide-save"
            label="Save"
            :loading="isSubmittingChange"
            type="submit"
          />
        </AppDrawerActions>
      </template>
    </AppDrawer>

    <UModal
      v-model:open="deleteDialogOpen"
      :close="false"
      description="This permanently removes the location from PawPaths."
      title="Delete this location?"
    >
      <template #footer>
        <AppDrawerActions>
          <UButton
            color="neutral"
            label="Cancel"
            variant="subtle"
            @click="deleteDialogOpen = false"
          />
          <UButton
            color="error"
            icon="i-lucide-trash-2"
            label="Delete"
            :loading="isDeletingLocation"
            @click="deleteLocation"
          />
        </AppDrawerActions>
      </template>
    </UModal>

    <LazyLocationAddDrawer />
  </div>
</template>

<style scoped></style>
