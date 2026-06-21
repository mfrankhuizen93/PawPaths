import type { LocationsResponse } from "#shared/types/locations";

export const DEFAULT_LOCATION_PAGE_SIZE = 100;
export const DEFAULT_LOCATION_MAX_PAGES = 50;

export type LocationPageRequest = {
  limit: number;
  skip: number;
};

export type FetchLocationPage = (
  request: LocationPageRequest,
) => Promise<LocationsResponse>;

export async function fetchAllLocationPages(
  fetchPage: FetchLocationPage,
  options: {
    pageSize?: number;
    maxPages?: number;
  } = {},
): Promise<LocationsResponse> {
  const pageSize = options.pageSize ?? DEFAULT_LOCATION_PAGE_SIZE;
  const maxPages = options.maxPages ?? DEFAULT_LOCATION_MAX_PAGES;
  const firstPage = await fetchPage({ limit: pageSize, skip: 0 });
  const items = [...firstPage.items];
  let pagesLoaded = 1;

  while (
    items.length < firstPage.total &&
    pagesLoaded < maxPages &&
    firstPage.limit > 0
  ) {
    const page = await fetchPage({
      limit: pageSize,
      skip: items.length,
    });

    if (page.items.length === 0) break;

    items.push(...page.items);
    pagesLoaded += 1;
  }

  return {
    ...firstPage,
    items,
    limit: pageSize,
    skip: 0,
  };
}

export default {
  fetchAllLocationPages,
};
