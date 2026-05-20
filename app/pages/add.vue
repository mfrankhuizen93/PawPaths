<script lang="ts" setup>
import type {
  EditableLocationFields,
  LocationCoordinateKind,
  LocationCoordinatePoint,
  LocationPhoto,
} from "#shared/types/locations";

const { isSignedIn } = useAuth();

const typeOptions = [
  "park",
  "nature reserve",
  "dog playground",
  "beach",
] as const;
const characteristicOptions = [
  "off-leash area",
  "fenced",
  "food and drink",
  "horse trails",
  "mountain bike trails",
  "swimming water",
  "walking trails",
  "wheelchair accessible",
] as const;
const pointKindOptions = [
  { label: "Parking location", value: "parking" },
  { label: "POI", value: "poi" },
  { label: "Entrance", value: "entrance" },
  { label: "Other", value: "other" },
] satisfies {
  label: string;
  value: Exclude<LocationCoordinateKind, "general">;
}[];

const isSubmitting = ref(false);
const isReverseGeocoding = ref(false);
const message = ref("");
const error = ref("");
const photoError = ref("");
const geocodeError = ref("");
const activePointId = ref("general");
let reverseGeocodeTimer: ReturnType<typeof window.setTimeout> | null = null;
const form = reactive<EditableLocationFields>({
  name: "",
  city: "",
  province: "",
  country: "Netherlands",
  latitude: null,
  longitude: null,
  type: [],
  characteristics: [],
  coordinatePoints: [],
  description: "",
  relatedUrls: [],
  photos: [],
});

const mapMarkers = computed(() => [
  {
    id: "general",
    kind: "general" as const,
    label: "General location",
    latitude: form.latitude,
    longitude: form.longitude,
  },
  ...(form.coordinatePoints ?? []),
]);

const activePoint = computed<LocationCoordinatePoint | null>(() => {
  if (activePointId.value === "general") return null;

  return (
    form.coordinatePoints?.find((point) => point.id === activePointId.value) ??
    null
  );
});

const activeLatitude = computed({
  get: () => activePoint.value?.latitude ?? form.latitude,
  set: (value: number | null) => {
    if (activePoint.value) {
      if (value !== null) activePoint.value.latitude = value;
      return;
    }

    form.latitude = value;
  },
});

const activeLongitude = computed({
  get: () => activePoint.value?.longitude ?? form.longitude,
  set: (value: number | null) => {
    if (activePoint.value) {
      if (value !== null) activePoint.value.longitude = value;
      return;
    }

    form.longitude = value;
  },
});

function toggleValue(values: string[], value: string, checked: boolean) {
  if (checked && !values.includes(value)) values.push(value);
  if (!checked) values.splice(values.indexOf(value), 1);
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

async function fileToLocationPhoto(file: File): Promise<LocationPhoto> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose JPG, PNG, or WebP photos.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Choose photos under 5 MB.");
  }

  const bitmap = await createImageBitmap(file);
  const maxSize = 1200;
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Could not process that photo.");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return {
    url: canvas.toDataURL("image/jpeg", 0.72),
    alt: form.name || file.name,
    width,
    height,
  };
}

async function handlePhotoChange(event: Event) {
  photoError.value = "";

  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []).slice(0, 4);
  input.value = "";

  if (!files.length) return;

  try {
    const photos = await Promise.all(files.map(fileToLocationPhoto));
    form.photos = [...(form.photos ?? []), ...photos].slice(0, 4);
  } catch (errorValue) {
    photoError.value = getErrorMessage(errorValue);
  }
}

function removePhoto(index: number) {
  form.photos = (form.photos ?? []).filter(
    (_, photoIndex) => photoIndex !== index,
  );
}

function getPointLabel(kind: LocationCoordinateKind) {
  return (
    pointKindOptions.find((option) => option.value === kind)?.label ?? "Point"
  );
}

function createPointId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function addCoordinatePoint(kind: Exclude<LocationCoordinateKind, "general">) {
  const point: LocationCoordinatePoint = {
    id: createPointId(),
    kind,
    label: getPointLabel(kind),
    latitude:
      Number.isFinite(form.latitude) && form.latitude !== null
        ? form.latitude
        : 52.1326,
    longitude:
      Number.isFinite(form.longitude) && form.longitude !== null
        ? form.longitude
        : 5.2913,
  };

  form.coordinatePoints = [...(form.coordinatePoints ?? []), point];
  activePointId.value = point.id ?? "general";
}

function removeCoordinatePoint(id: string | null | undefined) {
  form.coordinatePoints = (form.coordinatePoints ?? []).filter(
    (point) => point.id !== id,
  );

  if (activePointId.value === id) {
    activePointId.value = "general";
  }
}

