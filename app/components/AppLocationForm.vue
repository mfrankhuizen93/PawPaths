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
import AppPhotoLanes from "~/components/AppPhotoLanes.vue";

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
    contained?: boolean;
    mapEditingLocked?: boolean;
  }>(),
  {
    error: "",
    canGenerateDescription: false,
    message: "",
    pointHelp:
      "Click the map to set the general location. Add another point below, then click the map to place it.",
    resetKey: null,
    submitLabel: "Submit for review",
    submitting: false,
    showSubmit: true,
    readonly: false,
    showFeatures: true,
    showReviews: false,
    formId: undefined,
    contained: true,
    mapEditingLocked: false,
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
const typeLabels: Record<(typeof typeOptions)[number], string> = {
  park: "Park",
  "nature reserve": "Nature Reserve",
  "dog playground": "Dog Playground",
  beach: "Beach",
};
const characteristicLabels: Record<
  (typeof characteristicOptions)[number],
  string
> = {
  "off-leash area": "Off-leash Area",
  fenced: "Fenced",
  "food and drink": "Food and Drink",
  "horse trails": "Horse Trails",
  "mountain bike trails": "Mountain Bike Trails",
  "swimming water": "Swimming Water",
  "walking trails": "Walking Trails",
  "wheelchair accessible": "Wheelchair Accessible",
};
const pointKindOptions = locationCoordinateKindOptions.filter(
  (option) => option.value !== "general",
) as {
  label: string;
  value: Exclude<LocationCoordinateKind, "general">;
}[];
const coordinateKindValues = new Set<LocationCoordinateKind>(
  locationCoordinateKindOptions.map((option) => option.value),
);
const typeItems: { label: string; value: string }[] = typeOptions.map(
  (option) => ({
    label: typeLabels[option],
    value: option,
  }),
);
const characteristicItems: { label: string; value: string }[] =
  characteristicOptions.map((option) => ({
    label: characteristicLabels[option],
    value: option,
  }));
const typeOptionValues = new Set<string>(typeOptions);
const characteristicOptionValues = new Set<string>(characteristicOptions);
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
const mapPointActionButtonClass = "h-7 px-2 text-xs";
const baseDescriptionEditorToolbarItems = [
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
const isMapEditorOpen = ref(false);
const activePointId = ref<string | null>(
  props.mapEditingLocked ? null : "general",
);
const pendingPointKind = ref<Exclude<LocationCoordinateKind, "general"> | null>(
  null,
);
const renamingPointId = ref<string | null>(null);
const renamingPointLabel = ref("");
const isReverseGeocoding = ref(false);
const geocodeError = ref("");
const descriptionGenerationError = ref("");
const isGeneratingDescription = ref(false);
const descriptionEditorToolbarItems = computed(() => [
  ...baseDescriptionEditorToolbarItems,
  ...(props.canGenerateDescription && !props.readonly
    ? [
        [
          {
            "aria-label":
              isLocationDescriptionTemplate(form.value.description) ||
              !form.value.description?.trim()
                ? "Generate description"
                : "Regenerate description",
            color: "primary" as const,
            icon: "i-lucide-sparkles",
            loading: isGeneratingDescription.value,
            tooltip: {
              text:
                isLocationDescriptionTemplate(form.value.description) ||
                !form.value.description?.trim()
                  ? "Generate description"
                  : "Regenerate description",
            },
            variant: "subtle" as const,
            onClick: (event: Event) => {
              event.stopPropagation();
              void generateDescription();
            },
          },
        ],
      ]
    : []),
]);
const pointKindOptionMap = new Map(
  pointKindOptions.map((option) => [option.value, option]),
);
const poiKindGroups = [
  {
    label: "Main",
    values: ["poi", "other"],
  },
  {
    label: "Amenities",
    values: ["water", "swimming", "bench", "toilet", "cafe", "shade"],
  },
  {
    label: "Dogs",
    values: ["dog-playground", "off-leash-area"],
  },
  {
    label: "Practical",
    values: ["waste-bin", "rest-area", "viewpoint", "photo-spot"],
  },
  {
    label: "Warnings",
    values: ["hazard", "livestock"],
  },
] satisfies {
  label: string;
  values: Exclude<LocationCoordinateKind, "general">[];
}[];
const poiDropdownItems = computed(() =>
  poiKindGroups.map((group) => [
    {
      label: group.label,
      type: "label" as const,
    },
    ...group.values
      .map((value) => pointKindOptionMap.get(value))
      .filter((option): option is (typeof pointKindOptions)[number] =>
        Boolean(option),
      )
      .map((option) => ({
        label: option.label,
        onSelect() {
          startAddingCoordinatePoint(option.value);
        },
      })),
  ]),
);
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

function isCoordinateKind(value: unknown): value is LocationCoordinateKind {
  return (
    typeof value === "string" &&
    coordinateKindValues.has(value as LocationCoordinateKind)
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

const coordinatePointSchema = z
  .object({
    id: z.string().nullable().optional(),
    kind: z.custom<LocationCoordinateKind>(isCoordinateKind, {
      message: "Choose a point type.",
    }),
    label: z.string().trim().min(1, "Enter a point label."),
    latitude: z.number().finite("Set this point on the map."),
    longitude: z.number().finite("Set this point on the map."),
    sourcePhotoId: z.string().nullable().optional(),
  })
  .superRefine((value, context) => {
    if (value.kind === "general") {
      context.addIssue({
        code: "custom",
        path: ["kind"],
        message: "Choose a point type.",
      });
    }
  });

const locationSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a location name."),
    city: z.string().trim().nullable().optional(),
    province: z.string().nullable().optional(),
    country: z.string().trim().nullable().optional(),
    latitude: z.number().finite().nullable().optional(),
    longitude: z.number().finite().nullable().optional(),
    type: z
      .array(z.string())
      .min(1, "Choose at least one type.")
      .refine(
        (values) => values.every((value) => typeOptionValues.has(value)),
        {
          message: "Choose valid location types.",
        },
      ),
    characteristics: z
      .array(z.string())
      .refine(
        (values) =>
          values.every((value) => characteristicOptionValues.has(value)),
        { message: "Choose valid characteristics." },
      ),
    coordinatePoints: z.array(coordinatePointSchema).optional(),
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
    if (!value.city?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["city"],
        message: "Enter a city.",
      });
    }

    if (!value.country?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["country"],
        message: "Enter a country.",
      });
    }

    if (!Number.isFinite(value.latitude) || !Number.isFinite(value.longitude)) {
      context.addIssue({
        code: "custom",
        path: ["latitude"],
        message: "Set the general location on the map.",
      });
    }
  });

