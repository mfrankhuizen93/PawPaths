import fs from "node:fs/promises";
import { MongoClient } from "mongodb";
import { getMongoConfig, loadEnvFile } from "./env.js";

const BASE_URL = "https://www.staatsbosbeheer.nl";
const SEARCH_URL = `${BASE_URL}/api/search`;
const JSON_OUTPUT_PATH = "staatsbosbeheer-locations.json";
const META_OUTPUT_PATH = "staatsbosbeheer-locations.meta.json";
const SOURCE = "staatsbosbeheer";
const DEFAULT_MAX_PAGES = 60;
const PAGE_DELAY_MS = 750;
const REVERSE_GEOCODE_DELAY_MS = 1_100;
const DUPLICATE_RADIUS_METERS = 350;
const PARKING_SEARCH_RADIUS_METERS = 2_000;
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.nchc.org.tw/api/interpreter",
];
const ROUTE_RESULT_TYPE = "Routes";
const WALKING_TRAIL_CHARACTERISTIC = "walking trails";
const OFF_LEASH_CHARACTERISTIC = "off-leash area";
const ROUTE_COLOR_LABELS = new Map([
  ["blauw", "blue"],
  ["donkerblauw", "blue"],
  ["lichtblauw", "light blue"],
  ["bruin", "brown"],
  ["geel", "yellow"],
  ["groen", "green"],
  ["oranje", "orange"],
  ["paars", "purple"],
  ["rood", "red"],
  ["wit", "white"],
  ["zwart", "black"],
]);
const DUTCH_ROUTE_COLORS = new Set(ROUTE_COLOR_LABELS.keys());

const HEADERS = {
  "User-Agent": "Pawpaths location research scraper - contact: your@email.com",
  Accept: "application/json",
};

function getArgument(name) {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));

  return value ? value.slice(prefix.length) : null;
}

const AREA_FILTER = getArgument("area");
const MAX_PAGES = Number(getArgument("max-pages") ?? DEFAULT_MAX_PAGES);
const INCLUDE_EXISTING = process.argv.includes("--include-existing");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const reverseGeocodeCache = new Map();
const geocodeCache = new Map();
const routeDetailCache = new Map();
const areaSearchCache = new Map();
const parkingSearchCache = new Map();

