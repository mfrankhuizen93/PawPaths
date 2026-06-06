import { defineEventHandler, getQuery } from "h3";
import type { GeocodeResult } from "#shared/types/geo";

function toSearchQuery(value: unknown) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  return typeof rawValue === "string" ? rawValue.trim() : "";
}

function toCoordinate(value: unknown, min: number, max: number) {
  const number = Number(value);

  return Number.isFinite(number) && number >= min && number <= max
    ? number
    : null;
}

function toText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
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

function joinParts(parts: (string | null)[]) {
  return parts.filter(Boolean).join(", ");
}

function pickRoad(address: Record<string, unknown>) {
  return (
    address.road ||
    address.pedestrian ||
    address.footway ||
    address.cycleway ||
    address.path ||
    address.neighbourhood ||
    ""
  );
}

function formatCompactLabel(
  address: Record<string, unknown>,
  fallbackLabel: string,
) {
  const road = toText(pickRoad(address));
  const houseNumber = toText(address.house_number);
  const city = toText(pickCity(address));
  const country = toText(address.country);
  const streetAddress = joinParts([
    [road, houseNumber].filter(Boolean).join(" ") || null,
    city,
    country,
  ]);

  if (streetAddress) return streetAddress;

  return fallbackLabel
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part, index, parts) => parts.indexOf(part) === index)
    .slice(0, 3)
    .join(", ");
}

export default defineEventHandler(async (event): Promise<GeocodeResult[]> => {
  const query = getQuery(event);
  const searchQuery = toSearchQuery(query.q);

  if (searchQuery.length < 3) return [];

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", searchQuery);
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "nl");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "en",
      "User-Agent": "PawPaths/1.0 (https://pawpaths.nl)",
    },
  }).catch(() => null);

  if (!response?.ok) return [];

  const results = (await response.json()) as {
    place_id?: number | string;
    display_name?: string;
    lat?: string;
    lon?: string;
    address?: Record<string, unknown>;
  }[];

  return results.flatMap((result) => {
    const latitude = toCoordinate(result.lat, -90, 90);
    const longitude = toCoordinate(result.lon, -180, 180);
    const label = toText(result.display_name);

    if (latitude === null || longitude === null || !label) return [];

    const address = result.address ?? {};

    return {
      id: String(result.place_id ?? `${latitude},${longitude}`),
      label: formatCompactLabel(address, label),
      fullLabel: label,
      latitude,
      longitude,
      city: toText(pickCity(address)),
      province: toText(address.state) || toText(address.province),
      country: toText(address.country),
    };
  });
});
