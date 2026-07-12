import type { LocationCoordinateKind } from "../types/locations";

export type LocationPointType = Exclude<LocationCoordinateKind, "general">;

export type LocationPointTypeConfig = {
  label: string;
  icon: string;
  color: string;
  textColor: string;
};

export const locationPointTypeConfig = {
  entrance: {
    label: "Entrance",
    icon: "i-lucide-door-open",
    color: "#7c3aed",
    textColor: "#ffffff",
  },
  parking: {
    label: "Parking",
    icon: "i-lucide-car-front",
    color: "#2563eb",
    textColor: "#ffffff",
  },
  poi: {
    label: "POI",
    icon: "i-lucide-map-pin",
    color: "#c2410c",
    textColor: "#ffffff",
  },
  water: {
    label: "Water",
    icon: "i-lucide-droplets",
    color: "#0891b2",
    textColor: "#ffffff",
  },
  swimming: {
    label: "Swimming",
    icon: "i-lucide-waves",
    color: "#0284c7",
    textColor: "#ffffff",
  },
  "dog-playground": {
    label: "Dog Playground",
    icon: "i-lucide-dog",
    color: "#16a34a",
    textColor: "#ffffff",
  },
  "off-leash-area": {
    label: "Off-Leash Area",
    icon: "i-lucide-route",
    color: "#65a30d",
    textColor: "#ffffff",
  },
  bench: {
    label: "Bench",
    icon: "i-lucide-armchair",
    color: "#ca8a04",
    textColor: "#111827",
  },
  toilet: {
    label: "Toilet",
    icon: "i-lucide-toilet",
    color: "#0f766e",
    textColor: "#ffffff",
  },
  cafe: {
    label: "Cafe",
    icon: "i-lucide-coffee",
    color: "#a16207",
    textColor: "#ffffff",
  },
  viewpoint: {
    label: "Viewpoint",
    icon: "i-lucide-binoculars",
    color: "#9333ea",
    textColor: "#ffffff",
  },
  shade: {
    label: "Shade",
    icon: "i-lucide-tree-pine",
    color: "#15803d",
    textColor: "#ffffff",
  },
  "waste-bin": {
    label: "Waste Bin",
    icon: "i-lucide-trash-2",
    color: "#475569",
    textColor: "#ffffff",
  },
  "rest-area": {
    label: "Rest Area",
    icon: "i-lucide-sofa",
    color: "#0d9488",
    textColor: "#ffffff",
  },
  hazard: {
    label: "Hazard",
    icon: "i-lucide-triangle-alert",
    color: "#dc2626",
    textColor: "#ffffff",
  },
  livestock: {
    label: "Livestock",
    icon: "i-lucide-fence",
    color: "#854d0e",
    textColor: "#ffffff",
  },
  "photo-spot": {
    label: "Photo Spot",
    icon: "i-lucide-camera",
    color: "#db2777",
    textColor: "#ffffff",
  },
  other: {
    label: "Other",
    icon: "i-lucide-circle-dot",
    color: "#64748b",
    textColor: "#ffffff",
  },
} satisfies Record<LocationPointType, LocationPointTypeConfig>;

export const locationPointTypeOptions = Object.entries(
  locationPointTypeConfig,
).map(([value, config]) => ({
  value: value as LocationPointType,
  ...config,
}));

export function getLocationPointTypeConfig(
  value: LocationCoordinateKind | string,
) {
  return (
    locationPointTypeConfig[value as LocationPointType] ??
    locationPointTypeConfig.other
  );
}

export function isLocationPointNameRequired(value: LocationCoordinateKind | string) {
  return value === "poi" || value === "other";
}

export function getLocationPointDefaultLabel(
  value: LocationCoordinateKind | string,
) {
  return getLocationPointTypeConfig(value).label;
}

export function getLocationPointDisplayLabel(point: {
  kind: LocationCoordinateKind | string;
  label?: string | null;
}) {
  return point.label?.trim() || getLocationPointDefaultLabel(point.kind);
}

export function getLocationPointCustomLabel(point: {
  kind: LocationCoordinateKind | string;
  label?: string | null;
}) {
  const label = point.label?.trim() ?? "";
  const defaultLabel = getLocationPointDefaultLabel(point.kind);

  return label && label !== defaultLabel ? label : "";
}