function clean(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function slugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function absoluteUrl(path) {
  if (!path) return null;

  return new URL(path, BASE_URL).toString();
}

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function toFiniteNumber(value) {
  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function isFiniteCoordinate(latitude, longitude) {
  return (
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function isLikelyDutchCoordinate(latitude, longitude) {
  return (
    isFiniteCoordinate(latitude, longitude) &&
    latitude >= 50.6 &&
    latitude <= 53.8 &&
    longitude >= 3.0 &&
    longitude <= 7.4
  );
}

function routeMatchesArea(route, areaFilter) {
  if (!areaFilter) return true;

  const needle = slugify(areaFilter);
  const values = [
    route.Title,
    route.InfoDetails?.Location?.Text,
    route.InfoDetails?.Location?.Url,
  ]
    .map(slugify)
    .filter(Boolean);

  return values.some((value) => value.includes(needle));
}

function getLocationName(route) {
  return clean(route.InfoDetails?.Location?.Text);
}

function getProvince(route) {
  const provinces = route.InfoDetails?.Location?.Provinces;

  return Array.isArray(provinces) && provinces.length > 0
    ? clean(provinces[0])
    : null;
}

function getCityFromTitle(route, locationName) {
  const title = clean(route.Title);
  const locationSlug = slugify(locationName);
  const parts = title
    .split(/\s+-\s+/)
    .map(clean)
    .filter(Boolean);

  const routeName =
    parts.toReversed().find((part) => slugify(part) !== locationSlug) ??
    parts[0] ??
    title;
  const withoutPrefix = routeName
    .replace(
      /^(wandelroute|wandelpad|boswachterspad|mountainbikeroute)\s+/i,
      "",
    )
    .trim();
  const words = withoutPrefix
    .split(/\s+/)
    .filter((word) => !DUTCH_ROUTE_COLORS.has(slugify(word)));
  const cleanedRouteName = words.join(" ");
  const directionalMatch = cleanedRouteName.match(
    /^(.+?)\s+(?:naar|rondom|door|in)\s+/i,
  );
  const candidate = clean(directionalMatch?.[1] ?? cleanedRouteName);

  return candidate && /^[A-ZÀ-ÖØ-Þ]/.test(candidate) ? candidate : null;
}

function getCityFromIntroduction(route) {
  const text = clean(route.Introduction);
  const patterns = [
    /\b(?:vlakbij|bij|in|rond|vanaf|door)\s+([A-ZÀ-ÖØ-Þ][\p{L}'-]*(?:\s+[A-ZÀ-ÖØ-Þ][\p{L}'-]*){0,3})/u,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return clean(match[1]);
  }

  return null;
}

function getRouteCity(route, locationName) {
  return getCityFromTitle(route, locationName) ?? getCityFromIntroduction(route);
}

function getCandidateCity(locationName, routes) {
  const counts = new Map();

  for (const route of routes) {
    const city = getRouteCity(route, locationName);
    if (!city) continue;

    counts.set(city, (counts.get(city) ?? 0) + 1);
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  return ranked[0]?.[0] ?? locationName;
}

function toText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function pickCity(address = {}) {
  return (
    toText(address.city) ||
    toText(address.town) ||
    toText(address.village) ||
    toText(address.hamlet) ||
    toText(address.municipality)
  );
}

async function reverseGeocode(latitude, longitude) {
  if (!isFiniteCoordinate(latitude, longitude)) return null;

  const cacheKey = `${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  if (reverseGeocodeCache.has(cacheKey)) {
    return reverseGeocodeCache.get(cacheKey);
  }

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("zoom", "16");
  url.searchParams.set("addressdetails", "1");

  await sleep(REVERSE_GEOCODE_DELAY_MS);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "PawPaths/1.0 (https://pawpaths.nl)",
    },
  }).catch(() => null);

  if (!response?.ok) {
    reverseGeocodeCache.set(cacheKey, null);
    return null;
  }

  const data = await response.json();
  const address = data.address ?? {};
  const result = {
    city: pickCity(address),
    province: toText(address.state) || toText(address.province),
    country: toText(address.country_code)?.toUpperCase() ?? null,
  };

  reverseGeocodeCache.set(cacheKey, result);
  return result;
}

function normalizeSearchName(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "-")
    .toLowerCase();
}

async function findNatureArea(locationName, province) {
  const cacheKey = `${locationName}:${province}`;
  if (areaSearchCache.has(cacheKey)) {
    return areaSearchCache.get(cacheKey);
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set(
    "q",
    [locationName, province, "Nederland"].filter(hasText).join(", "),
  );
  url.searchParams.set("countrycodes", "nl");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "8");

  await sleep(REVERSE_GEOCODE_DELAY_MS);
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "PawPaths/1.0 (https://pawpaths.nl)",
    },
  }).catch(() => null);

  if (!response?.ok) {
    areaSearchCache.set(cacheKey, null);
    return null;
  }

  const expectedName = normalizeSearchName(locationName);
  const results = await response.json();
  const ranked = (Array.isArray(results) ? results : [])
    .map((result) => {
      const latitude = toFiniteNumber(result.lat);
      const longitude = toFiniteNumber(result.lon);
      const exactName = normalizeSearchName(result.name) === expectedName;
      const isNatureArea =
        result.type === "nature_reserve" ||
        result.category === "boundary" ||
        result.category === "leisure";
      const provinceMatches =
        !province ||
        clean(result.display_name)
          .toLowerCase()
          .includes(clean(province).toLowerCase());

      return {
        result,
        latitude,
        longitude,
        score:
          (exactName ? 100 : 0) +
          (result.type === "nature_reserve" ? 40 : 0) +
          (isNatureArea ? 20 : 0) +
          (provinceMatches ? 10 : 0) +
          Number(result.importance ?? 0),
      };
    })
    .filter(
      (item) =>
        isLikelyDutchCoordinate(item.latitude, item.longitude) &&
        normalizeSearchName(item.result.name) === expectedName,
    )
    .sort((a, b) => b.score - a.score);
  const match = ranked[0];
  const area = match
    ? {
        latitude: match.latitude,
        longitude: match.longitude,
        osmType: match.result.osm_type ?? null,
        osmId: match.result.osm_id ?? null,
        category: match.result.category ?? null,
        type: match.result.type ?? null,
        displayName: clean(match.result.display_name) || null,
        sourceUrl:
          match.result.osm_type && match.result.osm_id
            ? `https://www.openstreetmap.org/${match.result.osm_type}/${match.result.osm_id}`
            : null,
      }
    : null;

  areaSearchCache.set(cacheKey, area);
  return area;
}

function getCoordinate(route) {
  const detailedCoordinate = route.staatsbosbeheerDetailCoordinate;

  if (
    detailedCoordinate &&
    isFiniteCoordinate(
      detailedCoordinate.latitude,
      detailedCoordinate.longitude,
    )
  ) {
    return detailedCoordinate;
  }

  const latitude = toFiniteNumber(route.GeoCoordinate?.Latitude);
  const longitude = toFiniteNumber(route.GeoCoordinate?.Longitude);

  return isLikelyDutchCoordinate(latitude, longitude)
    ? { latitude, longitude }
    : null;
}

function getDetailCoordinate(detail) {
  const latitude =
    toFiniteNumber(detail?.GeoCoordinate?.Latitude) ??
    toFiniteNumber(detail?.GeoCoordinate?.["Coordinate.Latitude"]);
  const longitude =
    toFiniteNumber(detail?.GeoCoordinate?.Longitude) ??
    toFiniteNumber(detail?.GeoCoordinate?.["Coordinate.Longitude"]);

  return isLikelyDutchCoordinate(latitude, longitude)
    ? { latitude, longitude }
    : null;
}

function getDetailAddressQueries(address) {
  if (!address) return [];

  const street = [address.StreetName, address.StreetNumber]
    .filter(hasText)
    .join(" ");
  const city = clean(address.City);
  const postalCode = clean(address.PostalCode);
  const title = clean(address.Title);
  const queries = [
    [title, city, postalCode, "Nederland"],
    [title, street, city, "Nederland"],
    [street, postalCode, city, "Nederland"],
    [street, city, "Nederland"],
  ]
    .map((parts) => parts.map(clean).filter(Boolean).join(", "))
    .filter(Boolean);

  return uniqueBy(queries, (query) => query);
}

async function geocodeAddress(query) {
  if (!query) return null;

  if (geocodeCache.has(query)) {
    return geocodeCache.get(query);
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "1");

  await sleep(REVERSE_GEOCODE_DELAY_MS);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "PawPaths/1.0 (https://pawpaths.nl)",
    },
  }).catch(() => null);

  if (!response?.ok) {
    geocodeCache.set(query, null);
    return null;
  }

  const results = await response.json();
  const first = Array.isArray(results) ? results[0] : null;
  const coordinate = first
    ? {
        latitude: toFiniteNumber(first.lat),
        longitude: toFiniteNumber(first.lon),
      }
    : null;
  const result =
    coordinate && isFiniteCoordinate(coordinate.latitude, coordinate.longitude)
      ? coordinate
      : null;

  geocodeCache.set(query, result);
  return result;
}

