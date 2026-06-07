<script lang="ts" setup>
import type {
  EditableLocationFields,
  LocationCoordinateKind,
  LocationCoordinatePoint,
  LocationPhoto,
} from "#shared/types/locations";
import { locationCoordinateKindOptions } from "#shared/types/locations";
import { isLocationDescriptionTemplate } from "#shared/utils/location-description";
import type { TabsItem } from "@nuxt/ui/components/Tabs.vue";
import { z } from "zod";
import AppTabs from "~/components/common/AppTabs.vue";

const props = withDefaults(
  defineProps<{
    error?: string;
    canGenerateDescription?: boolean;
    message?: string;
    pointHelp?: string;
    resetKey?: string | number | null;
    submitLabel?: string;
    submitting?: boolean;
    showSubmit?: boolean;
    readonly?: boolean;
    showFeatures?: boolean;
    showReviews?: boolean;
    formId?: string;
  }>(),
  {
    error: "",
    canGenerateDescription: false,
    message: "",
    pointHelp: "Choose a point below, then click the map to place it.",
    resetKey: null,
    submitLabel: "Submit for review",
    submitting: false,
    showSubmit: true,
    readonly: false,
    showFeatures: true,
    showReviews: false,
    formId: undefined,
  },
);

const emit = defineEmits<{
  submit: [];
}>();

const form = defineModel<EditableLocationFields>({ required: true });

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
const formTabs = computed<TabsItem[]>(() => [
  { label: "Details", slot: "details", icon: "i-lucide-file-text" },
  { label: "Map", slot: "map", icon: "i-lucide-map" },
  { label: "Photos", slot: "photos", icon: "i-lucide-images" },
  { label: "Links", slot: "links", icon: "i-lucide-link" },
  ...(props.showFeatures
    ? [
        {
          label: "Features",
          slot: "features",
          icon: "i-lucide-list-checks",
        },
      ]
    : []),
  ...(props.showReviews
    ? [{ label: "Reviews", slot: "reviews", icon: "i-lucide-star" }]
    : []),
]);
const secondaryToolbarButtonClass = "hidden sm:inline-flex";
const descriptionEditorToolbarItems = [
  [
    {
      icon: "i-lucide-bold",
      kind: "mark",
      mark: "bold",
      tooltip: { text: "Bold" },
    },
    {
      icon: "i-lucide-italic",
      kind: "mark",
      mark: "italic",
      tooltip: { text: "Italic" },
    },
    {
      icon: "i-lucide-strikethrough",
      kind: "mark",
      mark: "strike",
      class: secondaryToolbarButtonClass,
      tooltip: { text: "Strikethrough" },
    },
  ],
  [
    {
      icon: "i-lucide-quote",
      kind: "blockquote",
      class: secondaryToolbarButtonClass,
      tooltip: { text: "Quote" },
    },
    {
      icon: "i-lucide-list",
      kind: "bulletList",
      tooltip: { text: "Bullet list" },
    },
    {
      icon: "i-lucide-list-ordered",
      kind: "orderedList",
      tooltip: { text: "Numbered list" },
    },
    {
      icon: "i-lucide-link",
      kind: "link",
      class: secondaryToolbarButtonClass,
      tooltip: { text: "Link" },
    },
    {
      icon: "i-lucide-remove-formatting",
      kind: "clearFormatting",
      class: secondaryToolbarButtonClass,
      tooltip: { text: "Clear formatting" },
    },
  ],
  [
    {
      icon: "i-lucide-undo-2",
      kind: "undo",
      tooltip: { text: "Undo" },
    },
    {
      icon: "i-lucide-redo-2",
      kind: "redo",
      tooltip: { text: "Redo" },
    },
  ],
];
const acceptedPhotoTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as string[];
const largePhotoSizeBytes = 2 * 1024 * 1024;
const largePhotoDimension = 1800;
const compressedPhotoMaxDimension = 1600;
const compressedPhotoQuality = 0.74;

