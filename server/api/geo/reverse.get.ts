import { defineEventHandler, getQuery } from "h3";

function toCoordinate(value: unknown, min: number, max: number) {
  const number = Number(value);

  return Number.isFinite(number) && number >= min && number <= max
    ? number
    : null;
}

function pickCity(address: Record<string, unknown>) {
  return (
    address.city ||
    address.town ||
    address.village ||
    address.hamlet ||
    address.municipality ||
    ""
  );
}

function toText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function pickNamedDetail(namedetails: Record<string, unknown>) {
  return (
    toText(namedetails.name) ||
    toText(namedetails["name:en"]) ||
    toText(namedetails["name:nl"]) ||
    null
  );
}

function firstDisplayNamePart(value: unknown) {
  return toText(value)
    ?.split(",")
    .map((part) => part.trim())
    .find(Boolean);
}

function isNamedAreaClass(value: string | null) {
  return (
    value !== null &&
    [
      "leisure",
      "natural",
      "tourism",
      "amenity",
      "boundary",
      "landuse",
    ].includes(value)
  );
}

function isNamedAreaType(value: string | null) {
  return (
    value !== null &&
    [
      "park",
      "dog_park",
      "recreation_ground",
      "nature_reserve",
      "forest",
      "wood",
      "common",
      "grass",
      "garden",
      "playground",
      "beach_resort",
      "protected_area",
    ].includes(value)
  );
}

function pickStreetName(address: Record<string, unknown>) {
  return (
    toText(address.road) ||
    toText(address.pedestrian) ||
    toText(address.footway) ||
    toText(address.cycleway) ||
    toText(address.path) ||
    null
  );
}

function pickAreaName(
  data: {
    name?: unknown;
    display_name?: unknown;
    namedetails?: Record<string, unknown>;
    class?: unknown;
    category?: unknown;
    type?: unknown;
  },
  address: Record<string, unknown>,
) {
  const category = toText(data.category) || toText(data.class);
  const type = toText(data.type);
  const namedFeature =
    isNamedAreaClass(category) || isNamedAreaType(type)
      ? toText(data.name) ||
        (data.namedetails ? pickNamedDetail(data.namedetails) : null)
      : null;
  const displayName =
    isNamedAreaClass(category) || isNamedAreaType(type)
      ? firstDisplayNamePart(data.display_name)
      : null;

  return (
    namedFeature ||
    toText(address.park) ||
    toText(address.recreation_ground) ||
    toText(address.nature_reserve) ||
    toText(address.forest) ||
    toText(address.wood) ||
    toText(address.common) ||
    toText(address.leisure) ||
    toText(address.tourism) ||
    toText(address.amenity) ||
    displayName ||
    pickStreetName(address) ||
    null
  );
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const latitude = toCoordinate(query.lat, -90, 90);
  const longitude = toCoordinate(query.lng, -180, 180);

  if (latitude === null || longitude === null) {
    return {
      name: null,
      city: null,
      province: null,
      country: null,
    };
  }

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("zoom", "16");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("namedetails", "1");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "PawPaths/1.0 (https://pawpaths.nl)",
    },
  }).catch(() => null);

  if (!response?.ok) {
    return {
      name: null,
      city: null,
      province: null,
      country: null,
    };
  }

  const data = (await response.json()) as {
    name?: unknown;
    display_name?: unknown;
    namedetails?: Record<string, unknown>;
    class?: unknown;
    category?: unknown;
    type?: unknown;
    address?: Record<string, unknown>;
  };
  const address = data.address ?? {};

  return {
    name: pickAreaName(data, address),
    city: toText(pickCity(address)),
    province: toText(address.state) || toText(address.province),
    country: toText(address.country),
  };
});
