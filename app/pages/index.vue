<script lang="ts" setup>
import type {
  EditableLocationFields,
  LocationListItem,
  LocationReview,
  LocationsResponse,
} from "#shared/types/locations";
import { useExploreQuery } from "~/composables/states";
import AppDrawer from "~/components/drawer/AppDrawer.vue";
import AppDrawerActions from "~/components/drawer/AppDrawerActions.vue";
import LocationAddDrawer from "~/components/location/LocationAddDrawer.vue";

const route = useRoute();
const router = useRouter();
const { isAdmin, isSignedIn } = useAuth();
const authDrawer = useAuthDrawer();

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

    closeLocationDrawer();
  },
});
const hasUnsavedLocationChanges = computed(
  () =>
    locationMode.value === "edit" &&
    JSON.stringify(changeForm) !== changeBaseline.value,
);
const locationMenuItems = computed(() => [
  [
    {
      label: "Edit",
      icon: "i-lucide-pencil",
      onSelect() {
        if (!isSignedIn.value) {
          authDrawer.show("profile");
          return;
        }

        beginEditing();
      },
    },
    {
      label: "Delete",
      icon: "i-lucide-trash-2",
      color: "error" as const,
      disabled: !isAdmin.value,
      onSelect() {
        deleteDialogOpen.value = true;
      },
    },
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

const selectedLocationMeta = computed(() =>
  [selectedLocation.value?.city, selectedLocation.value?.country]
    .filter(Boolean)
    .join(", "),
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
    changeBaseline.value = JSON.stringify(changeForm);
  } catch (errorValue) {
    contributionError.value = getErrorMessage(errorValue);
  } finally {
    isSubmittingChange.value = false;
  }
}

async function deleteLocation() {
  if (!selectedLocation.value || !isAdmin.value) return;

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
  locationMode.value = "view";
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
  changeBaseline.value = JSON.stringify(changeForm);
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

    <AppDrawer
      :dirty="hasUnsavedLocationChanges"
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
                class="text-brand-600 text-sm font-semibold"
              >
                {{ getTypeMeta(selectedLocation.type[0])?.label }}
              </p>
              <h2 class="font-title text-2xl font-extrabold text-slate-950">
                {{ selectedLocation?.name }}
              </h2>
              <p v-if="selectedLocationMeta" class="text-sm text-slate-600">
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
        <AppLocationForm
          v-if="selectedLocation"
          v-model="changeForm"
          :error="contributionError"
          form-id="location-detail-form"
          :message="contributionMessage"
          point-help="Adjust the location points that should be changed."
          :readonly="locationMode === 'view'"
          :reset-key="selectedLocation.id"
          :show-features="locationMode === 'edit'"
          :show-reviews="locationMode === 'view'"
          :show-submit="false"
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
        </AppLocationForm>
      </template>

      <template v-if="selectedLocation" #actions="{ close }">
        <AppDrawerActions>
          <UButton
            color="neutral"
            label="Cancel"
            type="button"
            variant="subtle"
            @click="close"
          />
          <UButton
            v-if="locationMode === 'edit'"
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

    <LocationAddDrawer />
  </div>
</template>

<style scoped></style>
