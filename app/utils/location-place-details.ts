import { $fetch } from "ofetch";
import type { ReverseGeocodeResult } from "#shared/types/geo";
import type { LocationCoordinates } from "#shared/utils/location-coordinates";

// Both copies of the point list and the confirmation share each lookup. Space
// requests out when an existing area has several points, rather than bursting.
export function createPlaceDetailsLookup(
  fetchDetails: (
    position: LocationCoordinates,
  ) => Promise<ReverseGeocodeResult>,
  intervalMs = 1000,
) {
  const cache = new Map<
    string,
    { expires: number; result: Promise<ReverseGeocodeResult> }
  >();
  let queue = Promise.resolve();
  let lastStarted = 0;

  return (position: LocationCoordinates) => {
    const key = `${position.latitude},${position.longitude}`;
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.result;
    const pair = { latitude: position.latitude, longitude: position.longitude };
    const result = queue.then(async () => {
      const wait = intervalMs - (Date.now() - lastStarted);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      lastStarted = Date.now();
      return fetchDetails(pair);
    });
    queue = result.then(
      () => {},
      () => {},
    );
    cache.set(key, { expires: Date.now() + 5 * 60_000, result });
    // A failed lookup must not poison future retries.
    void result.catch(() => cache.delete(key));
    if (cache.size > 100) cache.delete(cache.keys().next().value!);
    return result;
  };
}

export const getLocationPlaceDetails = createPlaceDetailsLookup((position) =>
  $fetch<ReverseGeocodeResult>("/api/geo/reverse", {
    query: { lat: position.latitude, lng: position.longitude },
    timeout: 6000,
    retry: 0,
  }),
);
