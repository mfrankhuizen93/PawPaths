export type GeocodeResult = {
  id: string;
  label: string;
  fullLabel?: string | null;
  latitude: number;
  longitude: number;
  city?: string | null;
  province?: string | null;
  country?: string | null;
};

export type ReverseGeocodeResult = {
  name: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
};
