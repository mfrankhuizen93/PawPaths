<script lang="ts" setup>
import type {
  EditableLocationFields,
  LocationCoordinateKind,
  LocationCoordinatePoint,
  LocationPhoto,
} from "#shared/types/locations";
import { locationCoordinateKindOptions } from "#shared/types/locations";
import { z } from "zod";

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
const pointKindOptions = locationCoordinateKindOptions.filter(
  (option) => option.value !== "general",
) as {
  label: string;
  value: Exclude<LocationCoordinateKind, "general">;
}[];
const pointKindValues = pointKindOptions.map((option) => option.value);
const typeItems = typeOptions.map((option) => ({
  label: option,
  value: option,
}));
const characteristicItems = characteristicOptions.map((option) => ({
  label: option,
  value: option,
}));

function isPointKind(
  value: unknown,
): value is Exclude<LocationCoordinateKind, "general"> {
  return (
    typeof value === "string" &&
    pointKindValues.includes(
      value as Exclude<LocationCoordinateKind, "general">,
    )
  );
}

const locationPhotoSchema = z
  .object({
    url: z.string().min(1),
    alt: z.string().nullable().optional(),
    width: z.number().nullable().optional(),
    height: z.number().nullable().optional(),
    capturedAt: z.string().nullable().optional(),
    uploadedAt: z.string().nullable().optional(),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
    sourceName: z.string().nullable().optional(),
  })
  .passthrough();

const coordinatePointSchema = z.object({
  id: z.string().nullable().optional(),
  kind: z.custom<Exclude<LocationCoordinateKind, "general">>(isPointKind, {
    message: "Choose a point type.",
  }),
  label: z.string().trim().min(1, "Enter a point label."),
  latitude: z.number().finite("Set this point on the map."),
  longitude: z.number().finite("Set this point on the map."),
  sourcePhotoId: z.string().nullable().optional(),
});

const addLocationSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a location name."),
    city: z.string().trim().min(1, "Enter a city."),
    province: z.string().nullable().optional(),
    country: z.string().trim().min(1, "Enter a country."),
    latitude: z.number().finite().nullable(),
    longitude: z.number().finite().nullable(),
    type: z.array(z.enum(typeOptions)).min(1, "Choose at least one type."),
    characteristics: z.array(z.enum(characteristicOptions)),
    coordinatePoints: z.array(coordinatePointSchema),
    description: z.string().optional(),
    relatedUrls: z
      .array(
        z.object({
          label: z.string(),
          url: z.string(),
        }),
      )
      .optional(),
    photos: z
      .array(locationPhotoSchema)
      .max(4, "Choose no more than 4 photos.")
      .optional(),
  })
  .superRefine((value, context) => {
    if (!Number.isFinite(value.latitude) || !Number.isFinite(value.longitude)) {
      context.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "Set the general location on the map.",
      });
    }
  });

const isSubmitting = ref(false);
const isReverseGeocoding = ref(false);
const message = ref("");
const error = ref("");
const photoError = ref("");
const geocodeError = ref("");
const activePointId = ref("general");
const photoFiles = ref<File[]>([]);
let reverseGeocodeTimer: ReturnType<typeof window.setTimeout> | null = null;

type PhotoMetadata = {
  capturedAt?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

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

function readAscii(view: DataView, offset: number, length: number) {
  let value = "";

  for (let index = 0; index < length; index += 1) {
    const code = view.getUint8(offset + index);
    if (code === 0) break;
    value += String.fromCharCode(code);
  }

  return value.trim();
}

function readExifDate(value: string | null | undefined) {
  if (!value) return null;

  const match = value.match(
    /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/,
  );

  if (!match) return null;

  const [, year, month, day, hours, minutes, seconds] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    Number(seconds),
  );

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function readRational(view: DataView, offset: number, littleEndian: boolean) {
  const numerator = view.getUint32(offset, littleEndian);
  const denominator = view.getUint32(offset + 4, littleEndian);

  return denominator ? numerator / denominator : 0;
}

function getExifTagValue(
  view: DataView,
  tiffOffset: number,
  entryOffset: number,
  littleEndian: boolean,
) {
  const type = view.getUint16(entryOffset + 2, littleEndian);
  const count = view.getUint32(entryOffset + 4, littleEndian);
  const valueOffset = entryOffset + 8;
  const typeSize =
    type === 2 || type === 7 ? 1 : type === 3 ? 2 : type === 4 ? 4 : 8;
  const byteLength = count * typeSize;
  const dataOffset =
    byteLength <= 4
      ? valueOffset
      : tiffOffset + view.getUint32(valueOffset, littleEndian);

  if (type === 2) return readAscii(view, dataOffset, count);
  if (type === 3) return view.getUint16(dataOffset, littleEndian);
  if (type === 4) return view.getUint32(dataOffset, littleEndian);
  if (type === 5) {
    return Array.from({ length: count }, (_, index) =>
      readRational(view, dataOffset + index * 8, littleEndian),
    );
  }

  return null;
}

function readIfd(
  view: DataView,
  tiffOffset: number,
  ifdOffset: number,
  littleEndian: boolean,
) {
  const tags = new Map<number, unknown>();
  const entryCount = view.getUint16(ifdOffset, littleEndian);

  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = ifdOffset + 2 + index * 12;
    const tag = view.getUint16(entryOffset, littleEndian);
    tags.set(tag, getExifTagValue(view, tiffOffset, entryOffset, littleEndian));
  }

  return tags;
}

