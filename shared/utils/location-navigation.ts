import type { LocationCoordinatePoint } from "#shared/types/locations";
import { getLocationDestinations } from "#shared/utils/location-contract";

/** Resolve the ID against current data on every use; never use an area center. */
export function getLocationNavigationUrl(
  points: readonly LocationCoordinatePoint[] = [],
  pointId: string | null,
  app: string = "google",
  appleDevice = false,
): string | undefined {
  const point = getLocationDestinations(points).find(
    (item) => item.id === pointId,
  );
  if (!point) return undefined;
  const coordinates = encodeURIComponent(
    `${point.latitude},${point.longitude}`,
  );
  if (app === "apple" || (app === "device" && appleDevice)) {
    return `https://maps.apple.com/?daddr=${coordinates}`;
  }
  if (app === "waze") {
    return `https://waze.com/ul?ll=${coordinates}&navigate=yes`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${coordinates}`;
}

export function getNavigationDestinationOptions(
  points: readonly LocationCoordinatePoint[] = [],
) {
  return getLocationDestinations(points).map((point, index) => ({
    value: point.id,
    label: `${index + 1}. ${point.kind === "parking" ? "Parking" : "Entrance"}${point.label?.trim() ? ` — ${point.label.trim()}` : ""} (${point.latitude}, ${point.longitude})`,
  }));
}
