<script lang="ts" setup>
import type {
  EditableLocationFields,
  LocationCoordinatePoint,
  LocationListItem,
  LocationReview,
  LocationsResponse,
} from "#shared/types/locations";
import { locationCoordinateKindOptions } from "#shared/types/locations";
import { useExploreQuery } from "~/composables/states";
import AppPhotoModal from "~/components/AppPhotoModal.vue";
import type { TabsItem } from "@nuxt/ui/components/Tabs.vue";
import type { NavigationAppPreference } from "#shared/types/auth";

const route = useRoute();
const router = useRouter();
const { user, isSignedIn } = useAuth();

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
const showPhotoFullscreen = ref<boolean>(false);
const selectedPhotoIndex = ref(0);
const isSubmittingChange = ref(false);
const isSubmittingReview = ref(false);
const contributionMessage = ref("");
const contributionError = ref("");
const reviewMessage = ref("");
const reviewError = ref("");
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
    label: "Map",
    slot: "map",
  },
  {
    label: "Links",
    slot: "links",
  },
  {
    label: "Reviews",
    slot: "reviews",
  },
  {
    label: "Suggest edit",
    slot: "suggest-edit",
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
const selectedLocationError = ref("");
const isLocationDrawerOpen = computed({
  get: () => Boolean(selectedLocation.value),
  set: (open) => {
    if (open) return;

    selectedLocation.value = null;
    selectedLocationError.value = "";
    replaceLocationQuery(null);
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
const selectedLocationMapPoints = computed<LocationCoordinatePoint[]>(() => {
  if (!selectedLocation.value) return [];

  const points = [...(selectedLocation.value.coordinatePoints ?? [])].filter(
    (point) =>
      Number.isFinite(point.latitude) && Number.isFinite(point.longitude),
  );
  const hasGeneralPoint = points.some((point) => point.kind === "general");

  if (
    !hasGeneralPoint &&
    Number.isFinite(selectedLocation.value.latitude) &&
    Number.isFinite(selectedLocation.value.longitude)
  ) {
    points.unshift({
      id: `${selectedLocation.value.id}-general`,
      kind: "general",
      label: "General location",
      latitude: selectedLocation.value.latitude as number,
      longitude: selectedLocation.value.longitude as number,
    });
  }

  return points;
});
const selectedLocationMapCenter = computed(() => {
  const generalPoint = selectedLocationMapPoints.value.find(
    (point) => point.kind === "general",
  );
  const firstPoint = generalPoint ?? selectedLocationMapPoints.value[0];

  return firstPoint
    ? {
        latitude: firstPoint.latitude,
        longitude: firstPoint.longitude,
      }
    : null;
});

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

function getPointKindLabel(kind: LocationCoordinatePoint["kind"]) {
  return (
    locationCoordinateKindOptions.find((option) => option.value === kind)
      ?.label ?? "Point"
  );
}

function getPointLabel(point: LocationCoordinatePoint) {
  return point.label || getPointKindLabel(point.kind);
}

function getAppleMapsUrl(point: LocationCoordinatePoint) {
  const label = encodeURIComponent(getPointLabel(point));

  return `https://maps.apple.com/?daddr=${point.latitude},${point.longitude}&q=${label}`;
}

function getGoogleMapsUrl(point: LocationCoordinatePoint) {
  return `https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}`;
}

function getWazeUrl(point: LocationCoordinatePoint) {
  return `https://waze.com/ul?ll=${point.latitude},${point.longitude}&navigate=yes`;
}

function getDeviceNavigationPreference(): Exclude<
  NavigationAppPreference,
  "device"
> {
  if (!import.meta.client) return "google";

  const platform = navigator.platform.toLowerCase();
  const userAgent = navigator.userAgent.toLowerCase();

  if (
    platform.includes("mac") ||
    platform.includes("iphone") ||
    platform.includes("ipad") ||
    userAgent.includes("iphone") ||
    userAgent.includes("ipad")
  ) {
    return "apple";
  }

  return "google";
}

function getNavigationPreference() {
  const preference = user.value?.navigationAppPreference ?? "device";

  return preference === "device" ? getDeviceNavigationPreference() : preference;
}

function getNavigationLabel() {
  const labels: Record<Exclude<NavigationAppPreference, "device">, string> = {
    apple: "Apple Maps",
    google: "Google Maps",
    waze: "Waze",
  };

  return labels[getNavigationPreference()];
}

function getNavigationIcon() {
  return getNavigationPreference() === "google"
    ? "i-lucide-route"
    : "i-lucide-navigation";
}

function getNavigationUrl(point: LocationCoordinatePoint) {
  const preference = getNavigationPreference();

  if (preference === "apple") return getAppleMapsUrl(point);
  if (preference === "waze") return getWazeUrl(point);

  return getGoogleMapsUrl(point);
}

async function submitChange() {
  if (!selectedLocation.value) return;

  contributionError.value = "";
  contributionMessage.value = "";
  isSubmittingChange.value = true;

  try {
    await $fetch(`/api/locations/${selectedLocation.value.slug}/changes`, {
      method: "POST",
      body: changeForm,
    });
    contributionMessage.value =
      "Thanks. Your suggested change is waiting for maintainer review.";
  } catch (errorValue) {
    contributionError.value = getErrorMessage(errorValue);
  } finally {
    isSubmittingChange.value = false;
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

async function openLocationBySlug(slug: string) {
  if (!slug) {
    selectedLocation.value = null;
    selectedLocationError.value = "";
    return;
  }

  if (selectedLocation.value?.slug === slug) return;

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
  selectedLocation.value = location;
  selectedLocationError.value = "";
  syncChangeForm(location);
  replaceLocationQuery(location.slug);
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

await openLocationBySlug(getLocationQuerySlug());

watch(
  () => getLocationQuerySlug(),
  (slug) => {
    void openLocationBySlug(slug);
  },
);

watch(selectedLocation, (location) => {
  syncChangeForm(location);
  contributionError.value = "";
  contributionMessage.value = "";
  reviewError.value = "";
  reviewMessage.value = "";
});
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-6">
    <div
      v-if="pending && locations.length === 0"
      class="border-default flex min-h-72 flex-1 flex-col gap-4 rounded-lg border p-4"
    >
      <div class="flex items-center justify-between gap-4">
        <USkeleton class="h-10 w-48" />
        <USkeleton class="h-10 w-24" />
      </div>
      <USkeleton class="min-h-56 w-full flex-1" />
    </div>

    <div
      v-if="error || selectedLocationError"
      class="rounded-md border border-red-200 bg-red-50 p-4 text-red-800"
    >
      {{ selectedLocationError || error }}
      <button
        v-if="error"
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
          :location="selectedLocation"
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
      :close-threshold="0.2"
      direction="bottom"
    >
      <template #header>
        <div v-if="selectedLocation" class="flex flex-col gap-4">
          <div v-if="selectedLocation?.type?.[0] && selectedLocationMeta">
            <p class="text-brand-600 text-sm font-semibold">
              {{ getTypeMeta(selectedLocation.type[0])?.label }}
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
            :location-name="selectedLocation.name"
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
                v-slot="{ item, index }"
                :items="selectedLocation?.photos"
                :virtualize="{
                  gap: 4,
                  lanes: 2,
                  estimateSize: 480,
                }"
                class="h-128 w-full"
                orientation="vertical"
              >
                <NuxtImg
                  :alt="item.alt"
                  :height="item.height"
                  :src="item.url"
                  :width="item.width"
                  class="size-full rounded-md object-cover"
                  loading="lazy"
                  @click="
                    showPhotoFullscreen = true;
                    selectedPhotoIndex = index;
                  "
                />
              </UScrollArea>

              <AppPhotoModal
                v-if="selectedLocation"
                v-model="showPhotoFullscreen"
                :index="selectedPhotoIndex"
                :location-name="selectedLocation.name"
                :photos="selectedLocation?.photos"
              />
            </template>
            <template #map>
              <div class="flex flex-col gap-4">
                <AppLocationPointPicker
                  v-if="selectedLocationMapPoints.length > 0"
                  :latitude="selectedLocationMapCenter?.latitude"
                  :longitude="selectedLocationMapCenter?.longitude"
                  :markers="selectedLocationMapPoints"
                  readonly
                />

                <UAlert
                  v-else
                  color="neutral"
                  icon="i-lucide-map-pin-off"
                  title="No mapped points for this location yet."
                  variant="soft"
                />

                <div
                  v-if="selectedLocationMapPoints.length > 0"
                  class="grid gap-3"
                >
                  <article
                    v-for="point in selectedLocationMapPoints"
                    :key="
                      point.id ??
                      `${point.kind}-${point.latitude}-${point.longitude}`
                    "
                    class="rounded-md border border-slate-200 bg-white p-4"
                  >
                    <div
                      class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-2">
                          <p class="font-semibold text-slate-950">
                            {{ getPointLabel(point) }}
                          </p>
                          <UBadge color="neutral" variant="soft">
                            {{ getPointKindLabel(point.kind) }}
                          </UBadge>
                        </div>
                        <p class="mt-1 text-sm text-slate-600">
                          {{ point.latitude.toFixed(6) }},
                          {{ point.longitude.toFixed(6) }}
                        </p>
                      </div>

                      <div class="flex flex-wrap gap-2">
                        <UButton
                          :icon="getNavigationIcon()"
                          :label="getNavigationLabel()"
                          :to="getNavigationUrl(point)"
                          color="neutral"
                          target="_blank"
                          variant="outline"
                        />
                      </div>
                    </div>
                  </article>
                </div>
              </div>
            </template>
            <template #reviews>
              <div class="flex flex-col gap-5">
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
                      <UBadge
                        v-if="review.rating"
                        color="neutral"
                        variant="soft"
                      >
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
            <template #suggest-edit>
              <AppLocationForm
                v-if="isSignedIn"
                v-model="changeForm"
                :error="contributionError"
                :message="contributionMessage"
                point-help="Adjust the location points that should be changed."
                :reset-key="selectedLocation?.id"
                :submitting="isSubmittingChange"
                submit-label="Submit change"
                @submit="submitChange"
              />

              <UAlert
                v-else
                color="warning"
                icon="i-lucide-lock"
                title="Sign in to suggest a change."
                variant="soft"
              />
            </template>
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