async function geocodeAddressQueries(queries) {
  for (const query of queries) {
    const result = await geocodeAddress(query);
    if (result) return result;
  }

  return null;
}

async function fetchRouteDetail(route) {
  const url = absoluteUrl(route.URL);
  if (!url) return null;

  if (routeDetailCache.has(url)) {
    return routeDetailCache.get(url);
  }

  await sleep(PAGE_DELAY_MS);
  const response = await fetch(url, { headers: HEADERS }).catch(() => null);

  if (!response?.ok) {
    routeDetailCache.set(url, null);
    return null;
  }

  const html = await response.text();
  const match = html.match(
    /<script[^>]+type=["']application\/data-detailmap["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  const detail = match ? JSON.parse(decodeHtml(match[1])) : null;

  routeDetailCache.set(url, detail);
  return detail;
}

async function enrichRoute(route) {
  if (!routeIsDogRelevant(route)) return route;

  const detail = await fetchRouteDetail(route);
  const detailCoordinate = getDetailCoordinate(detail);
  const addressCoordinate = detailCoordinate
    ? null
    : await geocodeAddressQueries(
        getDetailAddressQueries(detail?.InfoDetails?.Address),
      );

  return {
    ...route,
    staatsbosbeheerDetailAddress: detail?.InfoDetails?.Address ?? null,
    // Staatsbosbeheer builds "Ga naar startpunt" from this exact coordinate.
    staatsbosbeheerDetailCoordinate: detailCoordinate ?? addressCoordinate,
    staatsbosbeheerCoordinateSource: detailCoordinate
      ? "start-point"
      : addressCoordinate
        ? "geocoded-address"
        : null,
  };
}

function getRouteColor(route) {
  if (!Array.isArray(route.RouteColor) || route.RouteColor.length === 0) {
    return null;
  }

  const color = clean(route.RouteColor[0]).toLowerCase();

  return ROUTE_COLOR_LABELS.get(color) ?? color;
}

function formatKilometers(value) {
  const number = toFiniteNumber(value);
  if (number === null) return null;

  return `${Number.isInteger(number) ? number : number.toFixed(1)}km`;
}

function cleanRouteTitle(title) {
  return clean(title).replace(
    /^(wandelroute|wandelpad|boswachterspad|mountainbikeroute)\s+/i,
    "",
  );
}

function getRouteStartLabel(route) {
  const title = cleanRouteTitle(route.Title) || "Route";
  const color = getRouteColor(route);
  const distance = formatKilometers(route.RouteLength);
  const details = [distance, color].filter(Boolean).join(", ");

  return details ? `${title} (${details})` : title;
}

function routeAllowsDogs(route) {
  const properties = Array.isArray(route.Properties) ? route.Properties : [];

  return properties.some((property) => /honden toegestaan/i.test(property));
}

function routeDisallowsDogs(route) {
  const properties = Array.isArray(route.Properties) ? route.Properties : [];

  return properties.some((property) => /honden niet toegestaan/i.test(property));
}

function routeSuggestsOffLeash(route) {
  const values = [
    route.Title,
    route.Introduction,
    ...(Array.isArray(route.Properties) ? route.Properties : []),
    ...(Array.isArray(route.Tags) ? route.Tags : []),
  ].join(" ");

  return /honden?\s*los|losloop/i.test(values);
}

function routeIsDogRelevant(route) {
  return routeAllowsDogs(route) || routeSuggestsOffLeash(route);
}

function getPhoto(route) {
  const url = absoluteUrl(route.Image?.Url);

  if (!url) return null;

  return {
    url,
    originalUrl: url,
    alt: clean(route.Image?.AltText) || null,
  };
}

async function enrichCandidate(candidate) {
  const reverse =
    candidate.latitude !== null && candidate.longitude !== null
      ? await reverseGeocode(candidate.latitude, candidate.longitude)
      : null;
  const city = reverse?.city ?? candidate.city;

  return {
    ...candidate,
    slug: slugify([candidate.name, city].filter(hasText).join("-")),
    city,
    province: reverse?.province ?? candidate.province,
    country: reverse?.country ?? candidate.country,
  };
}

function uniqueBy(items, getKey) {
  const seen = new Set();

  return items.filter((item) => {
    const key = getKey(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function distanceMeters(from, to) {
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const fromLatitude = radians(from.latitude);
  const toLatitude = radians(to.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) *
      Math.cos(toLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    2 *
    earthRadiusMeters *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

function getElementCoordinate(element) {
  const latitude = toFiniteNumber(element.lat ?? element.center?.lat);
  const longitude = toFiniteNumber(element.lon ?? element.center?.lon);

  return isLikelyDutchCoordinate(latitude, longitude)
    ? { latitude, longitude }
    : null;
}

async function fetchOverpass(query) {
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const body = new URLSearchParams({ data: query });
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": "PawPaths/1.0 (https://pawpaths.nl)",
      },
      body,
      signal: AbortSignal.timeout(45_000),
    }).catch(() => null);

    if (!response?.ok) continue;

    const data = await response.json().catch(() => null);
    if (Array.isArray(data?.elements)) return data.elements;
  }

  return [];
}

async function findNearbyParking(routeStarts) {
  const uniqueStarts = uniqueBy(
    routeStarts,
    (point) => `${point.latitude.toFixed(5)}:${point.longitude.toFixed(5)}`,
  );
  if (uniqueStarts.length === 0) return [];

  const cacheKey = uniqueStarts
    .map((point) => `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`)
    .sort()
    .join("|");
  if (parkingSearchCache.has(cacheKey)) {
    return parkingSearchCache.get(cacheKey);
  }

  const selectors = uniqueStarts
    .map(
      (point) =>
        `nwr["amenity"="parking"]["access"!="private"]["access"!="no"](around:${PARKING_SEARCH_RADIUS_METERS},${point.latitude},${point.longitude});`,
    )
    .join("");
  const elements = await fetchOverpass(
    `[out:json][timeout:40];(${selectors});out center tags;`,
  );
  const parking = uniqueBy(
    elements
      .map((element) => {
        const coordinate = getElementCoordinate(element);
        if (!coordinate) return null;

        return {
          ...coordinate,
          osmType: element.type,
          osmId: element.id,
          name: clean(element.tags?.name) || null,
          parkingType: clean(element.tags?.parking) || null,
          access: clean(element.tags?.access) || null,
          sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
        };
      })
      .filter(Boolean),
    (item) => `${item.osmType}:${item.osmId}`,
  );

  parkingSearchCache.set(cacheKey, parking);
  return parking;
}

async function buildParkingPoints(routePoints) {
  const parking = await findNearbyParking(routePoints);
  const assignments = routePoints
    .map((routePoint) => {
      const closest = parking
        .map((parkingPoint) => ({
          parkingPoint,
          distance: distanceMeters(routePoint, parkingPoint),
        }))
        .filter((item) => item.distance <= PARKING_SEARCH_RADIUS_METERS)
        .sort((a, b) => a.distance - b.distance)[0];

      return closest ? { routePoint, ...closest } : null;
    })
    .filter(Boolean);
  const grouped = new Map();

  for (const assignment of assignments) {
    const key = `${assignment.parkingPoint.osmType}:${assignment.parkingPoint.osmId}`;
    grouped.set(key, [...(grouped.get(key) ?? []), assignment]);
  }

  return [...grouped.entries()].map(([key, group]) => {
    const parkingPoint = group[0].parkingPoint;
    const routeLabels = group.map((item) => {
      const withoutDetails = item.routePoint.label.replace(
        /\s+\([^)]*\)$/,
        "",
      );
      const withoutArea = withoutDetails.replace(/\s+-\s+[^-]+$/, "");

      return withoutArea.replace(
        /\s+(?:blauw|bruin|geel|groen|lichtblauw|donkerblauw|oranje|paars|rood|wit|zwart)$/i,
        "",
      );
    });
    const uniqueRouteLabels = uniqueBy(routeLabels, (label) => label);
    const label =
      parkingPoint.name ||
      `Parking - ${uniqueRouteLabels.slice(0, 2).join(" / ")}${uniqueRouteLabels.length > 2 ? ` +${uniqueRouteLabels.length - 2}` : ""}`;

    return {
      id: `osm-parking-${slugify(key)}`,
      kind: "parking",
      label,
      latitude: parkingPoint.latitude,
      longitude: parkingPoint.longitude,
      sourceUrl: parkingPoint.sourceUrl,
      osm: {
        type: parkingPoint.osmType,
        id: parkingPoint.osmId,
        parkingType: parkingPoint.parkingType,
        access: parkingPoint.access,
        distanceMeters: Math.round(
          Math.min(...group.map((item) => item.distance)),
        ),
        routePointIds: group.map((item) => item.routePoint.id),
      },
    };
  });
}

function averageCoordinate(points) {
  const coordinates = points.filter((point) =>
    isFiniteCoordinate(point.latitude, point.longitude),
  );

  if (coordinates.length === 0) return { latitude: null, longitude: null };

  return {
    latitude:
      coordinates.reduce((total, point) => total + point.latitude, 0) /
      coordinates.length,
    longitude:
      coordinates.reduce((total, point) => total + point.longitude, 0) /
      coordinates.length,
  };
}

function buildCoordinatePoints(routes) {
  const points = routes
    .map((route) => {
      const coordinate = getCoordinate(route);
      if (!coordinate) return null;

      return {
        id: `staatsbosbeheer-route-${slugify(route.Id ?? route.URL)}`,
        kind: routeSuggestsOffLeash(route) ? "off-leash-area" : "poi",
        label: getRouteStartLabel(route),
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        sourceUrl: absoluteUrl(route.URL),
      };
    })
    .filter(Boolean);

  return uniqueBy(
    points,
    (point) =>
      `${point.kind}:${point.label}:${point.latitude.toFixed(6)}:${point.longitude.toFixed(6)}`,
  );
}

function buildRelatedUrls(routes, locationUrl) {
  const routeUrls = routes
    .map((route) => {
      const url = absoluteUrl(route.URL);
      if (!url) return null;

      return {
        label: clean(route.Title) || "Staatsbosbeheer route",
        url,
      };
    })
    .filter(Boolean);

  return uniqueBy(
    [
      locationUrl
        ? {
            label: "Staatsbosbeheer natuurgebied",
            url: locationUrl,
          }
        : null,
      ...routeUrls,
    ].filter(Boolean),
    (item) => item.url,
  );
}

function buildRouteCandidate(route, parkingPoint = null) {
  const locationName = getLocationName(route);
  const city =
    clean(route.staatsbosbeheerDetailAddress?.City) ||
    getRouteCity(route, locationName) ||
    locationName;
  const routePoint = buildCoordinatePoints([route])[0] ?? null;
  const coordinate = getCoordinate(route);
  const routeUrl = absoluteUrl(route.URL);
  const locationUrl = absoluteUrl(route.InfoDetails?.Location?.Url);
  const distance = formatKilometers(route.RouteLength);
  const color = getRouteColor(route);
  const name = cleanRouteTitle(route.Title) || locationName || "Walking route";
  const characteristics = [
    WALKING_TRAIL_CHARACTERISTIC,
    routeSuggestsOffLeash(route) ? OFF_LEASH_CHARACTERISTIC : null,
  ].filter(Boolean);
  const relatedUrls = [
    routeUrl
      ? {
          label: clean(route.Title) || "Staatsbosbeheer route",
          url: routeUrl,
        }
      : null,
    locationUrl
      ? {
          label: "Staatsbosbeheer natuurgebied",
          url: locationUrl,
        }
      : null,
    parkingPoint?.sourceUrl
      ? {
          label: `OpenStreetMap ${parkingPoint.label}`,
          url: parkingPoint.sourceUrl,
        }
      : null,
  ].filter(Boolean);

  return {
    slug: slugify([name, city].filter(hasText).join("-")),
    slugIdentity: slugify(route.Id ?? route.URL).slice(0, 8),
    source: SOURCE,
    sourceUrl: routeUrl,
    name,
    city,
    province: getProvince(route),
    country: "NL",
    latitude: coordinate?.latitude ?? null,
    longitude: coordinate?.longitude ?? null,
    location:
      coordinate !== null
        ? {
            type: "Point",
            coordinates: [coordinate.longitude, coordinate.latitude],
          }
        : null,
    type: ["nature reserve"],
    characteristics,
    warnings: [],
    description: `Dog-friendly Staatsbosbeheer walking route${locationName ? ` in ${locationName}` : ""}${distance ? ` (${distance})` : ""}.`,
    relatedUrls,
    photos: [getPhoto(route)].filter(Boolean),
    reviews: [],
    coordinatePoints: [routePoint, parkingPoint].filter(Boolean),
    staatsbosbeheer: {
      area: locationName,
      route: {
        id: route.Id,
        title: clean(route.Title),
        url: routeUrl,
        routeType: clean(route.RouteType) || null,
        lengthKm: toFiniteNumber(route.RouteLength),
        color,
        dogsAllowed: routeAllowsDogs(route),
        dogsNotAllowed: routeDisallowsDogs(route),
        offLeashHint: routeSuggestsOffLeash(route),
        properties: Array.isArray(route.Properties) ? route.Properties : [],
        coordinateSource: route.staatsbosbeheerCoordinateSource ?? "listing",
      },
      parking: parkingPoint?.osm ?? null,
    },
    status: "published",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function fetchRoutePage(page) {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("resultType", ROUTE_RESULT_TYPE);
  url.searchParams.set("page", String(page));

  await sleep(PAGE_DELAY_MS);
  const response = await fetch(url, { headers: HEADERS });

  if (!response.ok) {
    throw new Error(`Failed ${response.status}: ${url}`);
  }

  return await response.json();
}

async function fetchRoutes() {
  const routes = [];
  let totalResults = null;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    console.log(`Fetching Staatsbosbeheer routes page ${page}`);
    const data = await fetchRoutePage(page);
    const pageRoutes = Array.isArray(data.Results) ? data.Results : [];

    totalResults = toFiniteNumber(data.TotalResults) ?? totalResults;
    routes.push(...pageRoutes);
    console.log(`Found ${pageRoutes.length} routes on page ${page}`);

    if (pageRoutes.length === 0) break;
    if (totalResults !== null && routes.length >= totalResults) break;
  }

  return uniqueBy(routes, (route) => route.Id ?? route.URL);
}

function groupDogRoutesByLocation(routes) {
  const grouped = new Map();

  for (const route of routes) {
    if (!routeIsDogRelevant(route)) continue;

    const locationName = getLocationName(route);
    if (!locationName) continue;

    grouped.set(locationName, [...(grouped.get(locationName) ?? []), route]);
  }

  return grouped;
}

async function buildEnrichedRouteCandidates(locationName, routes) {
  const enrichedRoutes = [];

  for (const route of routes) {
    enrichedRoutes.push(await enrichRoute(route));
  }

  const routePoints = buildCoordinatePoints(enrichedRoutes);
  const parkingPoints = await buildParkingPoints(routePoints);
  const parkingByRoutePointId = new Map();

  for (const parkingPoint of parkingPoints) {
    for (const routePointId of parkingPoint.osm?.routePointIds ?? []) {
      parkingByRoutePointId.set(routePointId, parkingPoint);
    }
  }

  const candidates = [];
  for (const route of enrichedRoutes) {
    const routePointId = `staatsbosbeheer-route-${slugify(route.Id ?? route.URL)}`;
    const candidate = buildRouteCandidate(
      route,
      parkingByRoutePointId.get(routePointId) ?? null,
    );
    candidates.push(await enrichCandidate(candidate));
  }

  const slugCounts = new Map();
  for (const candidate of candidates) {
    slugCounts.set(candidate.slug, (slugCounts.get(candidate.slug) ?? 0) + 1);
  }

  return candidates.map((candidate) => ({
    ...candidate,
    slug:
      slugCounts.get(candidate.slug) > 1
        ? `${candidate.slug}-${candidate.slugIdentity}`
        : candidate.slug,
  }));
}

async function findDuplicate(locations, candidate) {
  const duplicateReasons = [];
  const sourceUrls = [candidate.sourceUrl].filter(Boolean);

  const sourceMatch =
    sourceUrls.length > 0
      ? await locations.findOne(
          {
            $or: [
              { sourceUrl: { $in: sourceUrls } },
              { "relatedUrls.url": { $in: sourceUrls } },
            ],
          },
          { projection: { _id: 1, name: 1, slug: 1, sourceUrl: 1 } },
        )
      : null;

  if (sourceMatch) {
    duplicateReasons.push("source-url");
    return { duplicate: true, reasons: duplicateReasons, match: sourceMatch };
  }

  return { duplicate: false, reasons: [], match: null };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toDuplicateSummary(result) {
  if (!result.duplicate) return null;

  return {
    reasons: result.reasons,
    match: result.match
      ? {
          id: result.match._id?.toString(),
          name: result.match.name,
          slug: result.match.slug,
          sourceUrl: result.match.sourceUrl,
        }
      : null,
  };
}

await loadEnvFile();

const { uri, dbName } = getMongoConfig();
const client = new MongoClient(uri);

try {
  const routes = (await fetchRoutes()).filter((route) =>
    routeMatchesArea(route, AREA_FILTER),
  );
  const groupedRoutes = groupDogRoutesByLocation(routes);

  await client.connect();
  const locations = client.db(dbName).collection("locations");

  const candidates = [];
  const skipped = [];

  for (const [locationName, locationRoutes] of groupedRoutes) {
    console.log(`Enriching routes in: ${locationName}`);
    const routeCandidates = await buildEnrichedRouteCandidates(
      locationName,
      locationRoutes,
    );

    for (const candidate of routeCandidates) {
      const duplicateResult = await findDuplicate(locations, candidate);
      const duplicate = toDuplicateSummary(duplicateResult);

      if (duplicate && !INCLUDE_EXISTING) {
        skipped.push({ ...candidate, duplicate });
      } else {
        candidates.push(
          duplicate
            ? { ...candidate, duplicate }
            : candidate,
        );
      }
    }
  }

  await fs.writeFile(JSON_OUTPUT_PATH, JSON.stringify(candidates, null, 2));
  await fs.writeFile(
    META_OUTPUT_PATH,
    JSON.stringify(
      {
        source: SOURCE,
        scrapedAt: new Date().toISOString(),
        areaFilter: AREA_FILTER,
        maxPages: MAX_PAGES,
        includeExisting: INCLUDE_EXISTING,
        routeRows: routes.length,
        locationCandidates: candidates.length,
        skippedDuplicates: skipped.length,
        duplicateRadiusMeters: DUPLICATE_RADIUS_METERS,
      },
      null,
      2,
    ),
  );

  console.log("Staatsbosbeheer scrape complete");
  console.log(`Database: ${dbName}`);
  console.log(`Routes considered: ${routes.length}`);
  console.log(`Location candidates written: ${candidates.length}`);
  console.log(`Skipped duplicates: ${skipped.length}`);
  console.log(`Output: ${JSON_OUTPUT_PATH}`);
  if (skipped.length > 0) {
    console.log("Skipped duplicate summary:");
    for (const item of skipped) {
      console.log(
        `- ${item.name}: ${item.duplicate.reasons.join(", ")} -> ${item.duplicate.match?.name ?? "unknown"}`,
      );
    }
  }
} finally {
  await client.close();
}
