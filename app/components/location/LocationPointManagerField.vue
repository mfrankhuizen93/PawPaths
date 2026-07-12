<script setup lang="ts">
import type { LocationCoordinatePoint } from "#shared/types/locations";
import {
  getLocationPointCustomLabel,
  getLocationPointDefaultLabel,
  getLocationPointDisplayLabel,
  getLocationPointTypeConfig,
  isLocationPointNameRequired,
  locationPointTypeOptions,
  type LocationPointType,
} from "#shared/utils/location-coordinate-points";

type Coordinates = {
  latitude: number;
  longitude: number;
};

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

const props = withDefaults(
  defineProps<{
    readonly?: boolean;
  }>(),
  {
    readonly: false,
  },
);

const points = defineModel<LocationCoordinatePoint[]>({ required: true });
const latitude = defineModel<number | null>("latitude", { default: null });
const longitude = defineModel<number | null>("longitude", { default: null });
const pointPicker = ref<{ pickMapCenter: () => void } | null>(null);
const selectedPointId = ref<string | null>("general");
const state = ref<ManagerState>({ name: "viewing" });
const form = reactive({
  name: "",
  type: "poi" as LocationPointType,
});

const selectedPoint = computed(
  () => points.value.find((point) => point.id === selectedPointId.value) ?? null,
);
const selectedPointMeta = computed(() =>
  selectedPoint.value ? getLocationPointTypeConfig(selectedPoint.value.kind) : null,
);
const activeCoordinates = computed<Coordinates | null>(() => {
  if (state.value.name === "adding") return state.value.coordinates;
  if (state.value.name === "moving") return state.value.draft;
  if (state.value.name === "moving-general") return state.value.draft;

  return null;
});
const hasGeneralCoordinates = computed(
  () => Number.isFinite(latitude.value) && Number.isFinite(longitude.value),
);
const generalPoint = computed<LocationCoordinatePoint>(() => ({
  id: "general",
  kind: "general",
  label: "Main location",
  latitude: hasGeneralCoordinates.value ? (latitude.value as number) : 0,
  longitude: hasGeneralCoordinates.value ? (longitude.value as number) : 0,
}));
const canSaveForm = computed(
  () =>
    (!isLocationPointNameRequired(form.type) || form.name.trim().length > 0) &&
    Boolean(form.type) &&
    (state.value.name === "editing" || Boolean(activeCoordinates.value)),
);
const isNameRequired = computed(() => isLocationPointNameRequired(form.type));
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
    if (state.value.draft) {
      return "Choose Done to save the main location.";
    }

    return hasGeneralCoordinates.value
      ? "Move the map to the main location, then choose Place here."
      : "Move the map to the main location, then choose Place here.";
  }

  return "";
});
const mapLatitude = computed({
  get: () => activeCoordinates.value?.latitude ?? latitude.value,
  set: (value: number | null) => {
    if (value === null) return;
    setActiveCoordinates({ latitude: value, longitude: mapLongitude.value });
  },
});
const mapLongitude = computed({
  get: () => activeCoordinates.value?.longitude ?? longitude.value,
  set: (value: number | null) => {
    if (value === null) return;
    setActiveCoordinates({ latitude: mapLatitude.value, longitude: value });
  },
});
const mapMarkers = computed(() => {
  const markers = [
    {
      id: "general",
      kind: "general" as const,
      label: "Main location",
      latitude:
        state.value.name === "moving-general" && state.value.draft
          ? state.value.draft.latitude
          : latitude.value,
      longitude:
        state.value.name === "moving-general" && state.value.draft
          ? state.value.draft.longitude
          : longitude.value,
    },
    ...points.value.map((point) => {
      if (state.value.name === "moving" && state.value.id === point.id) {
        return { ...point, ...state.value.draft };
      }

      return {
        ...point,
        label: getLocationPointDisplayLabel(point),
      };
    }),
  ];

  if (state.value.name === "adding" && state.value.coordinates) {
    markers.push({
      id: "temporary-point",
      kind: form.type,
      label: form.name.trim() || getLocationPointDefaultLabel(form.type),
      ...state.value.coordinates,
    });
  }

  return markers;
});

function createPointId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function roundCoordinates(coordinates: Coordinates): Coordinates {
  return {
    latitude: Number(coordinates.latitude.toFixed(6)),
    longitude: Number(coordinates.longitude.toFixed(6)),
  };
}

function resetForm() {
  form.name = "";
  form.type = "poi";
}

function startAdding() {
  if (props.readonly) return;

  state.value = { name: "adding", coordinates: null };
  selectedPointId.value = null;
  resetForm();
}

function startMovingGeneral() {
  if (props.readonly) return;

  const original = hasGeneralCoordinates.value
    ? {
        latitude: latitude.value as number,
        longitude: longitude.value as number,
      }
    : null;

  state.value = {
    name: "moving-general",
    original,
    draft: original ? { ...original } : null,
  };
  selectedPointId.value = "general";
}

function startEditing(point: LocationCoordinatePoint) {
  if (props.readonly) return;

  state.value = { name: "editing", id: point.id ?? "" };
  selectedPointId.value = point.id ?? null;
  form.name = getLocationPointCustomLabel(point);
  form.type = point.kind as LocationPointType;
}

function startMoving(point: LocationCoordinatePoint) {
  if (props.readonly) return;

  const original = { latitude: point.latitude, longitude: point.longitude };
  state.value = {
    name: "moving",
    id: point.id ?? "",
    original,
    draft: { ...original },
  };
  selectedPointId.value = point.id ?? null;
}

function cancelState() {
  state.value = { name: "viewing" };
  resetForm();
}

