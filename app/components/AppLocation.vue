<script lang="ts" setup>
import type {
  GeoJSONSource,
  Map,
  MapLayerMouseEvent,
  Popup,
} from "maplibre-gl";
import type {
  LocationFilters,
  LocationListItem,
  LocationsResponse,
} from "#shared/types/locations";
import { getLocationPath } from "#shared/utils/location-route";

type StoredMapViewport = {
  lng: number;
  lat: number;
  zoom: number;
  bearing: number;
  pitch: number;
};

const props = withDefaults(
  defineProps<{
    locations?: LocationListItem[];
    location?: LocationListItem | null;
    variant?: "search" | "single" | "static";
    limit?: number;
    filters?: LocationFilters;
    eyebrow?: string;
    title?: string;
  }>(),
  {
    locations: () => [],
    location: null,
    variant: "static",
    limit: 100,
    filters: () => ({}),
    eyebrow: "Map",
    title: "Explore locations",
  },
);
const mapViewportStorageKey = "pawpaths.searchMapViewport";

const emit = defineEmits<{
  locationsLoaded: [response: LocationsResponse];
}>();

const config = useRuntimeConfig();
const mapContainer = ref<HTMLElement | null>(null);
const map = shallowRef<Map | null>(null);
const popup = shallowRef<Popup | null>(null);
const isReady = ref(false);
const isSearching = ref(false);
const isLocating = ref(false);
const searchError = ref(false);
const hasSearched = ref(false);
const locationError = ref("");
const userLocation = ref<[number, number] | null>(null);
const fetchedLocations = ref<LocationListItem[]>([]);
let searchTimer: ReturnType<typeof window.setTimeout> | null = null;

const mapStyle =
  config.public.mapStyleUrl || "https://demotiles.maplibre.org/style.json";

const activeLocations = computed(() => {
  if (props.variant === "single") {
    return props.location ? [props.location] : [];
  }

  if (props.variant === "search" && hasSearched.value) {
    return fetchedLocations.value;
  }

  return props.locations;
});

const filterKey = computed(() => JSON.stringify(props.filters));

const mappedLocations = computed(() =>
  activeLocations.value.filter(
    (location) =>
      Number.isFinite(location.latitude) && Number.isFinite(location.longitude),
  ),
);

const locationCountLabel = computed(() => {
  const count = mappedLocations.value.length;
  return `${count} mapped ${count === 1 ? "location" : "locations"}`;
});

function getFeatureCollection(): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: mappedLocations.value.map((location) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [
          location.longitude as number,
          location.latitude as number,
        ],
      },
      properties: {
        id: location.id,
        name: location.name,
        locality: [location.city, location.country].filter(Boolean).join(", "),
        kind: location.type[0] ?? "location",
        characteristics: location.characteristics.join(" • "),
        reviewCount: location.reviewCount,
        ratingCount: location.ratingCount,
        averageRating: location.averageRating,
        detailPath: getLocationPath(location.name),
        photoUrl: location.photos?.[0]?.url ?? null,
        photoAlt: location.photos?.[0]?.alt ?? location.name,
      },
    })),
  };
}

function getLocationsSource() {
  return map.value?.getSource("pawpaths-locations") as
    | GeoJSONSource
    | undefined;
}

function getUserLocationSource() {
  return map.value?.getSource("pawpaths-user-location") as
    | GeoJSONSource
    | undefined;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function syncLocations() {
  const source = getLocationsSource();
  if (!source) return;

  source.setData(getFeatureCollection());
}

function getUserLocationFeatureCollection(): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: userLocation.value
      ? [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: userLocation.value,
            },
            properties: {},
          },
        ]
      : [],
  };
}

function syncUserLocation() {
  const source = getUserLocationSource();
  if (!source) return;

  source.setData(getUserLocationFeatureCollection());
}

function fitToLocations() {
  if (!map.value || mappedLocations.value.length === 0) return;

  const coordinates = mappedLocations.value.map(
    (location) =>
      [location.longitude as number, location.latitude as number] as [
        number,
        number,
      ],
  );
  const lngs = coordinates.map(([lng]) => lng);
  const lats = coordinates.map(([, lat]) => lat);
  const bounds = [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ] as [[number, number], [number, number]];

  map.value.fitBounds(bounds, {
    maxZoom: 13,
    padding: 56,
    duration: 700,
  });
}

