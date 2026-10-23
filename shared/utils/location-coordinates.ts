export type LocationCoordinates = { latitude: number; longitude: number };

export function isValidLocationCoordinates(value: {
  latitude?: number | null;
  longitude?: number | null;
}): value is LocationCoordinates {
  return (
    typeof value.latitude === "number" &&
    Number.isFinite(value.latitude) &&
    value.latitude >= -90 &&
    value.latitude <= 90 &&
    typeof value.longitude === "number" &&
    Number.isFinite(value.longitude) &&
    value.longitude >= -180 &&
    value.longitude <= 180
  );
}

// Only new placements are rounded. Existing/submitted values retain precision.
export function roundLocationCoordinates(
  value: LocationCoordinates,
): LocationCoordinates | null {
  if (!isValidLocationCoordinates(value)) return null;
  return {
    latitude: Number(value.latitude.toFixed(6)) || 0,
    longitude: Number(value.longitude.toFixed(6)) || 0,
  };
}