const photoFiles = ref<File[]>([]);
const activePointId = ref("general");
const isReverseGeocoding = ref(false);
const geocodeError = ref("");
const descriptionGenerationError = ref("");
const isGeneratingDescription = ref(false);
const locationForm = ref<{
  clear: (name?: string | RegExp) => void;
  setErrors: (
    errors: {
      name?: string;
      message: string;
    }[],
    name?: string | RegExp,
  ) => void;
} | null>(null);
let reverseGeocodeTimer: ReturnType<typeof window.setTimeout> | null = null;

type PhotoMetadata = {
  capturedAt?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

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

const photoFileSchema = z
  .custom<File>(
    (value) => typeof File !== "undefined" && value instanceof File,
    { message: "Choose JPG, PNG, or WebP photos." },
  )
  .refine((file) => acceptedPhotoTypes.includes(file.type), {
    message: "Choose JPG, PNG, or WebP photos.",
  });

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

const locationSchema = z
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
    photos: z.array(locationPhotoSchema).optional(),
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

const generalLocationMarker = computed({
  get: () => ({
    id: "general",
    kind: "general" as const,
    label: "General location",
    latitude: form.value.latitude,
    longitude: form.value.longitude,
  }),
  set: (value: LocationCoordinatePoint) => {
    form.value.latitude = value.latitude;
    form.value.longitude = value.longitude;
  },
});

const mapMarkers = computed(() => [
  generalLocationMarker.value,
  ...(form.value.coordinatePoints ?? []),
]);

const activePoint = computed<LocationCoordinatePoint | null>(() => {
  if (activePointId.value === "general") return null;

  return (
    form.value.coordinatePoints?.find(
      (point) => point.id === activePointId.value,
    ) ?? null
  );
});

const activeLatitude = computed({
  get: () => activePoint.value?.latitude ?? form.value.latitude,
  set: (value: number | null) => {
    if (activePoint.value) {
      if (value !== null) activePoint.value.latitude = value;
      return;
    }

    form.value.latitude = value;
  },
});

const activeLongitude = computed({
  get: () => activePoint.value?.longitude ?? form.value.longitude,
  set: (value: number | null) => {
    if (activePoint.value) {
      if (value !== null) activePoint.value.longitude = value;
      return;
    }

    form.value.longitude = value;
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

function getZodErrorMessage(errorValue: unknown) {
  if (errorValue instanceof z.ZodError) {
    return errorValue.issues[0]?.message ?? "Choose valid photos.";
  }

  return getErrorMessage(errorValue);
}

function parsePhotoFiles(files: File[]) {
  return z.array(photoFileSchema).min(1).parse(files);
}

function setPhotoFieldError(message: string) {
  locationForm.value?.setErrors([{ name: "photos", message }], "photos");
}

function clearPhotoFieldError() {
  locationForm.value?.clear("photos");
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

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () =>
      reject(new Error("Could not process that photo.")),
    );
    reader.readAsDataURL(file);
  });
}

async function fileToLocationPhoto(file: File): Promise<LocationPhoto> {
  const buffer = await file.arrayBuffer();
  const metadata = parseExifMetadata(buffer);
  const bitmap = await createImageBitmap(file);
  const shouldCompress =
    file.size > largePhotoSizeBytes ||
    Math.max(bitmap.width, bitmap.height) > largePhotoDimension;
  const scale = shouldCompress
    ? Math.min(
        1,
        compressedPhotoMaxDimension / Math.max(bitmap.width, bitmap.height),
      )
    : 1;
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  if (!shouldCompress) {
    const url = await fileToDataUrl(file);
    bitmap.close();

    return {
      id: createPointId(),
      url,
      alt: form.value.name || file.name,
      width,
      height,
      capturedAt: metadata.capturedAt ?? null,
      uploadedAt: new Date().toISOString(),
      latitude: metadata.latitude ?? null,
      longitude: metadata.longitude ?? null,
      sourceName: file.name,
    };
  }

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
    url: canvas.toDataURL("image/jpeg", compressedPhotoQuality),
    alt: form.value.name || file.name,
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

  const existingPoint = form.value.coordinatePoints?.some(
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

  form.value.coordinatePoints = [...(form.value.coordinatePoints ?? []), point];
  activePointId.value = point.id ?? "general";
}

async function handlePhotoChange() {
  clearPhotoFieldError();

  const files = photoFiles.value;
  photoFiles.value = [];

  if (!files.length) return;

  try {
    const validFiles = parsePhotoFiles(files);
    const photos = await Promise.all(validFiles.map(fileToLocationPhoto));
    form.value.photos = [...(form.value.photos ?? []), ...photos];
    photos.forEach(addPoiFromPhoto);
  } catch (errorValue) {
    setPhotoFieldError(getZodErrorMessage(errorValue));
  }
}

function removePhoto(index: number) {
  const photoId = form.value.photos?.[index]?.id;
  form.value.photos = (form.value.photos ?? []).filter(
    (_, photoIndex) => photoIndex !== index,
  );

  if (photoId) {
    form.value.coordinatePoints = (form.value.coordinatePoints ?? []).filter(
      (point) => point.sourcePhotoId !== photoId,
    );
  }
}

function addRelatedUrl() {
  form.value.relatedUrls = [
    ...(form.value.relatedUrls ?? []),
    { label: "", url: "" },
  ];
}

function removeRelatedUrl(index: number) {
  form.value.relatedUrls = (form.value.relatedUrls ?? []).filter(
    (_, urlIndex) => urlIndex !== index,
  );
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
      Number.isFinite(form.value.latitude) && form.value.latitude !== null
        ? form.value.latitude
        : 52.1326,
    longitude:
      Number.isFinite(form.value.longitude) && form.value.longitude !== null
        ? form.value.longitude
        : 5.2913,
  };

  form.value.coordinatePoints = [...(form.value.coordinatePoints ?? []), point];
  activePointId.value = point.id ?? "general";
}

function removeCoordinatePoint(id: string | null | undefined) {
  form.value.coordinatePoints = (form.value.coordinatePoints ?? []).filter(
    (point) => point.id !== id,
  );

  if (activePointId.value === id) {
    activePointId.value = "general";
  }
}

async function reverseGeocodeGeneralLocation() {
  if (
    props.readonly ||
    activePointId.value !== "general" ||
    !Number.isFinite(form.value.latitude) ||
    !Number.isFinite(form.value.longitude)
  ) {
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
        lat: form.value.latitude,
        lng: form.value.longitude,
      },
    });

    form.value.city = response.city ?? form.value.city;
    form.value.province = response.province ?? form.value.province;
    form.value.country = response.country ?? form.value.country;
  } catch {
    geocodeError.value = "Could not fill place details from the map point.";
  } finally {
    isReverseGeocoding.value = false;
  }
}