function gpsToDecimal(values: unknown, ref: unknown) {
  if (!Array.isArray(values) || values.length < 3) return null;

  const decimal =
    Number(values[0]) + Number(values[1]) / 60 + Number(values[2]) / 3600;
  const direction = typeof ref === "string" ? ref.toUpperCase() : "";

  return direction === "S" || direction === "W" ? -decimal : decimal;
}

function parseExifMetadata(buffer: ArrayBuffer): PhotoMetadata {
  const view = new DataView(buffer);

  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return {};

  let offset = 2;

  while (offset + 4 < view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;

    const marker = view.getUint8(offset + 1);
    const size = view.getUint16(offset + 2);

    if (marker === 0xe1 && readAscii(view, offset + 4, 6) === "Exif") {
      const tiffOffset = offset + 10;
      const littleEndian = readAscii(view, tiffOffset, 2) === "II";
      const firstIfdOffset =
        tiffOffset + view.getUint32(tiffOffset + 4, littleEndian);
      const ifd0 = readIfd(view, tiffOffset, firstIfdOffset, littleEndian);
      const exifOffset = Number(ifd0.get(0x8769));
      const gpsOffset = Number(ifd0.get(0x8825));
      const exif =
        Number.isFinite(exifOffset) && exifOffset > 0
          ? readIfd(view, tiffOffset, tiffOffset + exifOffset, littleEndian)
          : new Map<number, unknown>();
      const gps =
        Number.isFinite(gpsOffset) && gpsOffset > 0
          ? readIfd(view, tiffOffset, tiffOffset + gpsOffset, littleEndian)
          : new Map<number, unknown>();
      const latitude = gpsToDecimal(gps.get(0x0002), gps.get(0x0001));
      const longitude = gpsToDecimal(gps.get(0x0004), gps.get(0x0003));

      return {
        capturedAt: readExifDate(
          String(
            exif.get(0x9003) ?? exif.get(0x9004) ?? ifd0.get(0x0132) ?? "",
          ),
        ),
        latitude,
        longitude,
      };
    }

    offset += 2 + size;
  }

  return {};
}

async function fileToLocationPhoto(file: File): Promise<LocationPhoto> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose JPG, PNG, or WebP photos.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Choose photos under 5 MB.");
  }

  const buffer = await file.arrayBuffer();
  const metadata = parseExifMetadata(buffer);
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
    id: createPointId(),
    url: canvas.toDataURL("image/jpeg", 0.72),
    alt: form.name || file.name,
    width,
    height,
    capturedAt: metadata.capturedAt ?? null,
    uploadedAt: new Date().toISOString(),
    latitude: metadata.latitude ?? null,
    longitude: metadata.longitude ?? null,
    sourceName: file.name,
  };
}

function addPoiFromPhoto(photo: LocationPhoto) {
  if (!Number.isFinite(photo.latitude) || !Number.isFinite(photo.longitude)) {
    return;
  }

  const existingPoint = form.coordinatePoints?.some(
    (point) =>
      point.kind === "poi" &&
      Math.abs(point.latitude - (photo.latitude as number)) < 0.00001 &&
      Math.abs(point.longitude - (photo.longitude as number)) < 0.00001,
  );

  if (existingPoint) return;

  const point: LocationCoordinatePoint = {
    id: createPointId(),
    kind: "poi",
    label: photo.sourceName ? `Photo: ${photo.sourceName}` : "Photo POI",
    latitude: Number((photo.latitude as number).toFixed(6)),
    longitude: Number((photo.longitude as number).toFixed(6)),
    sourcePhotoId: photo.id ?? null,
  };

  form.coordinatePoints = [...(form.coordinatePoints ?? []), point];
  activePointId.value = point.id ?? "general";
}

async function handlePhotoChange() {
  photoError.value = "";

  const files = photoFiles.value.slice(0, 4);
  photoFiles.value = [];

  if (!files.length) return;

  try {
    const photos = await Promise.all(files.map(fileToLocationPhoto));
    form.photos = [...(form.photos ?? []), ...photos].slice(0, 4);
    photos.forEach(addPoiFromPhoto);
  } catch (errorValue) {
    photoError.value = getErrorMessage(errorValue);
  }
}

function removePhoto(index: number) {
  const photoId = form.photos?.[index]?.id;
  form.photos = (form.photos ?? []).filter(
    (_, photoIndex) => photoIndex !== index,
  );

  if (photoId) {
    form.coordinatePoints = (form.coordinatePoints ?? []).filter(
      (point) => point.sourcePhotoId !== photoId,
    );
  }
}

