<script setup lang="ts">
import type { Marker, Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import type {
  EditableLocationFields,
  LocationCoordinatePoint,
  LocationListItem,
} from "#shared/types/locations";
import {
  getLocationPointCustomLabel,
  getLocationPointDefaultLabel,
  getLocationPointDisplayLabel,
  getLocationPointTypeConfig,
  isLocationPointNameRequired,
  locationPointTypeOptions,
  type LocationPointType,
} from "#shared/utils/location-coordinate-points";
import AppDrawer from "~/components/drawer/AppDrawer.vue";
import AppDrawerHeader from "~/components/drawer/AppDrawerHeader.vue";

type ManagerState =
  | { name: "viewing" }
  | { name: "adding"; coordinates: Coordinates | null }
  | { name: "editing"; id: string }
  | { name: "moving"; id: string; original: Coordinates; draft: Coordinates }
  | {
      name: "moving-general";
      original: Coordinates | null;
      draft: Coordinates | null;
    }
  | { name: "confirming-delete"; id: string };

type Coordinates = {
  latitude: number;
  longitude: number;
};

const props = defineProps<{
  open: boolean;
  location: LocationListItem | null;
  signedIn?: boolean;
}>();

const emit = defineEmits<{
  "update:open": [open: boolean];
  saved: [points: LocationCoordinatePoint[], coordinates: Coordinates | null];
}>();

const config = useRuntimeConfig();
const toast = useToast();
const mapContainer = ref<HTMLElement | null>(null);
const listContainer = ref<HTMLElement | null>(null);
const listItemRefs = new Map<string, HTMLElement>();
const map = shallowRef<MapLibreMap | null>(null);
const markerInstances = new Map<string, Marker>();
const localPoints = ref<LocationCoordinatePoint[]>([]);
const localGeneralCoordinates = ref<Coordinates | null>(null);
const selectedPointId = ref<string | null>("general");
const state = ref<ManagerState>({ name: "viewing" });
const form = reactive({
  name: "",
  type: "poi" as LocationPointType,
});
const error = ref("");
const isSaving = ref(false);
const isLoadingMap = ref(true);
const closeConfirmOpen = ref(false);
const mapStyle =
  config.public.mapStyleUrl || "https://demotiles.maplibre.org/style.json";

const drawerOpen = computed({
  get: () => props.open,
  set: (open) => emit("update:open", open),
});
const selectedPoint = computed(
  () =>
    listPoints.value.find((point) => point.id === selectedPointId.value) ??
    null,
);
const selectedPointMeta = computed(() =>
  selectedPoint.value ? getPointMeta(selectedPoint.value) : null,
);
const activeCoordinates = computed<Coordinates | null>(() => {
  if (state.value.name === "adding") return state.value.coordinates;
  if (state.value.name === "moving") return state.value.draft;
  if (state.value.name === "moving-general") return state.value.draft;

  return null;
});
const canSaveForm = computed(
  () =>
    (!isLocationPointNameRequired(form.type) || form.name.trim().length > 0) &&
    Boolean(form.type) &&
    (state.value.name === "editing" || Boolean(activeCoordinates.value)),
);
const isNameRequired = computed(() => isLocationPointNameRequired(form.type));
const isDirty = computed(() => state.value.name !== "viewing");
const mapInstruction = computed(() => {
  if (state.value.name === "adding" && !state.value.coordinates) {
    return "Move the map to the spot, then choose Place here.";
  }
  if (state.value.name === "adding") {
    return "Adjust the map or marker, then save.";
  }
  if (state.value.name === "moving") {
    return "Move the map, choose Place here or drag the marker, then choose Done.";
  }
  if (state.value.name === "moving-general") {
    return state.value.draft
      ? "Choose Done to save the main location."
      : "Move the map to the main location, then choose Place here.";
  }

  return "";
});
const hasGeneralCoordinates = computed(() => Boolean(localGeneralCoordinates.value));
const generalPoint = computed<LocationCoordinatePoint>(() => ({
  id: "general",
  kind: "general",
  label: "Main location",
  latitude:
    state.value.name === "moving-general" && state.value.draft
      ? state.value.draft.latitude
      : localGeneralCoordinates.value?.latitude ?? 0,
  longitude:
    state.value.name === "moving-general" && state.value.draft
      ? state.value.draft.longitude
      : localGeneralCoordinates.value?.longitude ?? 0,
}));
const listPoints = computed(() => [
  ...(hasGeneralCoordinates.value ? [generalPoint.value] : []),
  ...localPoints.value,
]);

function createPointId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function roundCoordinates(coordinates: Coordinates): Coordinates {
  return {
    latitude: Number(coordinates.latitude.toFixed(6)),
    longitude: Number(coordinates.longitude.toFixed(6)),
  };
}

function clonePoints(points: LocationCoordinatePoint[] | undefined) {
  return (points ?? []).map((point) => ({ ...point, id: point.id ?? createPointId() }));
}

function resetForm() {
  form.name = "";
  form.type = "poi";
}

function resetLocalState() {
  localPoints.value = clonePoints(props.location?.coordinatePoints);
  localGeneralCoordinates.value =
    Number.isFinite(props.location?.latitude) &&
    Number.isFinite(props.location?.longitude)
      ? {
          latitude: props.location?.latitude as number,
          longitude: props.location?.longitude as number,
        }
      : null;
  selectedPointId.value = "general";
  state.value = { name: "viewing" };
  resetForm();
  error.value = "";
  nextTick(() => {
    syncMarkers();
    fitAllMarkers();
  });
}

function createEditablePayload(points: LocationCoordinatePoint[]): EditableLocationFields | null {
  const location = props.location;
  if (!location) return null;

  return {
    name: location.name,
    city: location.city ?? "",
    province: location.province ?? "",
    country: location.country ?? "Netherlands",
    latitude: localGeneralCoordinates.value?.latitude ?? location.latitude ?? null,
    longitude:
      localGeneralCoordinates.value?.longitude ?? location.longitude ?? null,
    type: [...(location.type ?? [])],
    characteristics: [...(location.characteristics ?? [])],
    description: location.description ?? "",
    relatedUrls: (location.relatedUrls ?? []).map((url) => ({ ...url })),
    photos: (location.photos ?? []).map((photo) => ({ ...photo })),
    coordinatePoints: points.map((point) => ({ ...point })),
  };
}

async function savePoints(points: LocationCoordinatePoint[], successTitle: string) {
  if (!props.location || isSaving.value) return false;

  const payload = createEditablePayload(points);
  if (!payload) return false;

  error.value = "";
  isSaving.value = true;

  try {
    await $fetch(`/api/locations/${props.location.slug}/changes`, {
      method: "POST",
      body: payload,
    });
    localPoints.value = clonePoints(points);
    emit("saved", localPoints.value, localGeneralCoordinates.value);
    state.value = { name: "viewing" };
    resetForm();
    toast.add({
      title: successTitle,
      description: "Your change will be reviewed before it appears publicly.",
      color: "success",
      icon: "i-lucide-circle-check",
    });
    return true;
  } catch (saveError) {
    error.value = getErrorMessage(saveError);
    return false;
  } finally {
    isSaving.value = false;
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

function selectPoint(id: string, shouldCenter = true) {
  selectedPointId.value = id;
  if (shouldCenter) centerPoint(id);
  scrollSelectedListItemIntoView();
  syncMarkers();
}

function setListItemRef(id: string, element: Element | null) {
  if (element instanceof HTMLElement) {
    listItemRefs.set(id, element);
  } else {
    listItemRefs.delete(id);
  }
}

function scrollSelectedListItemIntoView() {
  nextTick(() => {
    const id = selectedPointId.value;
    if (!id) return;

    listItemRefs.get(id)?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  });
}

function startAdding() {
  state.value = { name: "adding", coordinates: null };
  selectedPointId.value = null;
  resetForm();
  syncMarkers();
}

function startMovingGeneral() {
  const original = localGeneralCoordinates.value
    ? { ...localGeneralCoordinates.value }
    : null;

  state.value = {
    name: "moving-general",
    original,
    draft: original ? { ...original } : null,
  };
  selectedPointId.value = "general";
  syncMarkers();

  if (original) {
    centerPoint("general");
  }
}

function startEditing(point: LocationCoordinatePoint) {
  if (point.id === "general") return;

  state.value = { name: "editing", id: point.id ?? "" };
  selectedPointId.value = point.id ?? null;
  form.name = getLocationPointCustomLabel(point);
  form.type = point.kind as LocationPointType;
  syncMarkers();
}

function startMoving(point: LocationCoordinatePoint) {
  const original = {
    latitude: point.latitude,
    longitude: point.longitude,
  };
  state.value = {
    name: "moving",
    id: point.id ?? "",
    original,
    draft: { ...original },
  };
  selectedPointId.value = point.id ?? null;
  syncMarkers();
  centerPoint(point.id ?? "");
}

function cancelState() {
  state.value = { name: "viewing" };
  resetForm();
  syncMarkers();
}

function requestClose() {
  if (isDirty.value) {
    closeConfirmOpen.value = true;
    return;
  }

  drawerOpen.value = false;
}

function discardAndClose() {
  closeConfirmOpen.value = false;
  state.value = { name: "viewing" };
  resetForm();
  drawerOpen.value = false;
}

async function saveForm() {
  if (!canSaveForm.value) return;

  if (state.value.name === "adding" && state.value.coordinates) {
    const point: LocationCoordinatePoint = {
      id: createPointId(),
      label: form.name.trim() || getLocationPointDefaultLabel(form.type),
      kind: form.type,
      ...state.value.coordinates,
    };
    const nextPoints = [...localPoints.value, point];

    if (await savePoints(nextPoints, "Location point added")) {
      selectedPointId.value = point.id ?? null;
    }
    return;
  }

  if (state.value.name === "editing") {
    const nextPoints = localPoints.value.map((point) =>
      point.id === state.value.id
        ? {
            ...point,
            label: form.name.trim() || getLocationPointDefaultLabel(form.type),
            kind: form.type,
          }
        : point,
    );
    await savePoints(nextPoints, "Location point updated");
  }
}

async function finishMove() {
  if (state.value.name === "moving-general") {
    const original = state.value.original;
    if (state.value.draft) {
      localGeneralCoordinates.value = state.value.draft;
    }
    const saved = await savePoints(localPoints.value, "Main location moved");
    if (!saved) {
      localGeneralCoordinates.value = original;
      syncMarkers();
    }
    return;
  }

  if (state.value.name !== "moving") return;

  const nextPoints = localPoints.value.map((point) =>
    point.id === state.value.id ? { ...point, ...state.value.draft } : point,
  );
  await savePoints(nextPoints, "Location point moved");
}

function confirmDelete(point: LocationCoordinatePoint) {
  if (point.id === "general") return;

  state.value = { name: "confirming-delete", id: point.id ?? "" };
  selectedPointId.value = point.id ?? null;
  syncMarkers();
}

async function deleteSelectedPoint() {
  if (state.value.name !== "confirming-delete") return;

  const id = state.value.id;
  const nextPoints = localPoints.value.filter((point) => point.id !== id);

  if (await savePoints(nextPoints, "Location point deleted")) {
    selectedPointId.value = "general";
  }
}

function handleMapClick(event: MapMouseEvent) {
  const coordinates = roundCoordinates({
    latitude: event.lngLat.lat,
    longitude: event.lngLat.lng,
  });

  applyMapCoordinates(coordinates);
}

function applyMapCoordinates(coordinates: Coordinates) {
  if (state.value.name === "adding") {
    state.value = { ...state.value, coordinates };
    syncMarkers();
    return;
  }

  if (state.value.name === "moving") {
    state.value = { ...state.value, draft: coordinates };
    syncMarkers();
  }
  if (state.value.name === "moving-general") {
    state.value = { ...state.value, draft: coordinates };
    syncMarkers();
  }
}

function placeAtMapCenter() {
  const center = map.value?.getCenter();
  if (!center) return;

  applyMapCoordinates(
    roundCoordinates({
      latitude: center.lat,
      longitude: center.lng,
    }),
  );
}

function getMarkerCoordinates(point: LocationCoordinatePoint) {
  if (state.value.name === "moving" && state.value.id === point.id) {
    return state.value.draft;
  }
  if (point.id === "general") {
    return {
      latitude: generalPoint.value.latitude,
      longitude: generalPoint.value.longitude,
    };
  }

  return {
    latitude: point.latitude,
    longitude: point.longitude,
  };
}

function getVisiblePoints() {
  return [generalPoint.value, ...localPoints.value]
    .map((point) => ({
      ...point,
      ...getMarkerCoordinates(point),
    }))
    .filter((point) =>
      point.id === "general" ? hasGeneralCoordinates.value : true,
    );
}

function makeMarkerElement(point: LocationCoordinatePoint, temporary = false) {
  const meta = getLocationPointTypeConfig(point.kind);
  const element = document.createElement("button");
  const icon = document.createElement("span");
  const isSelected = point.id === selectedPointId.value;

  element.type = "button";
  element.className = [
    "pawpaths-point-marker",
    isSelected ? "is-selected" : "",
    temporary ? "is-temporary" : "",
  ].join(" ");
  element.style.setProperty("--point-color", meta.color);
  element.style.setProperty("--point-text-color", meta.textColor);
  element.setAttribute(
    "aria-label",
    `${getLocationPointDisplayLabel(point)}, ${meta.label}`,
  );

  icon.className = meta.icon;
  element.appendChild(icon);

  element.addEventListener("click", (event) => {
    event.stopPropagation();
    if (temporary) return;
    selectPoint(point.id ?? "", false);
  });

  return element;
}

async function syncMarkers() {
  const activeMap = map.value;
  if (!activeMap || !activeMap.getCanvas()) return;

  const maplibregl = await import("maplibre-gl");

  for (const marker of markerInstances.values()) marker.remove();
  markerInstances.clear();

  for (const point of getVisiblePoints()) {
    if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) continue;

    const id = point.id ?? createPointId();
    const markerElement = makeMarkerElement(point);
    const marker = new maplibregl.Marker({
      element: markerElement,
      draggable:
        (state.value.name === "moving" && state.value.id === id) ||
        (state.value.name === "moving-general" && id === "general"),
    })
      .setLngLat([point.longitude, point.latitude])
      .addTo(activeMap);

    marker.on("dragend", () => {
      const lngLat = marker.getLngLat();
      if (state.value.name === "moving-general" && id === "general") {
        state.value = {
          ...state.value,
          draft: roundCoordinates({
            latitude: lngLat.lat,
            longitude: lngLat.lng,
          }),
        };
        syncMarkers();
        return;
      }

      if (state.value.name !== "moving" || state.value.id !== id) return;

      state.value = {
        ...state.value,
        draft: roundCoordinates({
          latitude: lngLat.lat,
          longitude: lngLat.lng,
        }),
      };
      syncMarkers();
    });
    markerInstances.set(id, marker);
  }

  if (activeCoordinates.value) {
    const id = "temporary-point";
    const temporaryPoint: LocationCoordinatePoint = {
      id,
      kind: form.type,
      label: form.name.trim() || getLocationPointDefaultLabel(form.type),
      ...activeCoordinates.value,
    };
    const element = makeMarkerElement(temporaryPoint, true);

    markerInstances.set(
      id,
      new maplibregl.Marker({ element })
        .setLngLat([
          activeCoordinates.value.longitude,
          activeCoordinates.value.latitude,
        ])
        .addTo(activeMap),
    );
  }
}

function centerPoint(id: string) {
  const point =
    id === "general"
      ? hasGeneralCoordinates.value
        ? generalPoint.value
        : null
      : localPoints.value.find((item) => item.id === id);
  if (!point || !map.value) return;

  const coordinates = getMarkerCoordinates(point);
  map.value.easeTo({
    center: [coordinates.longitude, coordinates.latitude],
    zoom: Math.max(map.value.getZoom(), 16),
    duration: 450,
  });
}

function fitAllMarkers() {
  const activeMap = map.value;
  const points = getVisiblePoints();

  if (!activeMap || points.length === 0) {
    if (props.location?.latitude && props.location.longitude) {
      activeMap?.easeTo({
        center: [props.location.longitude, props.location.latitude],
        zoom: 13,
        duration: 300,
      });
    }
    return;
  }

  if (points.length === 1) {
    activeMap.easeTo({
      center: [points[0].longitude, points[0].latitude],
      zoom: 16,
      duration: 350,
    });
    return;
  }

  const lngValues = points.map((point) => point.longitude);
  const latValues = points.map((point) => point.latitude);

  activeMap.fitBounds(
    [
      [Math.min(...lngValues), Math.min(...latValues)],
      [Math.max(...lngValues), Math.max(...latValues)],
    ],
    { padding: 64, maxZoom: 16, duration: 350 },
  );
}

function getPointMenuItems(point: LocationCoordinatePoint) {
  if (point.id === "general") {
    return [
      [
        {
          label: "Center on map",
          icon: "i-lucide-crosshair",
          onSelect: () => selectPoint("general"),
        },
        {
          label: "Move marker",
          icon: "i-lucide-move",
          onSelect: () => startMovingGeneral(),
        },
      ],
    ];
  }

  return [
    [
      {
        label: "Edit",
        icon: "i-lucide-pencil",
        onSelect: () => startEditing(point),
      },
      {
        label: "Center on map",
        icon: "i-lucide-crosshair",
        onSelect: () => selectPoint(point.id ?? ""),
      },
      {
        label: "Move marker",
        icon: "i-lucide-move",
        onSelect: () => startMoving(point),
      },
      {
        label: "Delete",
        icon: "i-lucide-trash-2",
        color: "error" as const,
        onSelect: () => confirmDelete(point),
      },
    ],
  ];
}

function getPointMeta(point: LocationCoordinatePoint) {
  if (point.id === "general") {
    return {
      label: hasGeneralCoordinates.value ? "Main location" : "Not placed",
      icon: "i-lucide-crosshair",
      color: "#4d7c5e",
      textColor: "#ffffff",
    };
  }

  return getLocationPointTypeConfig(point.kind);
}

async function initializeMap() {
  if (map.value || !mapContainer.value) return;

  if (!mapContainer.value) return;

  const maplibregl = await import("maplibre-gl");
  const center: [number, number] =
    props.location?.latitude && props.location.longitude
      ? [props.location.longitude, props.location.latitude]
      : [5.2913, 52.1326];

  map.value = new maplibregl.Map({
    container: mapContainer.value,
    style: mapStyle,
    center,
    zoom: props.location?.latitude ? 13 : 6,
    attributionControl: false,
  });

  map.value.addControl(new maplibregl.NavigationControl(), "top-right");
  map.value.addControl(new maplibregl.AttributionControl({ compact: true }));
  map.value.on("load", () => {
    isLoadingMap.value = false;
    syncMarkers();
    fitAllMarkers();
  });
  map.value.on("click", handleMapClick);
}

onMounted(() => {
  void initializeMap();
});

watch(
  () => props.location?.id,
  () => resetLocalState(),
  { immediate: true },
);

watch(
  () => props.open,
  (open) => {
    if (!open) return;

    resetLocalState();
    nextTick(() => {
      void initializeMap().then(() => {
        map.value?.resize();
        fitAllMarkers();
      });
    });
  },
);

watch(
  () => [selectedPointId.value, state.value.name, form.type, activeCoordinates.value],
  () => {
    syncMarkers();
  },
  { deep: true },
);

onBeforeUnmount(() => {
  for (const marker of markerInstances.values()) marker.remove();
  markerInstances.clear();
  map.value?.remove();
});
</script>

<template>
  <AppDrawer
    v-model:open="drawerOpen"
    :dirty="isDirty"
    full-height
    title="Manage location points"
  >
    <template #header>
      <AppDrawerHeader
        description="Add useful named points for entrances, parking, water and other places."
        title="Manage location points"
      >
        <template #actions>
          <UButton
            aria-label="Close location point manager"
            color="neutral"
            icon="i-lucide-x"
            square
            variant="ghost"
            @click="requestClose"
          />
        </template>
      </AppDrawerHeader>
    </template>

    <div class="grid gap-4 pb-4">
      <UAlert
        v-if="!signedIn"
        color="warning"
        icon="i-lucide-lock"
        title="Sign in to save location points."
        variant="soft"
      />
      <UAlert
        v-if="error"
        color="error"
        icon="i-lucide-circle-alert"
        :title="error"
        variant="soft"
      />

      <section class="grid gap-3">
        <div
          class="border-default relative h-[min(42dvh,22rem)] min-h-64 overflow-hidden rounded-md border"
        >
          <div
            ref="mapContainer"
            class="size-full"
          />
          <USkeleton v-if="isLoadingMap" class="absolute inset-0 rounded-none" />
          <div
            v-if="mapInstruction"
            class="absolute right-3 bottom-3 left-3 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-default/70 bg-default/95 p-2 shadow-lg backdrop-blur sm:right-auto sm:bottom-auto sm:max-w-[calc(100%-1.5rem)]"
          >
            <span class="text-sm font-medium">{{ mapInstruction }}</span>
            <UButton
              color="neutral"
              icon="i-lucide-crosshair"
              label="Place here"
              size="sm"
              type="button"
              variant="soft"
              @click="placeAtMapCenter"
            />
            <UButton
              color="neutral"
              label="Cancel"
              size="sm"
              type="button"
              variant="subtle"
              @click="cancelState"
            />
            <UButton
              v-if="state.name === 'moving' || state.name === 'moving-general'"
              icon="i-lucide-check"
              label="Done"
              :disabled="!activeCoordinates"
              :loading="isSaving"
              size="sm"
              type="button"
              @click="finishMove"
            />
          </div>
        </div>

        <div
          v-if="selectedPoint && state.name === 'viewing'"
          class="rounded-md border border-default bg-default p-3"
        >
          <div class="flex items-start gap-3">
            <span
              v-if="selectedPointMeta"
              class="grid size-11 shrink-0 place-items-center rounded-full"
              :style="{
                backgroundColor: selectedPointMeta.color,
                color: selectedPointMeta.textColor,
              }"
            >
              <span :class="selectedPointMeta.icon" class="text-xl" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="font-semibold">
                {{ getLocationPointDisplayLabel(selectedPoint) }}
              </p>
              <p class="text-muted text-sm">{{ selectedPointMeta?.label }}</p>
            </div>
          </div>
          <div class="mt-3 flex gap-2 overflow-x-auto pb-1">
            <UButton
              v-if="selectedPoint.id !== 'general'"
              color="neutral"
              icon="i-lucide-pencil"
              label="Edit"
              variant="soft"
              @click="startEditing(selectedPoint)"
            />
            <UButton
              color="neutral"
              icon="i-lucide-move"
              label="Move marker"
              variant="soft"
              @click="
                selectedPoint.id === 'general'
                  ? startMovingGeneral()
                  : startMoving(selectedPoint)
              "
            />
            <UButton
              v-if="selectedPoint.id !== 'general'"
              color="error"
              icon="i-lucide-trash-2"
              label="Delete"
              variant="soft"
              @click="confirmDelete(selectedPoint)"
            />
          </div>
        </div>
      </section>

      <section
        v-if="state.name === 'adding' || state.name === 'editing'"
        class="rounded-md border border-default bg-default p-3"
      >
        <form class="flex flex-col gap-4" @submit.prevent="saveForm">
          <UFormField
            :label="isNameRequired ? 'Name' : 'Custom name'"
            :required="isNameRequired"
          >
            <UInput
              v-model="form.name"
              autofocus
              class="w-full"
              :placeholder="
                isNameRequired
                  ? 'Photo spot near the bridge'
                  : `Optional, otherwise ${getLocationPointDefaultLabel(form.type)}`
              "
              :required="isNameRequired"
            />
          </UFormField>

          <UFormField label="Location type" required>
            <div class="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2 sm:grid-cols-3">
              <button
                v-for="typeOption in locationPointTypeOptions"
                :key="typeOption.value"
                class="flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-left text-sm font-medium transition"
                :class="
                  form.type === typeOption.value
                    ? 'border-primary bg-primary/10 text-highlighted'
                    : 'border-default bg-default hover:bg-elevated'
                "
                type="button"
                @click="form.type = typeOption.value"
              >
                <span
                  class="grid size-8 shrink-0 place-items-center rounded-full"
                  :style="{
                    backgroundColor: typeOption.color,
                    color: typeOption.textColor,
                  }"
                >
                  <span :class="typeOption.icon" />
                </span>
                <span class="min-w-0 flex-1">{{ typeOption.label }}</span>
                <UIcon
                  v-if="form.type === typeOption.value"
                  name="i-lucide-check"
                  class="size-4 shrink-0"
                />
              </button>
            </div>
          </UFormField>

          <div class="flex flex-wrap justify-end gap-2">
            <UButton
              color="neutral"
              label="Cancel"
              type="button"
              variant="subtle"
              @click="cancelState"
            />
            <UButton
              :disabled="!canSaveForm || !signedIn"
              icon="i-lucide-save"
              label="Save"
              :loading="isSaving"
              type="submit"
            />
          </div>
        </form>
      </section>

      <section
        v-if="state.name === 'confirming-delete'"
        class="rounded-md border border-error/30 bg-error/5 p-3"
      >
        <p class="font-semibold text-highlighted">Delete this location?</p>
        <p class="text-muted mt-1 text-sm">This cannot be undone.</p>
        <div class="mt-3 flex flex-wrap justify-end gap-2">
          <UButton
            color="neutral"
            label="Cancel"
            variant="subtle"
            @click="cancelState"
          />
          <UButton
            color="error"
            :disabled="!signedIn"
            icon="i-lucide-trash-2"
            label="Delete"
            :loading="isSaving"
            @click="deleteSelectedPoint"
          />
        </div>
      </section>

      <section class="grid gap-3">
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-base font-semibold text-highlighted">Locations</h3>
          <UButton
            icon="i-lucide-plus"
            label="Add location"
            size="lg"
            type="button"
            @click="startAdding"
          />
        </div>

        <div
          ref="listContainer"
          class="max-h-[18rem] min-h-44 overflow-y-auto rounded-md border border-default"
        >
          <div
            v-if="listPoints.length === 0"
            class="flex min-h-48 flex-col items-center justify-center gap-3 p-5 text-center"
          >
            <UIcon name="i-lucide-map-pinned" class="text-muted size-8" />
            <div>
              <p class="font-semibold text-highlighted">No locations yet</p>
              <p class="text-muted mt-1 text-sm">
                Add useful places such as dog parks, water points or parking
                spots.
              </p>
            </div>
            <UButton
              icon="i-lucide-plus"
              label="Add location"
              type="button"
              @click="startAdding"
            />
          </div>

          <ul v-else class="divide-y divide-default">
            <li
              v-for="point in listPoints"
              :key="point.id"
              :ref="(el) => setListItemRef(point.id ?? '', el)"
              class="flex min-h-16 items-center gap-2 px-3 py-2 transition"
              :class="point.id === selectedPointId ? 'bg-primary/10' : ''"
            >
              <button
                class="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md text-left hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                type="button"
                @click="selectPoint(point.id ?? '')"
              >
                <span
                  class="grid size-11 shrink-0 place-items-center rounded-full"
                  :style="{
                    backgroundColor: getPointMeta(point).color,
                    color: getPointMeta(point).textColor,
                  }"
                >
                  <span
                    :class="getPointMeta(point).icon"
                    class="text-xl"
                  />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate font-medium text-highlighted">
                    {{ getLocationPointDisplayLabel(point) }}
                  </span>
                  <span class="text-muted block text-sm">
                    {{ getPointMeta(point).label }}
                  </span>
                </span>
                <UIcon
                  v-if="point.id === selectedPointId"
                  name="i-lucide-check-circle-2"
                  class="text-primary size-5 shrink-0"
                />
              </button>
              <UDropdownMenu :items="getPointMenuItems(point)">
                <UButton
                  aria-label="Location point actions"
                  color="neutral"
                  icon="i-lucide-ellipsis-vertical"
                  square
                  variant="ghost"
                />
              </UDropdownMenu>
            </li>
          </ul>
        </div>
      </section>
    </div>
  </AppDrawer>

  <UModal
    v-model:open="closeConfirmOpen"
    :close="false"
    description="Your location point changes have not been saved."
    title="Discard unsaved changes?"
  >
    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton
          color="neutral"
          label="Keep editing"
          variant="subtle"
          @click="closeConfirmOpen = false"
        />
        <UButton color="error" label="Discard changes" @click="discardAndClose" />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
:deep(.pawpaths-point-marker) {
  align-items: center;
  background: var(--point-color);
  border: 2px solid rgb(255 255 255 / 0.96);
  border-radius: 9999px;
  box-shadow: 0 10px 22px rgb(15 23 42 / 0.24);
  color: var(--point-text-color);
  cursor: pointer;
  display: grid;
  height: 44px;
  justify-content: center;
  place-items: center;
  position: relative;
  width: 44px;
  z-index: 30;
}

:deep(.pawpaths-point-marker.is-selected) {
  box-shadow:
    0 0 0 4px rgb(132 204 22 / 0.32),
    0 12px 28px rgb(15 23 42 / 0.3);
  transform: scale(1.08);
}

:deep(.pawpaths-point-marker.is-temporary) {
  border-style: dashed;
  opacity: 0.86;
}
</style>