async function reverseGeocodeGeneralLocation() {
  if (!Number.isFinite(form.latitude) || !Number.isFinite(form.longitude)) {
    return;
  }

  geocodeError.value = "";
  isReverseGeocoding.value = true;

  try {
    const response = await $fetch<{
      city?: string | null;
      province?: string | null;
      country?: string | null;
    }>("/api/geo/reverse", {
      query: {
        lat: form.latitude,
        lng: form.longitude,
      },
    });

    form.city = response.city ?? form.city;
    form.province = response.province ?? form.province;
    form.country = response.country ?? form.country;
  } catch {
    geocodeError.value = "Could not fill place details from the map point.";
  } finally {
    isReverseGeocoding.value = false;
  }
}

async function submitLocation() {
  error.value = "";
  message.value = "";
  isSubmitting.value = true;

  try {
    await $fetch("/api/locations", {
      method: "POST",
      body: form,
    });
    message.value = "Thanks. Your location is waiting for maintainer review.";
    form.name = "";
    form.city = "";
    form.province = "";
    form.latitude = null;
    form.longitude = null;
    form.type = [];
    form.characteristics = [];
    form.coordinatePoints = [];
    form.description = "";
    form.relatedUrls = [];
    form.photos = [];
  } catch (submitError) {
    error.value = getErrorMessage(submitError);
  } finally {
    isSubmitting.value = false;
  }
}

watch(
  () => [form.latitude, form.longitude],
  () => {
    if (reverseGeocodeTimer) {
      window.clearTimeout(reverseGeocodeTimer);
    }

    reverseGeocodeTimer = window.setTimeout(() => {
      void reverseGeocodeGeneralLocation();
    }, 650);
  },
);