function submitForm() {
  emit("submit");
}

async function generateDescription() {
  if (!props.canGenerateDescription || isGeneratingDescription.value) return;

  descriptionGenerationError.value = "";
  isGeneratingDescription.value = true;

  try {
    const response = await $fetch<{ description: string }>(
      "/api/location-description",
      {
        method: "POST",
        body: form.value,
      },
    );

    form.value.description = response.description;
  } catch (errorValue) {
    descriptionGenerationError.value = getErrorMessage(errorValue);
  } finally {
    isGeneratingDescription.value = false;
  }
}

function resetLocalState() {
  activePointId.value = "general";
  photoFiles.value = [];
  clearPhotoFieldError();
  descriptionGenerationError.value = "";
}

watch(
  () => [form.value.latitude, form.value.longitude],
  ([latitude, longitude]) => {
    if (props.readonly) return;

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

watch(
  () => props.resetKey,
  () => resetLocalState(),
);

onBeforeUnmount(() => {
  if (reverseGeocodeTimer) {
    window.clearTimeout(reverseGeocodeTimer);
  }
});
</script>

<template>
  <UForm
    ref="locationForm"
    :id="formId"
    :schema="locationSchema"
    :state="form"
    class="flex flex-col gap-5 rounded-md border border-slate-200 bg-white p-5 shadow-sm"
    @submit="submitForm"
  >
    <AppTabs :items="formTabs">
      <template #details>
        <div class="grid gap-4 pt-4">
          <UFormField label="Name" name="name" required>
            <UInput
              v-model="form.name"
              icon="i-lucide-map-pin"
              :readonly="readonly"
              required
            />
          </UFormField>

          <UFormField
            description="Answer the prompts with practical, specific information."
            label="Description"
            name="description"
          >
            <div v-if="!readonly" class="mb-2 flex justify-end">
              <UButton
                v-if="canGenerateDescription"
                color="primary"
                icon="i-lucide-sparkles"
                :label="
                  isLocationDescriptionTemplate(form.description) ||
                  !form.description?.trim()
                    ? 'Generate description'
                    : 'Regenerate description'
                "
                :loading="isGeneratingDescription"
                size="sm"
                type="button"
                variant="subtle"
                @click="generateDescription"
              />
            </div>
            <UEditor
              v-model="form.description"
              :editable="!readonly"
              class="min-h-32 w-full min-w-0 overflow-hidden rounded-md border border-slate-200 bg-white"
              content-type="markdown"
              placeholder="Describe this location..."
              :ui="{
                content: 'min-h-32',
                base: 'min-h-32 px-3 py-2 text-base leading-5 font-sans text-slate-950 sm:px-3 *:my-0 [&_p]:leading-5 [&_p]:my-0 [&_:is(h1,h2,h3,h4,h5,h6)]:font-title',
              }"
            >
              <template v-if="!readonly" #default="{ editor }">
                <div
                  class="w-full min-w-0 overflow-hidden border-b border-slate-200 px-2 py-1"
                >
                  <UEditorToolbar
                    :editor="editor"
                    :items="descriptionEditorToolbarItems"
                    class="w-full flex-wrap gap-y-1"
                  />
                </div>
              </template>
            </UEditor>
            <UAlert
              v-if="descriptionGenerationError"
              class="mt-2"
              :title="descriptionGenerationError"
              color="error"
              icon="i-lucide-circle-alert"
              variant="soft"
            />
          </UFormField>

          <div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="City" name="city" required>
              <UInput
                v-model="form.city"
                icon="i-lucide-building-2"
                :readonly="readonly"
                required
              />
            </UFormField>
            <UFormField label="Country" name="country" required>
              <UInput
                v-model="form.country"
                icon="i-lucide-globe-2"
                :readonly="readonly"
                required
              />
            </UFormField>
          </div>

          <div
            v-if="!showFeatures && !readonly"
            class="grid gap-5 sm:grid-cols-2"
          >
            <UFormField label="Type" name="type">
              <UCheckboxGroup
                v-model="form.type"
                :items="typeItems"
                name="type"
              />
            </UFormField>

            <UFormField label="Characteristics" name="characteristics">
              <UCheckboxGroup
                v-model="form.characteristics"
                :items="characteristicItems"
                name="characteristics"
              />
            </UFormField>
          </div>
        </div>
      </template>

      <template #map>
        <UFormField
          class="pt-4"
          label="Location points"
          name="latitude"
          required
        >
          <div class="flex flex-col gap-3">
            <AppLocationPointPicker
              v-model:latitude="activeLatitude"
              v-model:longitude="activeLongitude"
              :markers="mapMarkers"
              :readonly="readonly"
            />
            <UAlert
              v-if="!readonly"
              color="neutral"
              :description="pointHelp"
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
            <div v-if="!readonly" class="flex flex-wrap gap-2">
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
            <MapMarkerCard
              v-model="generalLocationMarker"
              :is-active="activePointId === 'general'"
              :readonly="readonly"
              @click="activePointId = 'general'"
            />

            <template
              v-for="(point, pointIndex) in form.coordinatePoints"
              :key="point.id + '-' + pointIndex"
            >
              <MapMarkerCard
                v-if="form?.coordinatePoints?.[pointIndex]"
                v-model="form.coordinatePoints[pointIndex]"
                :is-active="activePointId === point.id"
                :readonly="readonly"
                @click="activePointId = point.id ?? 'general'"
                @remove="removeCoordinatePoint"
              />
            </template>
            <p v-if="isReverseGeocoding" class="text-sm text-slate-500">
              Filling city and country from the general location...
            </p>
          </div>
        </UFormField>
      </template>

      <template #photos>
        <UFormField
          class="pt-4"
          description="Photos with location data can automatically create a POI on the map."
          label="Photos"
          name="photos"
        >
          <div class="flex flex-col gap-3">
            <div v-if="!readonly" class="flex flex-wrap items-center gap-2">
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
                {{ form.photos?.length ?? 0 }} selected
              </span>
            </div>

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
                  v-if="!readonly"
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
      </template>

      <template #links>
        <div class="flex flex-col gap-4 pt-4">
          <template v-if="readonly">
            <UButton
              v-for="(url, index) in form.relatedUrls"
              :key="`${index}-${url.url}`"
              class="self-start"
              color="neutral"
              icon="i-lucide-square-arrow-out-up-right"
              :label="url.label || url.url"
              target="_blank"
              :to="url.url"
              variant="outline"
            />
          </template>

          <template v-else>
            <div
              v-for="(url, index) in form.relatedUrls"
              :key="`${index}-${url.url}`"
              class="grid gap-3 sm:grid-cols-[1fr_2fr_auto]"
            >
              <UFormField :name="`relatedUrls.${index}.label`" label="Label">
                <UInput
                  v-model="url.label"
                  class="w-full"
                  placeholder="Website"
                />
              </UFormField>
              <UFormField :name="`relatedUrls.${index}.url`" label="URL">
                <UInput
                  v-model="url.url"
                  class="w-full"
                  icon="i-lucide-link"
                  placeholder="https://"
                  type="url"
                />
              </UFormField>
              <div class="flex items-end">
                <UButton
                  aria-label="Remove link"
                  color="error"
                  icon="i-lucide-trash-2"
                  type="button"
                  variant="subtle"
                  @click="removeRelatedUrl(index)"
                />
              </div>
            </div>
          </template>

          <AppEmptyState
            v-if="readonly && !form.relatedUrls?.length"
            description="No related links have been added."
            icon="i-lucide-link"
            title="No links"
          />

          <UButton
            v-if="!readonly"
            class="self-start"
            color="neutral"
            icon="i-lucide-plus"
            label="Add link"
            type="button"
            variant="subtle"
            @click="addRelatedUrl"
          />
        </div>
      </template>

      <template #features>
        <div class="grid gap-5 pt-4 sm:grid-cols-2">
          <UFormField label="Type" name="type">
            <UCheckboxGroup
              v-model="form.type"
              :disabled="readonly"
              :items="typeItems"
              name="type"
            />
          </UFormField>

          <UFormField label="Characteristics" name="characteristics">
            <UCheckboxGroup
              v-model="form.characteristics"
              :disabled="readonly"
              :items="characteristicItems"
              name="characteristics"
            />
          </UFormField>
        </div>
      </template>

      <template #reviews>
        <slot name="reviews" />
      </template>
    </AppTabs>

    <UAlert
      v-if="props.error"
      :title="props.error"
      color="error"
      icon="i-lucide-circle-alert"
      variant="soft"
    />
    <UAlert
      v-if="props.message"
      :title="props.message"
      color="success"
      icon="i-lucide-circle-check"
      variant="soft"
    />

    <slot name="actions">
      <div v-if="showSubmit">
        <UButton
          :loading="submitting"
          icon="i-lucide-send"
          :label="submitLabel"
          type="submit"
        />
      </div>
    </slot>
  </UForm>
</template>
