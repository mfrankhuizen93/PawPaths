<script lang="ts" setup>
import AppPageToolbar from "~/components/common/AppPageToolbar.vue";
import type { GeoJSONSource, Map, MapLayerMouseEvent } from "maplibre-gl";
import type { GeocodeResult } from "#shared/types/geo";
import type {
  LocationFilters,
  LocationListItem,
  LocationsResponse,
} from "#shared/types/locations";
import { fetchAllLocationPages } from "#shared/utils/location-pages";
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
  locationSelected: [location: LocationListItem];
}>();

const config = useRuntimeConfig();
const mapContainer = ref<HTMLElement | null>(null);
const map = shallowRef<Map | null>(null);
const isReady = ref(false);
const isSearching = ref(false);
const isSearchExpanded = ref(false);
const isLocating = ref(false);
const searchError = ref(false);
const hasSearched = ref(false);
const locationError = ref("");
const userLocation = ref<[number, number] | null>(null);
const fetchedLocations = ref<LocationListItem[]>([]);
let searchTimer: ReturnType<typeof window.setTimeout> | null = null;
let searchRequestId = 0;
let searchAbortController: AbortController | null = null;

const mapStyle =
  config.public.mapStyleUrl || "https://demotiles.maplibre.org/style.json";

const activeLocations = computed(() => {
  const locations =
    props.variant === "single"
      ? props.location
        ? [props.location]
        : []
      : props.variant === "search" && hasSearched.value
        ? fetchedLocations.value
        : props.locations;

  if (
    !props.location ||
    locations.some((item) => item.id === props.location?.id)
  ) {
    return locations;
  }

  return [props.location, ...locations];
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
        detailPath: getLocationPath(location),
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

function syncLocations() {
  const source = getLocationsSource();
  if (!source) return;

  source.setData(getFeatureCollection());
}

function syncSelectedLocation() {
  if (!map.value?.getLayer("pawpaths-location-selection")) return;

  map.value.setFilter("pawpaths-location-selection", [
    "all",
    ["!", ["has", "point_count"]],
    ["==", ["get", "id"], props.location?.id ?? ""],
  ]);
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

function getFocusOffset() {
  if (props.variant !== "search" || !props.location || !mapContainer.value) {
    return [0, 0] as [number, number];
  }

  const height = mapContainer.value.clientHeight;

  return [0, -Math.min(260, Math.max(120, height * 0.28))] as [number, number];
}

function zoomToCoordinates(coordinates: [number, number]) {
  if (!map.value) return;

  map.value.easeTo({
    center: coordinates,
    zoom: Math.max(map.value.getZoom(), 14),
    offset: getFocusOffset(),
    duration: 800,
    essential: true,
  });
}

function zoomIn() {
  map.value?.zoomIn({ duration: 300 });
}

function zoomOut() {
  map.value?.zoomOut({ duration: 300 });
}

function searchAddress(result: GeocodeResult) {
  zoomToCoordinates([result.longitude, result.latitude]);
  queueVisibleSearch();
}

function selectSearchAddress(result: GeocodeResult) {
  searchAddress(result);
  isSearchExpanded.value = false;
}

function getLocationCoordinates(location?: LocationListItem | null) {
  if (
    !location ||
    !Number.isFinite(location.latitude) ||
    !Number.isFinite(location.longitude)
  ) {
    return null;
  }

  return [location.longitude as number, location.latitude as number] as [
    number,
    number,
  ];
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
  if (getLocationCoordinates(props.location)) return null;

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

  const requestId = (searchRequestId += 1);
  searchAbortController?.abort();
  const abortController = new AbortController();
  searchAbortController = abortController;
  const bounds = map.value.getBounds();
  const southWest = bounds.getSouthWest();
  const northEast = bounds.getNorthEast();

  isSearching.value = true;
  searchError.value = false;

  try {
    const baseQuery = {
      west: southWest.lng,
      south: southWest.lat,
      east: northEast.lng,
      north: northEast.lat,
      ...props.filters,
    };
    const response = await fetchAllLocationPages(({ limit, skip }) =>
      $fetch<LocationsResponse>("/api/locations", {
        query: {
          ...baseQuery,
          limit,
          skip,
        },
        signal: abortController.signal,
      }),
      {
        pageSize: props.limit,
      },
    );

    if (requestId !== searchRequestId) return;

    hasSearched.value = true;
    fetchedLocations.value = response.items;
    emit("locationsLoaded", response);
  } catch {
    if (requestId !== searchRequestId) return;
    if (abortController.signal.aborted) return;

    searchError.value = true;
  } finally {
    if (requestId === searchRequestId) {
      isSearching.value = false;
      searchAbortController = null;
    }
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
      "circle-color": "#4d7c5e",
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
      "text-font": ["Metropolis Medium"],
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
      "circle-radius": 13,
      "circle-opacity": 0.94,
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
        "#5DADE2",
        "nature reserve",
        "#4F7A5A",
        "park",
        "#8BAE7A",
        "dog playground",
        "#6BBF73",
        "#E2F5E5",
      ],
      "circle-radius": 9,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-opacity": 1,
      "circle-stroke-width": 2,
    },
  });

  map.value.addLayer({
    id: "pawpaths-location-selection",
    type: "circle",
    source: "pawpaths-locations",
    filter: [
      "all",
      ["!", ["has", "point_count"]],
      ["==", ["get", "id"], props.location?.id ?? ""],
    ],
    paint: {
      "circle-color": "rgba(255, 255, 255, 0)",
      "circle-radius": 16,
      "circle-stroke-color": "#4d7c5e",
      "circle-stroke-width": 3,
    },
  });

  map.value.on("click", "pawpaths-clusters", async (event) => {
    const feature = map.value?.queryRenderedFeatures(event.point, {
      layers: ["pawpaths-clusters"],
    })[0];
    const clusterId = feature?.properties?.cluster_id;
    const source = getLocationsSource();

    if (!map.value || !feature || clusterId === undefined || !source) return;

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

    const selectedLocation = activeLocations.value.find(
      (location) => location.id === feature.properties?.id,
    );

    if (selectedLocation) {
      emit("locationSelected", selectedLocation);
    }
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
  const focusedCoordinates = getLocationCoordinates(props.location);
  const initialCenter = storedViewport
    ? ([storedViewport.lng, storedViewport.lat] as [number, number])
    : focusedCoordinates
      ? focusedCoordinates
      : mappedLocations.value.length > 0
        ? ([
            mappedLocations.value[0]?.longitude,
            mappedLocations.value[0]?.latitude,
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

  map.value.addControl(new maplibregl.AttributionControl({ compact: true }));

  map.value.on("load", () => {
    addLocationLayers();
    addUserLocationLayer();
    if (focusedCoordinates) {
      zoomToCoordinates(focusedCoordinates);
    } else if (!storedViewport) {
      fitToLocations();
    }
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

watch(
  () => props.location?.id,
  () => {
    const coordinates = getLocationCoordinates(props.location);

    syncSelectedLocation();

    if (isReady.value && coordinates) {
      zoomToCoordinates(coordinates);
    }
  },
);

onBeforeRouteLeave(() => {
  storeMapViewport();
});

onBeforeUnmount(() => {
  if (searchTimer) {
    window.clearTimeout(searchTimer);
  }

  searchAbortController?.abort();
  map.value?.remove();
});
</script>

<template>
  <div class="bg-muted relative h-full overflow-hidden">
    <div ref="mapContainer" class="h-full min-h-96 w-full" />

    <div v-if="variant === 'search'" class="absolute inset-x-0 top-0 z-10">
      <AppPageToolbar overlay>
        <template #primary>
          <UButton
            v-if="!isSearchExpanded"
            aria-label="Search locations"
            class="border-default/60 bg-default/88 size-12 justify-center rounded-2xl border p-0 shadow-lg backdrop-blur-xl"
            color="neutral"
            icon="i-lucide-search"
            size="lg"
            square
            variant="ghost"
            @click="isSearchExpanded = true"
          />

          <div
            v-else
            class="border-default/60 bg-default/88 h-12 min-w-0 flex-1 rounded-2xl border shadow-lg backdrop-blur-xl sm:max-w-md"
          >
            <AppAddressSearch
              autofocus
              collapsible
              placeholder="Search PawPaths"
              @close="isSearchExpanded = false"
              @selected="selectSearchAddress"
            />
          </div>
        </template>

        <template v-if="!isSearchExpanded" #actions>
          <slot name="actions" />
        </template>
      </AppPageToolbar>
    </div>

    <div
      v-if="variant === 'search'"
      class="absolute right-3 bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 flex flex-col gap-3 sm:right-5 sm:bottom-5"
    >
      <div
        class="border-default/60 bg-default/88 flex flex-col overflow-hidden rounded-xl border shadow-lg backdrop-blur-xl"
      >
        <UButton
          aria-label="Zoom in"
          class="size-10 justify-center p-0"
          :disabled="!isReady"
          color="neutral"
          icon="i-lucide-plus"
          size="sm"
          square
          variant="ghost"
          @click="zoomIn"
        />
        <USeparator />
        <UButton
          aria-label="Zoom out"
          class="size-10 justify-center p-0"
          :disabled="!isReady"
          color="neutral"
          icon="i-lucide-minus"
          size="sm"
          square
          variant="ghost"
          @click="zoomOut"
        />
      </div>

      <UButton
        aria-label="Go to my location"
        :disabled="!isReady"
        :loading="isLocating"
        class="border-default/60 bg-default/88 size-10 justify-center rounded-xl border p-0 shadow-lg backdrop-blur-xl"
        color="neutral"
        icon="i-lucide-navigation"
        size="sm"
        square
        variant="ghost"
        @click="zoomToMyLocation"
      />
    </div>

    <UAlert
      v-if="locationError"
      :title="locationError"
      class="absolute top-24 left-3 z-10 max-w-sm shadow-lg sm:top-28 sm:left-5"
      color="neutral"
      description="Allow location access in your browser, then try again."
      icon="i-lucide-navigation"
      variant="soft"
    />

    <div
      v-if="mappedLocations.length === 0"
      class="pointer-events-none absolute inset-0 grid place-items-center p-6"
    >
      <AppEmptyState
        :description="
          searchError
            ? 'Try moving the map or checking the location API.'
            : 'The current results do not include coordinates yet.'
        "
        icon="i-lucide-map-pin-off"
        :title="
          searchError ? 'Could not search this area' : 'No mapped locations'
        "
        class="bg-default/90 pointer-events-auto max-w-sm rounded-2xl shadow-lg backdrop-blur-xl"
      />
    </div>

    <div
      v-if="variant === 'search'"
      class="bg-default/88 text-muted absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-3 z-10 hidden rounded-full px-3 py-2 text-xs font-medium shadow-sm backdrop-blur-xl sm:left-5 sm:block"
    >
      <span v-if="isSearching">Searching this area...</span>
      <span v-else>{{ locationCountLabel }}</span>
    </div>
  </div>
</template>

<style scoped>
:deep(.maplibregl-ctrl-attrib) {
  border-radius: 0.75rem 0 0;
  background: color-mix(in srgb, var(--ui-bg) 88%, transparent);
  backdrop-filter: blur(16px);
}
</style>
