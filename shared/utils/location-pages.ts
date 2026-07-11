import type { LocationsResponse } from "#shared/types/locations";

export const DEFAULT_LOCATION_PAGE_SIZE = 100;

export type LocationPageRequest = {
  limit: number;
  skip: number;
};

export type FetchLocationPage = (
  request: LocationPageRequest,
) => Promise<LocationsResponse>;

export type LocationPagesProgress = {
  response: LocationsResponse;
  pagesLoaded: number;
};

export async function fetchAllLocationPages(
  fetchPage: FetchLocationPage,
  options: {
    pageSize?: number;
    maxPages?: number | null;
    onProgress?: (progress: LocationPagesProgress) => void;
  } = {},
): Promise<LocationsResponse> {
  const pageSize = options.pageSize ?? DEFAULT_LOCATION_PAGE_SIZE;
  const maxPages = options.maxPages ?? Number.POSITIVE_INFINITY;
  const firstPage = await fetchPage({ limit: pageSize, skip: 0 });
  const itemsById = new Map(firstPage.items.map((item) => [item.id, item]));
  const buildResponse = (): LocationsResponse => ({
    ...firstPage,
    items: [...itemsById.values()],
    limit: pageSize,
    skip: 0,
  });
  let pagesLoaded = 1;

  options.onProgress?.({ response: buildResponse(), pagesLoaded });

  while (
    itemsById.size < firstPage.total &&
    pagesLoaded < maxPages &&
    firstPage.limit > 0
  ) {
    const page = await fetchPage({
      limit: pageSize,
      skip: pagesLoaded * pageSize,
    });

    if (page.items.length === 0) break;

    for (const item of page.items) {
      itemsById.set(item.id, item);
    }

    pagesLoaded += 1;
    options.onProgress?.({ response: buildResponse(), pagesLoaded });
  }

  return buildResponse();
}

export default {
  fetchAllLocationPages,
};
