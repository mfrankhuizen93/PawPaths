<script lang="ts" setup>
import type {
  GeoJSONSource,
  Map,
  MapLayerMouseEvent,
  MapLayerTouchEvent,
  MapMouseEvent,
} from "maplibre-gl";
import type { GeocodeResult } from "#shared/types/geo";
import type { LocationCoordinateKind } from "#shared/types/locations";

type PickerMarker = {
  id: string;
  label: string;
  kind: LocationCoordinateKind;
  latitude?: number | null;
  longitude?: number | null;
};

const props = defineProps<{
  latitude?: number | null;
  longitude?: number | null;
  markers?: PickerMarker[];
  fullHeight?: boolean;
  readonly?: boolean;
}>();

const emit = defineEmits<{
  "update:latitude": [value: number | null];
  "update:longitude": [value: number | null];
  "marker-delete": [value: { id: string; kind: LocationCoordinateKind }];
  "marker-move": [value: { id: string; kind: LocationCoordinateKind }];
  picked: [value: { latitude: number; longitude: number }];
  selected: [value: GeocodeResult];
}>();

const config = useRuntimeConfig();
const mapContainer = ref<HTMLElement | null>(null);
const map = shallowRef<Map | null>(null);
const isReady = ref(false);
const markerMenu = ref<{
  id: string;
  kind: LocationCoordinateKind;
  label: string;
  x: number;
  y: number;
} | null>(null);
let markerLongPressTimer: ReturnType<typeof window.setTimeout> | null = null;
let suppressNextMapClick = false;
const mapStyle =
  config.public.mapStyleUrl || "https://demotiles.maplibre.org/style.json";
const selectionLayerIds = [
  "pawpaths-location-selection",
  "pawpaths-location-selection-halo",
] as const;

const selectedCoordinates = computed<[number, number] | null>(() => {
  if (!Number.isFinite(props.latitude) || !Number.isFinite(props.longitude)) {
    return null;
  }

  return [props.longitude as number, props.latitude as number];
});

const markerKey = computed(() =>
  JSON.stringify(
    (props.markers ?? []).map((marker) => [
      marker.id,
      marker.label,
      marker.kind,
      marker.latitude,
      marker.longitude,
    ]),
  ),
);

function getSelectionFeatureCollection(): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const markers = (props.markers ?? []).filter(
    (marker) =>
      Number.isFinite(marker.latitude) && Number.isFinite(marker.longitude),
  );

  return {
    type: "FeatureCollection",
    features: markers.map((marker) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [marker.longitude as number, marker.latitude as number],
      },
      properties: {
        id: marker.id,
        label: marker.label,
        kind: marker.kind,
      },
    })),
  };
}

function getSelectionSource() {
  return map.value?.getSource("pawpaths-location-selection") as
    | GeoJSONSource
    | undefined;
}

function syncSelection() {
  getSelectionSource()?.setData(getSelectionFeatureCollection());
}

function fitMarkersToView() {
  const activeMap = map.value;
  const coordinates = (props.markers ?? [])
    .filter(
      (marker) =>
        Number.isFinite(marker.latitude) && Number.isFinite(marker.longitude),
    )
    .map(
      (marker) =>
        [marker.longitude as number, marker.latitude as number] as [
          number,
          number,
        ],
    );

  if (!activeMap || coordinates.length === 0) return;

  if (coordinates.length === 1) {
    activeMap.easeTo({
      center: coordinates[0],
      zoom: Math.max(activeMap.getZoom(), 14),
      duration: 450,
    });
    return;
  }

  const lngValues = coordinates.map(([longitude]) => longitude);
  const latValues = coordinates.map(([, latitude]) => latitude);

  activeMap.fitBounds(
    [
      [Math.min(...lngValues), Math.min(...latValues)],
      [Math.max(...lngValues), Math.max(...latValues)],
    ],
    {
      padding: 64,
      maxZoom: 15,
      duration: 450,
    },
  );
}

function setCoordinates(coordinates: [number, number]) {
  const longitude = Number(coordinates[0].toFixed(6));
  const latitude = Number(coordinates[1].toFixed(6));

  emit("update:longitude", longitude);
  emit("update:latitude", latitude);
  emit("picked", { latitude, longitude });
}