function zoomToCoordinates(coordinates: [number, number]) {
  if (!map.value) return;

  map.value.easeTo({
    center: coordinates,
    zoom: Math.max(map.value.getZoom(), 14),
    duration: 800,
    essential: true,
  });
}

function isStoredMapViewport(value: unknown): value is StoredMapViewport {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;

  const viewport = value as Partial<StoredMapViewport>;

  return (
    Number.isFinite(viewport.lng) &&
    Number.isFinite(viewport.lat) &&
    Number.isFinite(viewport.zoom) &&
    Number.isFinite(viewport.bearing) &&
    Number.isFinite(viewport.pitch) &&
    Math.abs(viewport.lng as number) <= 180 &&
    Math.abs(viewport.lat as number) <= 90
  );
}

function readStoredMapViewport() {
  if (props.variant !== "search") return null;

  try {
    const storedValue = window.localStorage.getItem(mapViewportStorageKey);
    const parsedValue = storedValue ? JSON.parse(storedValue) : null;
    return isStoredMapViewport(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

function storeMapViewport() {
  if (props.variant !== "search" || !map.value) return;

  const center = map.value.getCenter();

  window.localStorage.setItem(
    mapViewportStorageKey,
    JSON.stringify({
      lng: center.lng,
      lat: center.lat,
      zoom: map.value.getZoom(),
      bearing: map.value.getBearing(),
      pitch: map.value.getPitch(),
    }),
  );
}

async function zoomToMyLocation() {
  if (!map.value || isLocating.value) return;

  locationError.value = "";

  if (!navigator.geolocation) {
    locationError.value = "Your browser does not support location lookup.";
    return;
  }

  isLocating.value = true;

  try {
    const position = await new Promise<GeolocationPosition>(
      (resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          maximumAge: 60_000,
          timeout: 10_000,
        });
      },
    );
    const coordinates: [number, number] = [
      position.coords.longitude,
      position.coords.latitude,
    ];

    userLocation.value = coordinates;
    syncUserLocation();
    zoomToCoordinates(coordinates);
  } catch {
    locationError.value = "Could not get your location.";
  } finally {
    isLocating.value = false;
  }
}

async function searchVisibleLocations() {
  if (!map.value || props.variant !== "search") return;

  const bounds = map.value.getBounds();
  const southWest = bounds.getSouthWest();
  const northEast = bounds.getNorthEast();

  isSearching.value = true;
  searchError.value = false;

  try {
    const response = await $fetch<LocationsResponse>("/api/locations", {
      query: {
        west: southWest.lng,
        south: southWest.lat,
        east: northEast.lng,
        north: northEast.lat,
        limit: props.limit,
        ...props.filters,
      },
    });

    hasSearched.value = true;
    fetchedLocations.value = response.items;
    emit("locationsLoaded", response);
  } catch {
    searchError.value = true;
  } finally {
    isSearching.value = false;
  }
}

function queueVisibleSearch() {
  if (props.variant !== "search") return;

  if (searchTimer) {
    window.clearTimeout(searchTimer);
  }

  searchTimer = window.setTimeout(() => {
    void searchVisibleLocations();
  }, 350);
}

function addLocationLayers() {
  if (!map.value || map.value.getSource("pawpaths-locations")) return;

  map.value.addSource("pawpaths-locations", {
    type: "geojson",
    data: getFeatureCollection(),
    cluster: true,
    clusterMaxZoom: 13,
    clusterRadius: 46,
  });

  map.value.addLayer({
    id: "pawpaths-clusters",
    type: "circle",
    source: "pawpaths-locations",
    filter: ["has", "point_count"],
    paint: {
      "circle-color": "#1f4d3a",
      "circle-radius": ["step", ["get", "point_count"], 18, 10, 24, 30, 31],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 3,
    },
  });

  map.value.addLayer({
    id: "pawpaths-cluster-count",
    type: "symbol",
    source: "pawpaths-locations",
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-size": 13,
      "text-font": ["Noto Sans Regular"],
    },
    paint: {
      "text-color": "#ffffff",
    },
  });

  map.value.addLayer({
    id: "pawpaths-location-halo",
    type: "circle",
    source: "pawpaths-locations",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": "#ffffff",
      "circle-radius": 10,
      "circle-opacity": 0.86,
    },
  });

  map.value.addLayer({
    id: "pawpaths-locations",
    type: "circle",
    source: "pawpaths-locations",
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": [
        "match",
        ["get", "kind"],
        "beach",
        "#5dade2",
        "forest",
        "#6f8756",
        "park",
        "#4caf7d",
        "restaurant",
        "#e6c15a",
        "#e76f51",
      ],
      "circle-radius": 6,
      "circle-stroke-color": "#1a1a1a",
      "circle-stroke-opacity": 0.18,
      "circle-stroke-width": 1,
    },
  });

  map.value.on("click", "pawpaths-clusters", async (event) => {
    const feature = map.value?.queryRenderedFeatures(event.point, {
      layers: ["pawpaths-clusters"],
    })[0];
    const clusterId = feature?.properties?.cluster_id;
    const source = getLocationsSource();

    if (!map.value || clusterId === undefined || !source) return;

    const zoom = await source.getClusterExpansionZoom(clusterId);
    map.value.easeTo({
      center: (feature.geometry as GeoJSON.Point).coordinates as [
        number,
        number,
      ],
      zoom,
    });
  });

  map.value.on("click", "pawpaths-locations", (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    const coordinates = (feature?.geometry as GeoJSON.Point | undefined)
      ?.coordinates;

    if (!map.value || !feature?.properties || !coordinates) return;

    popup.value
      ?.setLngLat(coordinates as [number, number])
      .setHTML(
        `${
          feature.properties.photoUrl
            ? `<img src="${escapeHtml(feature.properties.photoUrl)}" alt="${escapeHtml(
                feature.properties.photoAlt,
              )}" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:6px;margin-bottom:8px;" />`
            : ""
        }<strong>${escapeHtml(feature.properties.name)}</strong>
        <span>${escapeHtml(feature.properties.locality)}</span>
        <small>${escapeHtml(feature.properties.characteristics)}</small>
        <em>${escapeHtml(
          feature.properties.averageRating != null
            ? `Rating ${feature.properties.averageRating} (${feature.properties.ratingCount} ratings)`
            : "No rating yet",
        )}</em>
        <em>${escapeHtml(feature.properties.reviewCount)} reviews</em>
        <a href="${escapeHtml(
          feature.properties.detailPath,
        )}" style="display:inline-flex;align-items:center;justify-content:center;margin-top:8px;border-radius:6px;background:#1f4d3a;color:#fff;font-size:0.8125rem;font-weight:800;line-height:1;padding:9px 10px;text-decoration:none;">More information</a>`,
      )
      .addTo(map.value);
  });

  for (const layerId of ["pawpaths-clusters", "pawpaths-locations"]) {
    map.value.on("mouseenter", layerId, () => {
      if (map.value) map.value.getCanvas().style.cursor = "pointer";
    });
    map.value.on("mouseleave", layerId, () => {
      if (map.value) map.value.getCanvas().style.cursor = "";
    });
  }

  if (props.variant === "search") {
    map.value.on("moveend", () => {
      storeMapViewport();
      queueVisibleSearch();
    });
  }
}

