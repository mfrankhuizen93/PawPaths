import { defineEventHandler, getQuery } from "h3";
import { formatReverseGeocodeResult } from "../../utils/reverse-geocode";

function toCoordinate(value: unknown, min: number, max: number) {
  const number = Number(value);

  return Number.isFinite(number) && number >= min && number <= max
    ? number
    : null;
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const latitude = toCoordinate(query.lat, -90, 90);
  const longitude = toCoordinate(query.lng, -180, 180);

  if (latitude === null || longitude === null) {
    return {
      name: null,
      address: null,
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
    signal: AbortSignal.timeout(5000),
    headers: {
      Accept: "application/json",
      "User-Agent": "PawPaths/1.0 (https://pawpaths.nl)",
    },
  }).catch(() => null);

  if (!response?.ok) {
    return {
      name: null,
      address: null,
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
  return formatReverseGeocodeResult(data);
});