function searchAddress(result: GeocodeResult) {
  const coordinates: [number, number] = [result.longitude, result.latitude];

  setCoordinates(coordinates);
  emit("selected", result);
  map.value?.easeTo({
    center: coordinates,
    zoom: Math.max(map.value.getZoom(), 14),
    duration: 450,
  });
}

function addSelectionLayer() {
  if (!map.value || map.value.getSource("pawpaths-location-selection")) return;

  map.value.addSource("pawpaths-location-selection", {
    type: "geojson",
    data: getSelectionFeatureCollection(),
  });

  map.value.addLayer({
    id: "pawpaths-location-selection-halo",
    type: "circle",
    source: "pawpaths-location-selection",
    paint: {
      "circle-color": "#ffffff",
      "circle-radius": 18,
      "circle-opacity": 0.92,
    },
  });

  map.value.addLayer({
    id: "pawpaths-location-selection",
    type: "circle",
    source: "pawpaths-location-selection",
    paint: {
      "circle-color": [
        "match",
        ["get", "kind"],
        "general",
        "#4d7c5e",
        "parking",
        "#2563eb",
        "poi",
        "#c2410c",
        "entrance",
        "#7c3aed",
        "water",
        "#0891b2",
        "swimming",
        "#0284c7",
        "dog-playground",
        "#16a34a",
        "off-leash-area",
        "#65a30d",
        "bench",
        "#ca8a04",
        "toilet",
        "#0f766e",
        "cafe",
        "#a16207",
        "viewpoint",
        "#9333ea",
        "shade",
        "#15803d",
        "waste-bin",
        "#475569",
        "rest-area",
        "#0d9488",
        "hazard",
        "#dc2626",
        "livestock",
        "#854d0e",
        "photo-spot",
        "#db2777",
        "#475569",
      ],
      "circle-radius": 10,
      "circle-stroke-color": "#1f2937",
      "circle-stroke-opacity": 0.22,
      "circle-stroke-width": 1,
    },
  });

  map.value.addLayer({
    id: "pawpaths-location-selection-label",
    type: "symbol",
    source: "pawpaths-location-selection",
    layout: {
      "text-field": ["get", "label"],
      "text-offset": [0, 1.35],
      "text-size": 12,
      "text-font": ["Metropolis Medium"],
      "text-anchor": "top",
    },
    paint: {
      "text-color": "#1f2937",
      "text-halo-color": "#ffffff",
      "text-halo-width": 2,
    },
  });
}

function getMarkerFromFeature(feature: GeoJSON.Feature | undefined): {
  id: string;
  kind: LocationCoordinateKind;
  label: string;
} | null {
  const properties = feature?.properties;

  if (
    !properties ||
    typeof properties.id !== "string" ||
    typeof properties.label !== "string" ||
    typeof properties.kind !== "string"
  ) {
    return null;
  }

  return {
    id: properties.id,
    kind: properties.kind as LocationCoordinateKind,
    label: properties.label,
  };
}

function openMarkerMenu(event: MapLayerMouseEvent | MapLayerTouchEvent) {
  if (props.readonly) return;

  const marker = getMarkerFromFeature(event.features?.[0]);
  if (!marker) return;

  event.preventDefault();
  openMarkerMenuAt(marker, event.point.x, event.point.y);
}

function openMarkerMenuAt(
  marker: {
    id: string;
    kind: LocationCoordinateKind;
    label: string;
  },
  x: number,
  y: number,
) {
  suppressNextMapClick = true;
  markerMenu.value = { ...marker, x, y };
}

function closeMarkerMenu() {
  markerMenu.value = null;
}

function clearMarkerLongPressTimer() {
  if (!markerLongPressTimer) return;

  window.clearTimeout(markerLongPressTimer);
  markerLongPressTimer = null;
}

function startMarkerLongPress(event: MapLayerTouchEvent) {
  if (props.readonly) return;

  const marker = getMarkerFromFeature(event.features?.[0]);
  if (!marker) return;

  event.preventDefault();
  const { x, y } = event.point;

  clearMarkerLongPressTimer();
  markerLongPressTimer = window.setTimeout(() => {
    openMarkerMenuAt(marker, x, y);
  }, 520);
}