function addUserLocationLayer() {
  if (!map.value || map.value.getSource("pawpaths-user-location")) return;

  map.value.addSource("pawpaths-user-location", {
    type: "geojson",
    data: getUserLocationFeatureCollection(),
  });

  map.value.addLayer({
    id: "pawpaths-user-location-accuracy",
    type: "circle",
    source: "pawpaths-user-location",
    paint: {
      "circle-color": "#2563eb",
      "circle-opacity": 0.16,
      "circle-radius": 22,
    },
  });

  map.value.addLayer({
    id: "pawpaths-user-location",
    type: "circle",
    source: "pawpaths-user-location",
    paint: {
      "circle-color": "#2563eb",
      "circle-radius": 7,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 3,
    },
  });
}

onMounted(async () => {
  if (!mapContainer.value) return;

  const maplibregl = await import("maplibre-gl");
  const storedViewport = readStoredMapViewport();
  const initialCenter = storedViewport
    ? ([storedViewport.lng, storedViewport.lat] as [number, number])
    : mappedLocations.value.length > 0
      ? ([
          mappedLocations.value[0].longitude,
          mappedLocations.value[0].latitude,
        ] as [number, number])
      : ([5.2913, 52.1326] as [number, number]);

  map.value = new maplibregl.Map({
    container: mapContainer.value,
    style: mapStyle,
    center: initialCenter,
    zoom: storedViewport?.zoom ?? (mappedLocations.value.length > 0 ? 8 : 6),
    bearing: storedViewport?.bearing ?? 0,
    pitch: storedViewport?.pitch ?? 0,
    attributionControl: false,
  });

  map.value.addControl(new maplibregl.NavigationControl(), "top-right");
  map.value.addControl(new maplibregl.AttributionControl({ compact: true }));
  popup.value = new maplibregl.Popup({
    closeButton: false,
    closeOnMove: true,
    offset: 14,
  });

  map.value.on("load", () => {
    addLocationLayers();
    addUserLocationLayer();
    if (!storedViewport) fitToLocations();
    isReady.value = true;
    queueVisibleSearch();
  });
});

