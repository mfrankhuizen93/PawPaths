import type { LocationFilters } from "../types/locations";

export const searchTypes = [
  "beach",
  "dog playground",
  "nature reserve",
  "park",
];
export const searchFacilities = [
  "cafe",
  "toilet",
  "bench",
  "waste-bin",
  "shade",
  "rest-area",
];
export const searchHazards = [
  "hazard",
  "livestock",
  "cyclists nearby",
  "livestock nearby",
  "muddy after rain",
  "traffic nearby",
  "horse trails",
  "mountain bike trails",
];
export const searchCharacteristics = [
  "off-leash area",
  "fenced",
  "food and drink",
  "horse trails",
  "mountain bike trails",
  "swimming water",
  "walking trails",
  "wheelchair accessible",
];
export type SearchBounds = {
  west: number;
  south: number;
  east: number;
  north: number;
};
export const searchQueryKeys = [
  "q",
  "minRating",
  "type",
  "excludeType",
  "characteristic",
  "excludeCharacteristic",
  "offLeash",
  "fenced",
  "swimming",
  "wheelchairAccessible",
  "parking",
  "facility",
  "hazard",
  "lat",
  "lng",
  "radiusKm",
  "mode",
  "west",
  "south",
  "east",
  "north",
];

export function readLocationSearch(query: Record<string, unknown>) {
  const first = (key: string) =>
    Array.isArray(query[key]) ? query[key][0] : query[key];
  const number = (key: string, min: number, max: number) => {
    const raw = first(key);
    if (raw === null || raw === undefined || raw === "") return undefined;
    const value = Number(raw);
    return Number.isFinite(value) && value >= min && value <= max
      ? value
      : undefined;
  };
  const filters: LocationFilters = {};
  const q = first("q");
  if (typeof q === "string" && q.trim()) filters.q = q.trim().slice(0, 200);
  const minRating = number("minRating", 1, 5);
  if (minRating !== undefined) filters.minRating = minRating;
  for (const [key, allowed] of Object.entries({
    type: searchTypes,
    excludeType: searchTypes,
    characteristic: searchCharacteristics,
    excludeCharacteristic: searchCharacteristics,
    facility: searchFacilities,
    hazard: searchHazards,
  })) {
    const raw = query[key];
    const values = [
      ...new Set(
        (Array.isArray(raw) ? raw : [raw])
          .flatMap((value) =>
            typeof value === "string" ? value.split(",") : [],
          )
          .filter((value) => allowed.includes(value)),
      ),
    ];
    if (values.length) Object.assign(filters, { [key]: values });
  }
  for (const key of ["fenced", "swimming", "wheelchairAccessible"] as const) {
    const value = first(key);
    if (value === "yes" || value === "no" || value === "unknown")
      filters[key] = value;
  }
  const offLeash = first("offLeash");
  if (
    offLeash === "everywhere" ||
    offLeash === "partial" ||
    offLeash === "not-allowed" ||
    offLeash === "unknown"
  )
    filters.offLeash = offLeash;
  if (first("parking") === "yes") filters.parking = "yes";
  const lat = number("lat", -90, 90),
    lng = number("lng", -180, 180),
    radiusKm = number("radiusKm", 0.1, 500);
  if (lat !== undefined && lng !== undefined && radiusKm !== undefined)
    Object.assign(filters, { lat, lng, radiusKm });
  const west = number("west", -180, 180),
    east = number("east", -180, 180),
    south = number("south", -90, 90),
    north = number("north", -90, 90);
  const bounds: SearchBounds | undefined =
    west !== undefined &&
    east !== undefined &&
    south !== undefined &&
    north !== undefined &&
    south < north &&
    west !== east
      ? { west, east, south, north }
      : undefined;
  return {
    filters,
    bounds,
    mode: first("mode") === "list" ? ("list" as const) : ("map" as const),
  };
}

export function writeLocationSearch(
  state: ReturnType<typeof readLocationSearch>,
  existing: Record<string, unknown> = {},
) {
  const query: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(existing)) {
    if (
      !searchQueryKeys.includes(key) &&
      (typeof value === "string" ||
        (Array.isArray(value) &&
          value.every((item) => typeof item === "string")))
    )
      query[key] = value;
  }
  for (const [key, value] of Object.entries({
    ...state.filters,
    ...state.bounds,
    mode: state.mode,
  })) {
    if (value !== undefined)
      query[key] = Array.isArray(value) ? value : String(value);
  }
  return query;
}