type FormMapMarker = {
  id: string;
  kind: LocationCoordinateKind;
  label: string;
  latitude?: number | null;
  longitude?: number | null;
};

const generalLocationMarker = computed<FormMapMarker>({
  get: () => ({
    id: "general",
    kind: "general" as const,
    label: "General location",
    latitude: form.value.latitude,
    longitude: form.value.longitude,
  }),
  set: (value) => {
    form.value.latitude = value.latitude;
    form.value.longitude = value.longitude;
  },
});

const mapMarkers = computed<FormMapMarker[]>(() => [
  generalLocationMarker.value,
  ...(form.value.coordinatePoints ?? []).map((point, index) => ({
    ...point,
    id: point.id ?? `point-${index}`,
  })),
]);
const directionsUrl = computed(() => {
  if (
    !Number.isFinite(form.value.latitude) ||
    !Number.isFinite(form.value.longitude)
  ) {
    return undefined;
  }

  return `https://www.google.com/maps/dir/?api=1&destination=${form.value.latitude},${form.value.longitude}`;
});

const activePoint = computed<LocationCoordinatePoint | null>(() => {
  if (!activePointId.value) return null;
  if (activePointId.value === "general") return null;

  return (
    form.value.coordinatePoints?.find(
      (point) => point.id === activePointId.value,
    ) ?? null
  );
});
const isPoiAddMode = computed(
  () =>
    Boolean(pendingPointKind.value) &&
    pendingPointKind.value !== "parking" &&
    pendingPointKind.value !== "entrance",
);