watch(mappedLocations, () => {
  syncLocations();
  if (isReady.value && props.variant !== "search") fitToLocations();
});

watch(filterKey, () => {
  if (props.variant !== "search") return;

  queueVisibleSearch();
});

watch(userLocation, syncUserLocation);

onBeforeRouteLeave(() => {
  storeMapViewport();
});

onBeforeUnmount(() => {
  if (searchTimer) {
    window.clearTimeout(searchTimer);
  }
  popup.value?.remove();
  map.value?.remove();
});
</script>

<template>
  <UCard
    :ui="{ body: 'p-0 sm:p-0', header: 'p-4 sm:p-5' }"
    class="border-border bg-surface shadow-card overflow-hidden border"
  >
    <template #header>
      <div
        class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p class="text-brand-600 text-sm font-semibold">{{ eyebrow }}</p>
          <h2 class="font-title text-text-primary text-2xl font-extrabold">
            {{ title }}
          </h2>
        </div>

        <div class="flex items-stretch gap-2">
          <UBadge
            :aria-hidden="!isSearching"
            :class="isSearching ? 'opacity-100' : 'opacity-0'"
            color="primary"
            variant="soft"
          >
            Searching
          </UBadge>
          <UBadge color="neutral" variant="soft">
            {{ locationCountLabel }}
          </UBadge>
          <UButton
            :disabled="!isReady"
            :loading="isLocating"
            color="neutral"
            icon="i-lucide-crosshair"
            size="sm"
            variant="outline"
            @click="zoomToMyLocation"
          >
            Me
          </UButton>
          <UButton
            :disabled="mappedLocations.length === 0"
            color="neutral"
            icon="i-lucide-locate-fixed"
            size="sm"
            variant="outline"
            @click="fitToLocations"
          >
            Fit
          </UButton>
        </div>
      </div>
    </template>

    <div class="bg-surface-muted relative h-[28rem] min-h-80">
      <div ref="mapContainer" class="h-full w-full" />

      <UAlert
        v-if="locationError"
        :title="locationError"
        class="absolute top-4 left-4 z-10 max-w-sm shadow-sm"
        color="neutral"
        description="Allow location access in your browser, then try again."
        icon="i-lucide-crosshair"
        variant="soft"
      />

      <div
        v-if="mappedLocations.length === 0"
        class="pointer-events-none absolute inset-0 grid place-items-center"
      >
        <UAlert
          :description="
            searchError
              ? 'Try moving the map or checking the location API.'
              : 'The current results do not include coordinates yet.'
          "
          :title="
            searchError ? 'Could not search this area' : 'No mapped locations'
          "
          class="max-w-sm bg-white shadow-sm"
          color="neutral"
          variant="soft"
        />
      </div>
    </div>
  </UCard>
</template>

<style>
.maplibregl-popup-content {
  border-radius: 8px;
  box-shadow: 0 16px 36px rgb(15 63 42 / 0.18);
  color: #1a1a1a;
  display: grid;
  gap: 2px;
  min-width: 180px;
  padding: 10px 12px;
}

.maplibregl-popup-content strong,
.maplibregl-popup-content span,
.maplibregl-popup-content small,
.maplibregl-popup-content em {
  display: block;
}

.maplibregl-popup-content strong {
  font-weight: 800;
}

.maplibregl-popup-content span,
.maplibregl-popup-content small {
  color: #6b6b6b;
}

.maplibregl-popup-content em {
  color: #1f4d3a;
  font-size: 0.75rem;
  font-style: normal;
  font-weight: 700;
  margin-top: 4px;
}
</style>