onBeforeUnmount(() => {
  if (reverseGeocodeTimer) {
    window.clearTimeout(reverseGeocodeTimer);
  }
});
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
    <section class="flex flex-col gap-2">
      <p class="text-brand-600 text-sm font-semibold">Community</p>
      <h1 class="font-title text-3xl font-extrabold text-slate-950">
        Add a location
      </h1>
      <p class="max-w-2xl text-sm leading-6 text-slate-600">
        New places are reviewed by maintainers before they appear on the map.
      </p>
    </section>

    <UAlert
      v-if="!isSignedIn"
      color="warning"
      icon="i-lucide-lock"
      title="Sign in to submit a location."
      variant="soft"
    >
      <template #description>
        <UButton
          class="mt-3"
          icon="i-lucide-circle-user-round"
          label="Go to account"
          to="/account"
          variant="subtle"
        />
      </template>
    </UAlert>

    <form
      v-else
      class="flex flex-col gap-5 rounded-md border border-slate-200 bg-white p-5 shadow-sm"
      @submit.prevent="submitLocation"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Name" required>
          <UInput v-model="form.name" icon="i-lucide-map-pin" required />
        </UFormField>
        <UFormField label="City" required>
          <UInput v-model="form.city" icon="i-lucide-building-2" required />
        </UFormField>
        <UFormField label="Province">
          <UInput v-model="form.province" icon="i-lucide-map" />
        </UFormField>
        <UFormField label="Country">
          <UInput v-model="form.country" icon="i-lucide-globe-2" />
        </UFormField>
      </div>

      <UFormField label="Location points" required>
        <div class="flex flex-col gap-3">
          <AppLocationPointPicker
            v-model:latitude="activeLatitude"
            v-model:longitude="activeLongitude"
            :markers="mapMarkers"
          />
          <UAlert
            color="neutral"
            description="Choose a point below, then click the map to place it."
            icon="i-lucide-map-pin"
            title="Set location points"
            variant="soft"
          />
          <UAlert
            v-if="geocodeError"
            :title="geocodeError"
            color="warning"
            icon="i-lucide-map-pinned"
            variant="soft"
          />
          <div class="flex flex-wrap gap-2">
            <UButton
              color="neutral"
              icon="i-lucide-car"
              label="Add parking"
              type="button"
              variant="outline"
              @click="addCoordinatePoint('parking')"
            />
            <UButton
              color="neutral"
              icon="i-lucide-map-pinned"
              label="Add POI"
              type="button"
              variant="outline"
              @click="addCoordinatePoint('poi')"
            />
            <UButton
              color="neutral"
              icon="i-lucide-plus"
              label="Add other point"
              type="button"
              variant="outline"
              @click="addCoordinatePoint('other')"
            />
          </div>
          <div
            :class="
              activePointId === 'general'
                ? 'border-brand-500 bg-brand-50'
                : 'border-slate-200'
            "
            class="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_auto]"
          >
            <div class="flex min-w-0 items-center gap-3">
              <div
                class="bg-brand-100 text-brand-700 flex size-10 shrink-0 items-center justify-center rounded-full"
              >
                <UIcon name="i-lucide-map-pin" />
              </div>
              <div class="min-w-0">
                <p class="font-semibold text-slate-950">General location</p>
                <p class="text-sm text-slate-600">
                  Required map point for search and discovery.
                </p>
              </div>
            </div>
            <div class="flex items-center">
              <UButton
                :variant="activePointId === 'general' ? 'solid' : 'subtle'"
                color="neutral"
                icon="i-lucide-crosshair"
                label="Select"
                type="button"
                @click="activePointId = 'general'"
              />
            </div>
          </div>
          <div
            v-for="point in form.coordinatePoints"
            :key="point.id ?? point.label"
            :class="
              activePointId === point.id
                ? 'border-brand-500 bg-brand-50'
                : 'border-slate-200'
            "
            class="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_11rem_auto]"
          >
            <UFormField label="Label">
              <UInput v-model="point.label" />
            </UFormField>
            <UFormField label="Type">
              <select
                v-model="point.kind"
                class="focus:border-brand-500 h-9 rounded-md border border-slate-200 px-3 text-sm outline-none"
              >
                <option
                  v-for="option in pointKindOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </UFormField>
            <div class="flex items-end gap-2">
              <UButton
                color="neutral"
                icon="i-lucide-crosshair"
                label="Select"
                type="button"
                variant="subtle"
                @click="activePointId = point.id ?? 'general'"
              />
              <UButton
                color="error"
                icon="i-lucide-trash-2"
                type="button"
                variant="ghost"
                @click="removeCoordinatePoint(point.id)"
              />
            </div>
          </div>
          <p v-if="isReverseGeocoding" class="text-sm text-slate-500">
            Filling city, province, and country from the general location...
          </p>
        </div>
      </UFormField>

      <UFormField label="Description">
        <textarea
          v-model="form.description"
          class="focus:border-brand-500 min-h-32 w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none"
        />
      </UFormField>

      <UFormField label="Photos">
        <div class="flex flex-col gap-3">
          <div class="flex flex-wrap items-center gap-2">
            <UButton
              as="label"
              color="neutral"
              icon="i-lucide-image-plus"
              label="Select photos"
              variant="subtle"
            >
              <input
                accept="image/jpeg,image/png,image/webp"
                class="sr-only"
                multiple
                type="file"
                @change="handlePhotoChange"
              />
            </UButton>
            <span class="text-sm text-slate-500">
              {{ form.photos?.length ?? 0 }}/4 selected
            </span>
          </div>

          <UAlert
            v-if="photoError"
            :title="photoError"
            color="error"
            icon="i-lucide-image-off"
            variant="soft"
          />

          <div v-if="form.photos?.length" class="grid gap-3 sm:grid-cols-3">
            <div
              v-for="(photo, index) in form.photos"
              :key="`${photo.url.slice(0, 40)}-${index}`"
              class="relative overflow-hidden rounded-md border border-slate-200"
            >
              <img
                :alt="photo.alt || 'Selected location photo'"
                :src="photo.url"
                class="aspect-[4/3] w-full object-cover"
              />
              <UButton
                class="absolute top-2 right-2"
                color="neutral"
                icon="i-lucide-x"
                size="xs"
                variant="solid"
                @click="removePhoto(index)"
              />
            </div>
          </div>
        </div>
      </UFormField>

      <div class="grid gap-5 sm:grid-cols-2">
        <UFormField label="Type">
          <div class="grid gap-2">
            <label
              v-for="option in typeOptions"
              :key="option"
              class="flex items-center gap-2 text-sm text-slate-700"
            >
              <input
                :checked="form.type.includes(option)"
                class="size-4"
                type="checkbox"
                @change="
                  toggleValue(
                    form.type,
                    option,
                    ($event.target as HTMLInputElement).checked,
                  )
                "
              />
              {{ option }}
            </label>
          </div>
        </UFormField>

        <UFormField label="Characteristics">
          <div class="grid gap-2">
            <label
              v-for="option in characteristicOptions"
              :key="option"
              class="flex items-center gap-2 text-sm text-slate-700"
            >
              <input
                :checked="form.characteristics.includes(option)"
                class="size-4"
                type="checkbox"
                @change="
                  toggleValue(
                    form.characteristics,
                    option,
                    ($event.target as HTMLInputElement).checked,
                  )
                "
              />
              {{ option }}
            </label>
          </div>
        </UFormField>
      </div>

      <UAlert
        v-if="error"
        :title="error"
        color="error"
        icon="i-lucide-circle-alert"
        variant="soft"
      />
      <UAlert
        v-if="message"
        :title="message"
        color="success"
        icon="i-lucide-circle-check"
        variant="soft"
      />

      <div>
        <UButton
          :loading="isSubmitting"
          icon="i-lucide-send"
          label="Submit for review"
          type="submit"
        />
      </div>
    </form>
  </div>
</template>