const activeLatitude = computed({
  get: () => {
    if (!activePointId.value) return null;

    return activePoint.value?.latitude ?? form.value.latitude;
  },
  set: (value: number | null) => {
    if (!activePointId.value) return;

    if (activePoint.value) {
      if (value !== null) activePoint.value.latitude = value;
      return;
    }

    form.value.latitude = value;
  },
});

const activeLongitude = computed({
  get: () => {
    if (!activePointId.value) return null;

    return activePoint.value?.longitude ?? form.value.longitude;
  },
  set: (value: number | null) => {
    if (!activePointId.value) return;

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

function createCoordinatePoint(
  kind: Exclude<LocationCoordinateKind, "general">,
  latitude: number,
  longitude: number,
) {
  const point: LocationCoordinatePoint = {
    id: createPointId(),
    kind,
    label: getPointLabel(kind),
    latitude,
    longitude,
  };

  form.value.coordinatePoints = [...(form.value.coordinatePoints ?? []), point];
  activePointId.value = null;
  pendingPointKind.value = null;
}

function startAddingCoordinatePoint(
  kind: Exclude<LocationCoordinateKind, "general">,
) {
  isMapEditorOpen.value = true;
  pendingPointKind.value = kind;
  activePointId.value = null;
}

function handleMapPick(coordinates: { latitude: number; longitude: number }) {
  if (!pendingPointKind.value) {
    if (activePointId.value && activePointId.value !== "general") {
      activePointId.value = null;
    }
    return;
  }

  createCoordinatePoint(
    pendingPointKind.value,
    coordinates.latitude,
    coordinates.longitude,
  );
}

function moveMapMarker(marker: { id: string; kind: LocationCoordinateKind }) {
  pendingPointKind.value = null;
  activePointId.value = marker.kind === "general" ? "general" : marker.id;
}

function openMapEditor() {
  isMapEditorOpen.value = true;
}

function removeCoordinatePoint(id: string | null | undefined) {
  form.value.coordinatePoints = (form.value.coordinatePoints ?? []).filter(
    (point) => point.id !== id,
  );

  if (activePointId.value === id) {
    activePointId.value = props.mapEditingLocked ? null : "general";
  }
}

function removeMapMarker(marker: { id: string; kind: LocationCoordinateKind }) {
  if (marker.kind === "general") return;

  removeCoordinatePoint(marker.id);
}

function findCoordinatePoint(id: string) {
  return form.value.coordinatePoints?.find((point) => point.id === id) ?? null;
}

function renameMapMarker(marker: { id: string; kind: LocationCoordinateKind }) {
  if (marker.kind === "general") return;

  const point = findCoordinatePoint(marker.id);
  if (!point) return;

  renamingPointId.value = marker.id;
  renamingPointLabel.value = point.label;
}

function saveRenamedMapMarker() {
  if (!renamingPointId.value) return;

  const point = findCoordinatePoint(renamingPointId.value);
  const nextLabel = renamingPointLabel.value.trim();

  if (point && nextLabel) {
    point.label = nextLabel;
  }

  renamingPointId.value = null;
  renamingPointLabel.value = "";
}

function changeMapMarkerKind(marker: {
  id: string;
  kind: LocationCoordinateKind;
  nextKind: Exclude<LocationCoordinateKind, "general">;
}) {
  if (marker.kind === "general") return;

  const point = findCoordinatePoint(marker.id);
  if (!point) return;

  updatePointKind(point, marker.nextKind);
}

function setMapMarkerAsGeneral(marker: {
  id: string;
  kind: LocationCoordinateKind;
}) {
  if (marker.kind === "general") return;

  const point = findCoordinatePoint(marker.id);
  if (!point) return;

  form.value.latitude = point.latitude;
  form.value.longitude = point.longitude;
  removeCoordinatePoint(marker.id);
  pendingPointKind.value = null;
  activePointId.value = "general";
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
  isMapEditorOpen.value = false;
  activePointId.value = props.mapEditingLocked ? null : "general";
  pendingPointKind.value = null;
  renamingPointId.value = null;
  renamingPointLabel.value = "";
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

    locationForm.value?.clear("latitude");

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
    :class="[
      'flex h-full min-h-0 flex-col gap-5',
      contained && 'rounded-md border border-slate-200 bg-white p-5 shadow-sm',
    ]"
    @submit="submitForm"
  >
    <AppTabs :items="formTabs">
      <template #details>
        <div class="grid gap-4 pt-4">
          <UFormField label="Name" name="name" required>
            <UInput
              v-model="form.name"
              :readonly="readonly"
              required
              :ui="
                readonly
                  ? {
                      base: 'px-0 ring-0 bg-transparent focus-visible:ring-0',
                    }
                  : undefined
              "
              :variant="readonly ? 'none' : 'outline'"
            />
          </UFormField>

          <UFormField
            label="Description"
            description="Write about access, leash rules, terrain, facilities, and useful tips for dog owners."
            name="description"
          >
            <UEditor
              v-model="form.description"
              :editable="!readonly"
              :class="[
                'min-h-32 w-full min-w-0 overflow-hidden',
                readonly
                  ? 'bg-transparent'
                  : 'rounded-md border border-slate-200 bg-white',
              ]"
              content-type="markdown"
              placeholder="Describe this location..."
              :ui="{
                content: 'min-h-32',
                base: [
                  'min-h-32 py-2 text-base leading-5 font-sans text-slate-950 *:my-0 [&_p]:leading-5 [&_p]:my-0 [&_:is(h1,h2,h3,h4,h5,h6)]:font-title',
                  readonly ? 'px-0 sm:px-0' : 'px-4 sm:px-4',
                ],
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

          <div
            v-if="!showFeatures && !readonly"
            class="grid gap-5 sm:grid-cols-2"
          >
            <UFormField label="Type" name="type">
              <USelect
                v-model="form.type"
                class="w-full"
                :items="typeItems"
                multiple
                name="type"
                placeholder="Select types"
                value-key="value"
              />
            </UFormField>

            <UFormField label="Characteristics" name="characteristics">
              <USelect
                v-model="form.characteristics"
                class="w-full"
                :items="characteristicItems"
                multiple
                name="characteristics"
                placeholder="Select characteristics"
                value-key="value"
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
            <UAlert
              v-if="geocodeError"
              :title="geocodeError"
              color="warning"
              icon="i-lucide-map-pinned"
              variant="soft"
            />
            <div
              v-if="!readonly"
              class="flex flex-wrap items-center justify-between gap-2"
            >
              <UButton
                color="neutral"
                icon="i-lucide-map"
                label="Edit map"
                type="button"
                variant="ghost"
                @click="openMapEditor"
              />
            </div>
            <AppLocationPointPicker
              :latitude="form.latitude"
              :longitude="form.longitude"
              :markers="mapMarkers"
              readonly
            />
            <p v-if="isReverseGeocoding" class="text-sm text-slate-500">
              Finding place details from the general location...
            </p>
          </div>
        </UFormField>

        <UModal
          v-if="!readonly"
          v-model:open="isMapEditorOpen"
          fullscreen
          title="Edit map points"
        >
          <template #body>
            <div
              class="flex h-[calc(100dvh-7rem)] max-h-[calc(100dvh-7rem)] min-h-0 flex-col overflow-hidden"
            >
              <div class="relative min-h-0 flex-1">
                <AppLocationPointPicker
                  v-model:latitude="activeLatitude"
                  v-model:longitude="activeLongitude"
                  full-height
                  :markers="mapMarkers"
                  :readonly="false"
                  @marker-change-kind="changeMapMarkerKind"
                  @marker-delete="removeMapMarker"
                  @marker-move="moveMapMarker"
                  @marker-rename="renameMapMarker"
                  @marker-set-general="setMapMarkerAsGeneral"
                  @picked="handleMapPick"
                >
                  <template #actions>
                    <div class="flex items-center gap-1.5">
                      <UButton
                        :class="mapPointActionButtonClass"
                        color="neutral"
                        icon="i-lucide-car"
                        label="+ Parking"
                        size="xs"
                        type="button"
                        :variant="
                          pendingPointKind === 'parking' ? 'solid' : 'subtle'
                        "
                        @click="startAddingCoordinatePoint('parking')"
                      />
                      <UButton
                        :class="mapPointActionButtonClass"
                        color="neutral"
                        icon="i-lucide-door-open"
                        label="+ Entrance"
                        size="xs"
                        type="button"
                        :variant="
                          pendingPointKind === 'entrance' ? 'solid' : 'subtle'
                        "
                        @click="startAddingCoordinatePoint('entrance')"
                      />
                      <UDropdownMenu
                        :content="{ align: 'start' }"
                        :items="poiDropdownItems"
                        size="sm"
                        :ui="{
                          content:
                            'max-h-[min(20rem,calc(100dvh-8rem))] overflow-y-auto',
                        }"
                        @update:open="
                          $event &&
                          ((activePointId = null), (pendingPointKind = null))
                        "
                      >
                        <UButton
                          :class="mapPointActionButtonClass"
                          color="neutral"
                          icon="i-lucide-map-pinned"
                          label="+ POI"
                          size="xs"
                          trailing-icon="i-lucide-chevron-down"
                          type="button"
                          :variant="isPoiAddMode ? 'solid' : 'subtle'"
                        />
                      </UDropdownMenu>
                    </div>
                  </template>
                </AppLocationPointPicker>
              </div>
            </div>
          </template>
        </UModal>

        <UModal
          v-if="!readonly"
          :open="Boolean(renamingPointId)"
          title="Rename point"
          :ui="{ footer: 'justify-end' }"
          @update:open="
            !$event && ((renamingPointId = null), (renamingPointLabel = ''))
          "
        >
          <template #body>
            <UFormField label="Point name">
              <UInput
                v-model="renamingPointLabel"
                autofocus
                class="w-full"
                placeholder="Point name"
                @keydown.enter.prevent="saveRenamedMapMarker"
              />
            </UFormField>
          </template>

          <template #footer>
            <div class="flex w-full items-center justify-end gap-2">
              <UButton
                color="neutral"
                label="Cancel"
                type="button"
                variant="subtle"
                @click="((renamingPointId = null), (renamingPointLabel = ''))"
              />
              <UButton
                icon="i-lucide-check"
                label="Save"
                type="button"
                @click="saveRenamedMapMarker"
              />
            </div>
          </template>
        </UModal>
      </template>

      <template #photos>
        <div v-if="readonly" class="flex h-full min-h-0 flex-col pt-4">
          <AppPhotoLanes
            v-if="form.photos?.length"
            class="min-h-0 flex-1"
            :location-name="form.name"
            :photos="form.photos"
          />
          <AppEmptyState
            v-else
            description="No photos have been added for this location."
            icon="i-lucide-images"
            title="No photos"
          />
        </div>

        <UFormField
          v-else
          class="pt-4"
          description="Photos with location data can automatically create a POI on the map."
          label="Photos"
          name="photos"
        >
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
          <UButton
            class="self-start"
            color="primary"
            :disabled="!directionsUrl"
            icon="i-lucide-navigation"
            label="Directions"
            target="_blank"
            :to="directionsUrl"
            variant="soft"
          />

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
            v-if="readonly && !directionsUrl && !form.relatedUrls?.length"
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
