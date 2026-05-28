export type LocationResult = {
  locations: LocationListItem[];
  total: number;
};

export type LocationPhoto = {
  id?: string | null;
  url: string;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
  capturedAt?: string | null;
  uploadedAt?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  sourceName?: string | null;
};

export const locationCoordinateKindOptions = [
  { label: "General location", value: "general" },
  { label: "Entrance", value: "entrance" },
  { label: "Parking", value: "parking" },
  { label: "POI", value: "poi" },
  { label: "Water", value: "water" },
  { label: "Swimming", value: "swimming" },
  { label: "Dog Playground", value: "dog-playground" },
  { label: "Off-Leash Area", value: "off-leash-area" },
  { label: "Bench", value: "bench" },
  { label: "Toilet", value: "toilet" },
  { label: "Café", value: "cafe" },
  { label: "Viewpoint", value: "viewpoint" },
  { label: "Shade", value: "shade" },
  { label: "Waste Bin", value: "waste-bin" },
  { label: "Rest Area", value: "rest-area" },
  { label: "Hazard", value: "hazard" },
  { label: "Livestock", value: "livestock" },
  { label: "Photo Spot", value: "photo-spot" },
  { label: "Other", value: "other" },
] as const;

export type LocationCoordinateKind =
  (typeof locationCoordinateKindOptions)[number]["value"];

export type LocationCoordinatePoint = {
  id?: string | null;
  kind: LocationCoordinateKind;
  label: string;
  latitude: number;
  longitude: number;
  sourcePhotoId?: string | null;
};

export type LocationListItem = {
  id: string;
  slug: string;
  sourceUrl?: string | null;
  name: string;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  type: string[];
  characteristics: string[];
  coordinatePoints?: LocationCoordinatePoint[];
  warnings: string[];
  reviewCount: number;
  ratingCount: number;
  averageRating?: number | null;
  description?: string | null;
  relatedUrls?: LocationRelatedUrl[];
  reviews?: LocationReview[];
  photos: LocationPhoto[];
  distanceMeters?: number;
};

export type LocationRelatedUrl = {
  label: string;
  url: string;
};

export type LocationReview = {
  reviewer?: string | null;
  reviewerName?: string | null;
  date?: string | null;
  dateText?: string | null;
  rating?: number | null;
  text?: string | null;
};

export type LocationDetail = LocationListItem & {
  province?: string | null;
  description?: string | null;
  relatedUrls?: LocationRelatedUrl[];
  reviews?: LocationReview[];
  sourceUrl?: string | null;
};

export type LocationsResponse = {
  items: LocationListItem[];
  total: number;
  limit: number;
  skip: number;
};

export type LocationFilters = {
  q?: string;
  minRating?: number;
  type?: string[];
  excludeType?: string[];
  characteristic?: string[];
  excludeCharacteristic?: string[];
};

export type EditableLocationFields = {
  name: string;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  type: string[];
  characteristics: string[];
  description?: string;
  relatedUrls?: LocationRelatedUrl[];
  photos?: LocationPhoto[];
  coordinatePoints?: LocationCoordinatePoint[];
};

export type LocationContributionKind = "new-location" | "location-change";
export type LocationContributionStatus = "pending" | "approved" | "rejected";

export type LocationContribution = {
  id?: string;
  kind: LocationContributionKind;
  status: LocationContributionStatus;
  locationId?: string | null;
  locationSlug?: string | null;
  locationName?: string | null;
  payload: EditableLocationFields;
  submitter: {
    id: string;
    name: string;
    email: string;
  };
  reviewer?: {
    id: string;
    name: string;
    email: string;
  } | null;
  reviewNote?: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string | null;
};