function formatPhotoDate(value: string | null | undefined) {
  if (!value) return "";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getPointLabel(kind: LocationCoordinateKind) {
  return (
    pointKindOptions.find((option) => option.value === kind)?.label ?? "Point"
  );
}

function updatePointKind(
  point: LocationCoordinatePoint,
  kind: Exclude<LocationCoordinateKind, "general">,
) {
  const currentDefaultLabel = getPointLabel(point.kind);
  const nextDefaultLabel = getPointLabel(kind);
  const shouldUpdateLabel =
    !point.label.trim() || point.label === currentDefaultLabel;

  point.kind = kind;

  if (shouldUpdateLabel) {
    point.label = nextDefaultLabel;
  }
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

function resetForm() {
  if (reverseGeocodeTimer) {
    window.clearTimeout(reverseGeocodeTimer);
    reverseGeocodeTimer = null;
  }

  activePointId.value = "general";
  form.name = "";
  form.city = "";
  form.province = "";
  form.country = "Netherlands";
  form.latitude = null;
  form.longitude = null;
  form.type = [];
  form.characteristics = [];
  form.coordinatePoints = [];
  form.description = "";
  form.relatedUrls = [];
  form.photos = [];
  photoFiles.value = [];
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
    resetForm();
  } catch (submitError) {
    error.value = getErrorMessage(submitError);
  } finally {
    isSubmitting.value = false;
  }
}

watch(
  () => [form.latitude, form.longitude],
  ([latitude, longitude]) => {
    if (reverseGeocodeTimer) {
      window.clearTimeout(reverseGeocodeTimer);
      reverseGeocodeTimer = null;
    }

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      geocodeError.value = "";
      isReverseGeocoding.value = false;
      return;
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

    <UForm
      v-else
      :schema="addLocationSchema"
      :state="form"
      class="flex flex-col gap-5 rounded-md border border-slate-200 bg-white p-5 shadow-sm"
      @submit="submitLocation"
    >
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Name" name="name" required>
          <UInput v-model="form.name" icon="i-lucide-map-pin" required />
        </UFormField>
        <UFormField label="City" name="city" required>
          <UInput v-model="form.city" icon="i-lucide-building-2" required />
        </UFormField>
        <UFormField label="Province" name="province">
          <UInput v-model="form.province" icon="i-lucide-map" />
        </UFormField>
        <UFormField label="Country" name="country">
          <UInput v-model="form.country" icon="i-lucide-globe-2" />
        </UFormField>
      </div>

      <UFormField label="Location points" name="latitude" required>
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
              icon="i-lucide-door-open"
              label="Add entrance"
              type="button"
              variant="outline"
              @click="addCoordinatePoint('entrance')"
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
            v-for="(point, pointIndex) in form.coordinatePoints"
            :key="point.id ?? point.label"
            :class="
              activePointId === point.id
                ? 'border-brand-500 bg-brand-50'
                : 'border-slate-200'
            "
            class="grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_11rem_auto]"
          >
            <UFormField
              label="Label"
              :name="`coordinatePoints.${pointIndex}.label`"
            >
              <UInput v-model="point.label" />
            </UFormField>
            <UFormField
              label="Type"
              :name="`coordinatePoints.${pointIndex}.kind`"
            >
              <USelect
                :items="pointKindOptions"
                :model-value="point.kind"
                class="w-full"
                @update:model-value="
                  updatePointKind(
                    point,
                    $event as Exclude<LocationCoordinateKind, 'general'>,
                  )
                "
              />
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

      <UFormField label="Description" name="description">
        <UTextarea
          v-model="form.description"
          autoresize
          class="w-full"
          :rows="5"
        />
      </UFormField>

      <UFormField label="Photos" name="photos">
        <div class="flex flex-col gap-3">
          <div class="flex flex-wrap items-center gap-2">
            <UFileUpload
              v-model="photoFiles"
              v-slot="{ open }"
              accept="image/jpeg,image/png,image/webp"
              :dropzone="false"
              multiple
              :preview="false"
              reset
              @change="handlePhotoChange"
            >
              <UButton
                color="neutral"
                icon="i-lucide-image-plus"
                label="Select photos"
                type="button"
                variant="subtle"
                @click="open()"
              />
            </UFileUpload>
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
              <div
                class="border-t border-slate-200 bg-white p-2 text-xs text-slate-600"
              >
                <p v-if="photo.capturedAt">
                  Taken {{ formatPhotoDate(photo.capturedAt) }}
                </p>
                <p v-else>Photo date unavailable</p>
                <p v-if="photo.latitude && photo.longitude">
                  POI created from photo location
                </p>
              </div>
              <UButton
                class="absolute top-2 right-2"
                color="neutral"
                icon="i-lucide-x"
                size="xs"
                type="button"
                variant="solid"
                @click="removePhoto(index)"
              />
            </div>
          </div>
        </div>
      </UFormField>

      <div class="grid gap-5 sm:grid-cols-2">
        <UFormField label="Type" name="type">
          <UCheckboxGroup v-model="form.type" :items="typeItems" name="type" />
        </UFormField>

        <UFormField label="Characteristics" name="characteristics">
          <UCheckboxGroup
            v-model="form.characteristics"
            :items="characteristicItems"
            name="characteristics"
          />
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
    </UForm>
  </div>
</template>
