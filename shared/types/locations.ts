export type LocationListItem = {
  id: string;
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
  photos: {
    url: string;
    alt?: string | null;
  }[];
  distanceMeters?: number;
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
