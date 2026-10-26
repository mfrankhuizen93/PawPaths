import type { ReverseGeocodeResult } from "#shared/types/geo";

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

export function formatReverseGeocodeResult(data: {
  name?: unknown;
  display_name?: unknown;
  namedetails?: Record<string, unknown>;
  class?: unknown;
  category?: unknown;
  type?: unknown;
  address?: Record<string, unknown>;
}): ReverseGeocodeResult {
  const address = data.address ?? {};
  const city = toText(pickCity(address));
  const street = [pickStreetName(address), toText(address.house_number)]
    .filter(Boolean)
    .join(" ");
  const locality = [toText(address.postcode), city].filter(Boolean).join(" ");
  return {
    name: pickAreaName(data, address),
    address: [street, locality].filter(Boolean).join(", ") || null,
    city,
    province: toText(address.state) || toText(address.province),
    country: toText(address.country),
  };
}