function moveMarker() {
  if (!markerMenu.value) return;

  emit("marker-move", {
    id: markerMenu.value.id,
    kind: markerMenu.value.kind,
  });
  closeMarkerMenu();
}

function deleteMarker() {
  if (!markerMenu.value || markerMenu.value.kind === "general") return;

  emit("marker-delete", {
    id: markerMenu.value.id,
    kind: markerMenu.value.kind,
  });
  closeMarkerMenu();
}

onMounted(async () => {
  if (!mapContainer.value) return;

  const maplibregl = await import("maplibre-gl");
  const initialCenter =
    selectedCoordinates.value ?? ([5.2913, 52.1326] as [number, number]);

  map.value = new maplibregl.Map({
    container: mapContainer.value,
    style: mapStyle,
    center: initialCenter,
    zoom: selectedCoordinates.value ? 14 : 6,
    attributionControl: false,
  });

  map.value.addControl(new maplibregl.NavigationControl(), "top-right");
  map.value.addControl(new maplibregl.AttributionControl({ compact: true }));

  map.value.on("load", () => {
    addSelectionLayer();
    isReady.value = true;
    if (props.readonly) {
      fitMarkersToView();
    }
  });

  selectionLayerIds.forEach((layerId) => {
    map.value?.on("contextmenu", layerId, openMarkerMenu);
    map.value?.on("touchstart", layerId, startMarkerLongPress);
  });
  map.value.on("touchend", clearMarkerLongPressTimer);

  map.value.on("click", (event: MapMouseEvent) => {
    if (suppressNextMapClick) {
      suppressNextMapClick = false;
      return;
    }

    closeMarkerMenu();
    if (props.readonly) return;

    setCoordinates([event.lngLat.lng, event.lngLat.lat]);
  });
});

watch(
  () => [selectedCoordinates.value?.join(","), markerKey.value],
  () => {
    syncSelection();

    const activeMap = map.value;
    const coordinates = selectedCoordinates.value;

    if (isReady.value && props.readonly) {
      fitMarkersToView();
      return;
    }

    if (isReady.value && coordinates && activeMap) {
      activeMap.easeTo({
        center: coordinates,
        zoom: Math.max(activeMap.getZoom(), 14),
        duration: 450,
      });
    }
  },
);

onBeforeUnmount(() => {
  clearMarkerLongPressTimer();
  map.value?.remove();
});
</script>

<template>
  <div
    class="relative overflow-hidden rounded-md border border-slate-200"
    :class="{ 'h-full min-h-0': fullHeight }"
    @pointerdown.stop
    @touchstart.stop
  >
    <div
      ref="mapContainer"
      :class="
        fullHeight
          ? 'h-full min-h-0'
          : readonly
            ? 'h-[min(20rem,42dvh)] min-h-64'
            : 'h-[min(22rem,44dvh)] min-h-64'
      "
      class="w-full"
    />
    <div
      v-if="!readonly || $slots.actions"
      class="absolute top-3 left-3 z-10 flex w-[min(calc(100%-1.5rem),24rem)] flex-col gap-2"
    >
      <div
        class="border-default/60 bg-default/92 rounded-xl border shadow-lg backdrop-blur-xl"
      >
        <AppAddressSearch
          placeholder="Search address or place"
          @selected="searchAddress"
        />
      </div>
      <slot name="actions" />
    </div>

    <div
      v-if="markerMenu && !readonly"
      class="bg-default/95 border-default/60 absolute z-20 min-w-36 overflow-hidden rounded-lg border shadow-xl backdrop-blur-xl"
      :style="{
        left: `${markerMenu.x}px`,
        top: `${markerMenu.y}px`,
      }"
      @click.stop
      @pointerdown.stop
      @touchstart.stop
    >
      <UButton
        block
        color="neutral"
        icon="i-lucide-move"
        label="Move"
        type="button"
        variant="ghost"
        @click="moveMarker"
      />
      <UButton
        v-if="markerMenu.kind !== 'general'"
        block
        color="error"
        icon="i-lucide-trash-2"
        label="Delete"
        type="button"
        variant="ghost"
        @click="deleteMarker"
      />
    </div>
  </div>
</template>
