import type {
  LocationAreaAttributes,
  LocationCoordinatePoint,
} from "#shared/types/locations";

/** Legacy arrays record positive evidence only; absence never means no. */
export function normalizeAreaAttributes(
  value: unknown,
  characteristics: readonly string[] | null = [],
): LocationAreaAttributes {
  const positives = characteristics ?? [];
  const input =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const state = (key: string, legacy: string) => {
    const explicit = input[key];
    if (explicit === "yes" || explicit === "no" || explicit === "unknown")
      return explicit;
    return positives.includes(legacy) ? "yes" : "unknown";
  };
  const offLeash = input.offLeash;
  return {
    offLeash:
      offLeash === "everywhere" ||
      offLeash === "partial" ||
      offLeash === "not-allowed" ||
      offLeash === "unknown"
        ? offLeash
        : positives.includes("off-leash area")
          ? "partial"
          : "unknown",
    fenced: state("fenced", "fenced"),
    swimming: state("swimming", "swimming water"),
    wheelchairAccessible: state(
      "wheelchairAccessible",
      "wheelchair accessible",
    ),
  };
}

/** Only persisted entrances and parking points are navigation destinations. */
export function getLocationDestinations(
  points: readonly LocationCoordinatePoint[] = [],
) {
  return points.filter(
    (point) =>
      (point.kind === "entrance" || point.kind === "parking") &&
      Number.isFinite(point.latitude) &&
      Math.abs(point.latitude) <= 90 &&
      Number.isFinite(point.longitude) &&
      Math.abs(point.longitude) <= 180,
  );
}
