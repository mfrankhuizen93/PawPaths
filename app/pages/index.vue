<script lang="ts" setup>
import type {
  EditableLocationFields,
  LocationListItem,
  LocationReview,
  LocationsResponse,
} from "#shared/types/locations";
import { useExploreQuery } from "~/composables/states";
import AppPhotoModal from "~/components/AppPhotoModal.vue";
import type { TabsItem } from "@nuxt/ui/components/Tabs.vue";

const route = useRoute();
const router = useRouter();
const { isSignedIn } = useAuth();

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
  changeForm.relatedUrls = [...(location?.relatedUrls ?? [])];
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
      class="rounded-md border border-slate-200 bg-white p-4 text-slate-600"
    >
      Loading locations...
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
                      <textarea
                        v-model="reviewForm.text"
                        class="focus:border-brand-500 min-h-24 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none"
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
              <form
                v-if="isSignedIn"
                class="flex flex-col gap-4 rounded-md border border-slate-200 bg-white p-4"
                @submit.prevent="submitChange"
              >
                <div class="grid gap-3 sm:grid-cols-2">
                  <UFormField label="Name">
                    <UInput v-model="changeForm.name" icon="i-lucide-map-pin" />
                  </UFormField>
                  <UFormField label="City">
                    <UInput
                      v-model="changeForm.city"
                      icon="i-lucide-building-2"
                    />
                  </UFormField>
                  <UFormField label="Province">
                    <UInput v-model="changeForm.province" icon="i-lucide-map" />
                  </UFormField>
                  <UFormField label="Country">
                    <UInput
                      v-model="changeForm.country"
                      icon="i-lucide-globe-2"
                    />
                  </UFormField>
                  <UFormField label="Latitude">
                    <UInput
                      v-model.number="changeForm.latitude"
                      step="any"
                      type="number"
                    />
                  </UFormField>
                  <UFormField label="Longitude">
                    <UInput
                      v-model.number="changeForm.longitude"
                      step="any"
                      type="number"
                    />
                  </UFormField>
                </div>

                <UFormField label="Description">
                  <textarea
                    v-model="changeForm.description"
                    class="focus:border-brand-500 min-h-32 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none"
                  />
                </UFormField>

                <UAlert
                  v-if="contributionError"
                  :title="contributionError"
                  color="error"
                  icon="i-lucide-circle-alert"
                  variant="soft"
                />
                <UAlert
                  v-if="contributionMessage"
                  :title="contributionMessage"
                  color="success"
                  icon="i-lucide-circle-check"
                  variant="soft"
                />
                <div>
                  <UButton
                    :loading="isSubmittingChange"
                    icon="i-lucide-send"
                    label="Submit change"
                    type="submit"
                  />
                </div>
              </form>

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