function setActiveCoordinates(coordinates: {
  latitude: number | null;
  longitude: number | null;
}) {
  if (
    !Number.isFinite(coordinates.latitude) ||
    !Number.isFinite(coordinates.longitude)
  ) {
    return;
  }

  const rounded = roundCoordinates({
    latitude: coordinates.latitude as number,
    longitude: coordinates.longitude as number,
  });

  if (state.value.name === "adding") {
    state.value = { ...state.value, coordinates: rounded };
  }
  if (state.value.name === "moving") {
    state.value = { ...state.value, draft: rounded };
  }
  if (state.value.name === "moving-general") {
    state.value = { ...state.value, draft: rounded };
  }
}

function handleMapPick(coordinates: Coordinates) {
  setActiveCoordinates(coordinates);
}

function placeAtMapCenter() {
  pointPicker.value?.pickMapCenter();
}

function saveForm() {
  if (!canSaveForm.value) return;

  if (state.value.name === "adding" && state.value.coordinates) {
    const point: LocationCoordinatePoint = {
      id: createPointId(),
      label: form.name.trim() || getLocationPointDefaultLabel(form.type),
      kind: form.type,
      ...state.value.coordinates,
    };
    points.value = [...points.value, point];
    selectedPointId.value = point.id ?? null;
    cancelState();
  }

  if (state.value.name === "editing") {
    points.value = points.value.map((point) =>
      point.id === state.value.id
        ? {
            ...point,
            label: form.name.trim() || getLocationPointDefaultLabel(form.type),
            kind: form.type,
          }
        : point,
    );
    cancelState();
  }
}

function finishMove() {
  if (state.value.name === "moving-general") {
    if (state.value.draft) {
      latitude.value = state.value.draft.latitude;
      longitude.value = state.value.draft.longitude;
    }
    cancelState();
    return;
  }

  if (state.value.name !== "moving") return;

  points.value = points.value.map((point) =>
    point.id === state.value.id ? { ...point, ...state.value.draft } : point,
  );
  cancelState();
}

function confirmDelete(point: LocationCoordinatePoint) {
  if (props.readonly) return;

  selectedPointId.value = point.id ?? null;
  state.value = { name: "confirming-delete", id: point.id ?? "" };
}

function deleteSelectedPoint() {
  if (state.value.name !== "confirming-delete") return;

  const nextPoints = points.value.filter((point) => point.id !== state.value.id);
  points.value = nextPoints;
  selectedPointId.value = nextPoints[0]?.id ?? null;
  cancelState();
}

function getPointMenuItems(point: LocationCoordinatePoint) {
  if (point.id === "general") {
    return [
      [
        {
          label: props.readonly ? "Select" : "Move marker",
          icon: props.readonly ? "i-lucide-crosshair" : "i-lucide-move",
          onSelect: () => {
            if (props.readonly) {
              selectedPointId.value = "general";
            } else {
              startMovingGeneral();
            }
          },
        },
      ],
    ];
  }

  if (props.readonly) {
    return [
      [
        {
          label: "Select",
          icon: "i-lucide-crosshair",
          onSelect: () => {
            selectedPointId.value = point.id ?? null;
          },
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
      label: hasGeneralCoordinates.value ? "Required" : "Not placed",
      icon: "i-lucide-crosshair",
      color: "#4d7c5e",
      textColor: "#ffffff",
    };
  }

  return getLocationPointTypeConfig(point.kind);
}

watch(
  () => points.value.map((point) => point.id).join(","),
  () => {
    if (
      selectedPointId.value === "general" ||
      (selectedPointId.value &&
        points.value.some((point) => point.id === selectedPointId.value))
    ) {
      return;
    }

    selectedPointId.value = "general";
  },
);
</script>

<template>
  <div class="grid gap-4">
    <div class="grid gap-2">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm font-semibold text-highlighted">Location points</p>
        <div v-if="!readonly" class="flex flex-wrap justify-end gap-2">
          <UButton
            v-if="!hasGeneralCoordinates"
            color="neutral"
            icon="i-lucide-crosshair"
            label="Set main"
            type="button"
            variant="subtle"
            @click="startMovingGeneral"
          />
          <UButton
            icon="i-lucide-plus"
            label="Add location"
            type="button"
            @click="startAdding"
          />
        </div>
      </div>

      <div class="relative">
        <AppLocationPointPicker
          ref="pointPicker"
          v-model:latitude="mapLatitude"
          v-model:longitude="mapLongitude"
          :markers="mapMarkers"
          :readonly="
            readonly ||
            (state.name !== 'adding' &&
              state.name !== 'moving' &&
              state.name !== 'moving-general')
          "
          @picked="handleMapPick"
        />
        <div
          v-if="mapInstruction"
          class="absolute right-3 bottom-3 left-3 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-default/70 bg-default/95 p-2 shadow-lg backdrop-blur"
        >
          <span class="text-sm font-medium">{{ mapInstruction }}</span>
          <UButton
            v-if="
              state.name === 'adding' ||
              state.name === 'moving' ||
              state.name === 'moving-general'
            "
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
            size="sm"
            type="button"
            @click="finishMove"
          />
        </div>
      </div>
    </div>

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
          <div class="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
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
            :disabled="!canSaveForm"
            icon="i-lucide-save"
            label="Save"
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
          icon="i-lucide-trash-2"
          label="Delete"
          @click="deleteSelectedPoint"
        />
      </div>
    </section>

    <div class="rounded-md border border-default">
      <ul class="divide-y divide-default">
        <li
          v-for="point in [generalPoint, ...points]"
          :key="point.id"
          class="flex min-h-16 items-center gap-2 px-3 py-2 transition"
          :class="point.id === selectedPointId ? 'bg-primary/10' : ''"
        >
          <button
            class="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md text-left hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            type="button"
            @click="selectedPointId = point.id ?? null"
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
  </div>
</template>
