export type LocationResult = {
  locations: LocationListItem[];
  total: number;
};

export type LocationPhoto = {
  url: string;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
};

export type LocationListItem = {
  id: string;
  slug: string;
  sourceUrl?: string | null;
  name: string;
  city?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  type: string[];
  characteristics: string[];
  warnings: string[];
  reviewCount: number;
  ratingCount: number;
  averageRating?: number | null;
  photos: LocationPhoto[];
  distanceMeters?: number;
};

export type LocationRelatedUrl = {
  label: string;
  url: string;
};

export type LocationReview = {
  reviewer?: string | null;
  date?: string | null;
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
