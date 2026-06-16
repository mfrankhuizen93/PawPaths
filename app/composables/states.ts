import type { LocationFilters } from "#shared/types/locations";

export const useTextSearch = () => useState<string>("text-search", () => "");
export const useExploreQuery = () =>
  useState<LocationFilters>("explore-search", () => {
    return {
      q: "",
    };
  });
