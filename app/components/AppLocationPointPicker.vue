<script lang="ts" setup>
import type { GeoJSONSource, Map, MapMouseEvent } from "maplibre-gl";
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
}>();

const emit = defineEmits<{
  "update:latitude": [value: number | null];
  "update:longitude": [value: number | null];
}>();

const config = useRuntimeConfig();
const mapContainer = ref<HTMLElement | null>(null);
const map = shallowRef<Map | null>(null);
const isReady = ref(false);
const mapStyle =
  config.public.mapStyleUrl || "https://demotiles.maplibre.org/style.json";

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

function setCoordinates(coordinates: [number, number]) {
  emit("update:longitude", Number(coordinates[0].toFixed(6)));
  emit("update:latitude", Number(coordinates[1].toFixed(6)));
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
      "circle-radius": 14,
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
        "#475569",
      ],
      "circle-radius": 8,
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
  });

  map.value.on("click", (event: MapMouseEvent) => {
    setCoordinates([event.lngLat.lng, event.lngLat.lat]);
  });
});

watch(
  () => [selectedCoordinates.value?.join(","), markerKey.value],
  () => {
    syncSelection();

    const activeMap = map.value;
    const coordinates = selectedCoordinates.value;

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
  map.value?.remove();
});
</script>

<template>
  <div class="overflow-hidden rounded-md border border-slate-200">
    <div ref="mapContainer" class="h-80 min-h-80 w-full" />
  </div>
</template>
