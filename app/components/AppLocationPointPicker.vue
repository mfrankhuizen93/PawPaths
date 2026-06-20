<script lang="ts" setup>
import type { GeoJSONSource, Map, MapMouseEvent } from "maplibre-gl";
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
  "marker-change-kind": [
    value: {
      id: string;
      kind: LocationCoordinateKind;
      nextKind: Exclude<LocationCoordinateKind, "general">;
    },
  ];
  "marker-delete": [value: { id: string; kind: LocationCoordinateKind }];
  "marker-move": [value: { id: string; kind: LocationCoordinateKind }];
  "marker-rename": [value: { id: string; kind: LocationCoordinateKind }];
  "marker-set-general": [value: { id: string; kind: LocationCoordinateKind }];
  picked: [value: { latitude: number; longitude: number }];
  selected: [value: GeocodeResult];
}>();

const config = useRuntimeConfig();
const mapContainer = ref<HTMLElement | null>(null);
const map = shallowRef<Map | null>(null);
const isReady = ref(false);
const contextMarker = ref<{
  id: string;
  kind: LocationCoordinateKind;
  label: string;
} | null>(null);
let suppressNextMapClick = false;
const mapStyle =
  config.public.mapStyleUrl || "https://demotiles.maplibre.org/style.json";
const selectionLayerIds = [
  "pawpaths-location-selection",
  "pawpaths-location-selection-halo",
] as const;
const pointKindOptions = [
  { label: "Entrance", value: "entrance" },
  { label: "Parking", value: "parking" },
  { label: "POI", value: "poi" },
  { label: "Water", value: "water" },
  { label: "Swimming", value: "swimming" },
  { label: "Dog Playground", value: "dog-playground" },
  { label: "Off-Leash Area", value: "off-leash-area" },
  { label: "Bench", value: "bench" },
  { label: "Toilet", value: "toilet" },
  { label: "Cafe", value: "cafe" },
  { label: "Viewpoint", value: "viewpoint" },
  { label: "Shade", value: "shade" },
  { label: "Waste Bin", value: "waste-bin" },
  { label: "Rest Area", value: "rest-area" },
  { label: "Hazard", value: "hazard" },
  { label: "Livestock", value: "livestock" },
  { label: "Photo Spot", value: "photo-spot" },
  { label: "Other", value: "other" },
] satisfies {
  label: string;
  value: Exclude<LocationCoordinateKind, "general">;
}[];
const markerContextMenuItems = computed(() => {
  if (!contextMarker.value) return [];
  const marker = contextMarker.value;
  const isGeneralMarker = contextMarker.value.kind === "general";

  return [
    [
      {
        label: "Move",
        icon: "i-lucide-move",
        onSelect() {
          moveMarker(marker);
        },
      },
      ...(isGeneralMarker
        ? []
        : [
            {
              label: "Rename",
              icon: "i-lucide-pencil",
              onSelect() {
                renameMarker(marker);
              },
            },
            {
              label: "Change type",
              icon: "i-lucide-list-restart",
              children: pointKindOptions.map((option) => ({
                label: option.label,
                disabled: option.value === marker.kind,
                onSelect() {
                  changeMarkerKind(marker, option.value);
                },
              })),
            },
            {
              label: "Set as general location",
              icon: "i-lucide-crosshair",
              onSelect() {
                setMarkerAsGeneral(marker);
              },
            },
            {
              type: "separator" as const,
            },
            {
              label: "Delete",
              icon: "i-lucide-trash-2",
              color: "error" as const,
              onSelect() {
                deleteMarker(marker);
              },
            },
          ]),
    ],
  ];
});
const contextMenuDisabled = computed(
  () => props.readonly || !contextMarker.value,
);

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

function getMapPointFromEvent(event: MouseEvent | PointerEvent) {
  const container = mapContainer.value;
  if (!container) return null;

  const rect = container.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function getMarkerAtPoint(point: { x: number; y: number }) {
  const activeMap = map.value;
  if (!activeMap) return null;

  const features = activeMap.queryRenderedFeatures(point, {
    layers: [...selectionLayerIds],
  });

  return getMarkerFromFeature(features[0]);
}

function prepareMarkerContextMenu(event: MouseEvent | PointerEvent) {
  if (props.readonly) return;
  if (
    event instanceof PointerEvent &&
    event.pointerType === "mouse" &&
    event.button === 0
  ) {
    return;
  }
  if (
    event.target instanceof HTMLElement &&
    event.target.closest("[data-map-controls]")
  ) {
    return;
  }

  const point = getMapPointFromEvent(event);
  contextMarker.value = point ? getMarkerAtPoint(point) : null;

  if (contextMarker.value) {
    suppressNextMapClick = true;
    return;
  }

  if (event.type === "contextmenu") {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }
}

function moveMarker(marker: {
  id: string;
  kind: LocationCoordinateKind;
  label: string;
}) {
  emit("marker-move", {
    id: marker.id,
    kind: marker.kind,
  });
  contextMarker.value = null;
}

function renameMarker(marker: {
  id: string;
  kind: LocationCoordinateKind;
  label: string;
}) {
  if (marker.kind === "general") return;

  emit("marker-rename", {
    id: marker.id,
    kind: marker.kind,
  });
  contextMarker.value = null;
}

function changeMarkerKind(
  marker: {
    id: string;
    kind: LocationCoordinateKind;
    label: string;
  },
  nextKind: Exclude<LocationCoordinateKind, "general">,
) {
  if (marker.kind === "general") return;

  emit("marker-change-kind", {
    id: marker.id,
    kind: marker.kind,
    nextKind,
  });
  contextMarker.value = null;
}

function setMarkerAsGeneral(marker: {
  id: string;
  kind: LocationCoordinateKind;
  label: string;
}) {
  if (marker.kind === "general") return;

  emit("marker-set-general", {
    id: marker.id,
    kind: marker.kind,
  });
  contextMarker.value = null;
}

function deleteMarker(marker: {
  id: string;
  kind: LocationCoordinateKind;
  label: string;
}) {
  if (marker.kind === "general") return;

  emit("marker-delete", {
    id: marker.id,
    kind: marker.kind,
  });
  contextMarker.value = null;
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

  map.value.on("click", (event: MapMouseEvent) => {
    if (suppressNextMapClick) {
      suppressNextMapClick = false;
      return;
    }

    contextMarker.value = null;
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

onBeforeUnmount(() => map.value?.remove());
</script>

<template>
  <UContextMenu
    :disabled="contextMenuDisabled"
    :items="markerContextMenuItems"
    :modal="false"
    :press-open-delay="520"
    size="sm"
    @update:open="!$event && (contextMarker = null)"
  >
    <div
      class="relative overflow-hidden rounded-md border border-slate-200"
      :class="{ 'h-full min-h-0': fullHeight }"
      @contextmenu.capture="prepareMarkerContextMenu"
      @pointerdown.capture="prepareMarkerContextMenu"
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
        data-map-controls
        class="absolute top-3 left-3 z-10 flex w-[min(calc(100%-1.5rem),24rem)] flex-col gap-2"
      >
        <div
          class="border-default/60 bg-default/92 rounded-xl border shadow-lg backdrop-blur-xl"
        >
          <AppAddressSearch
            placeholder="Search address or place"
            size="sm"
            @selected="searchAddress"
          />
        </div>
        <slot name="actions" />
      </div>
    </div>
  </UContextMenu>
</template>
