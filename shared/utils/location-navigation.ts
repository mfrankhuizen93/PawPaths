import type { LocationCoordinatePoint } from "#shared/types/locations";
import { getLocationDestinations } from "#shared/utils/location-contract";

type GeneralLocation = {
  latitude?: number | null;
  longitude?: number | null;
};

/** A selected destination always takes priority over the general-location fallback. */
export function getLocationNavigationUrl(
  points: readonly LocationCoordinatePoint[] = [],
  pointId: string | null,
  app: string = "google",
  appleDevice = false,
  generalLocation?: GeneralLocation,
): string | undefined {
  const destinations = getLocationDestinations(points);
  const point =
    pointId === null && destinations.length === 0
      ? generalLocation
      : destinations.find((item) => item.id === pointId);
  if (
    !point ||
    !Number.isFinite(point.latitude) ||
    Math.abs(point.latitude as number) > 90 ||
    !Number.isFinite(point.longitude) ||
    Math.abs(point.longitude as number) > 180
  )
    return undefined;
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
