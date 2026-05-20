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

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const latitude = toCoordinate(query.lat, -90, 90);
  const longitude = toCoordinate(query.lng, -180, 180);

  if (latitude === null || longitude === null) {
    return {
      city: null,
      province: null,
      country: null,
    };
  }

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("zoom", "10");
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "PawPaths/1.0 (https://pawpaths.nl)",
    },
  }).catch(() => null);

  if (!response?.ok) {
    return {
      city: null,
      province: null,
      country: null,
    };
  }

  const data = (await response.json()) as {
    address?: Record<string, unknown>;
  };
  const address = data.address ?? {};

  return {
    city: toText(pickCity(address)),
    province: toText(address.state) || toText(address.province),
    country: toText(address.country),
  };
});
