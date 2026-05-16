import type { LocationFilters } from "#shared/types/locations";

export const useTextSearch = () => useState<string>("explore-search", () => "");
export const useExploreQuery = () =>
  useState<LocationFilters>("explore-search", () => {
    return {
      q: "",
    };
  });
