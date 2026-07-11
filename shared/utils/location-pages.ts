import type { LocationsResponse } from "#shared/types/locations";

export const DEFAULT_LOCATION_PAGE_SIZE = 100;

export type LocationPageRequest = {
  limit: number;
  pageNumber: number;
  cursor?: string | null;
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
  const firstPage = await fetchPage({
    cursor: null,
    limit: pageSize,
    pageNumber: 1,
  });
  const itemsById = new Map(firstPage.items.map((item) => [item.id, item]));
  let nextCursor = firstPage.nextCursor ?? null;
  const buildResponse = (): LocationsResponse => ({
    ...firstPage,
    items: [...itemsById.values()],
    limit: pageSize,
    nextCursor,
    metadata: {
      pageNumber: pagesLoaded,
      pageSize,
      totalFound: firstPage.total,
      resultCount: itemsById.size,
    },
  });
  let pagesLoaded = 1;

  options.onProgress?.({ response: buildResponse(), pagesLoaded });

  while (
    nextCursor &&
    itemsById.size < firstPage.total &&
    pagesLoaded < maxPages &&
    firstPage.limit > 0
  ) {
    const page = await fetchPage({
      limit: pageSize,
      pageNumber: pagesLoaded + 1,
      cursor: nextCursor,
    });

    if (page.items.length === 0) break;

    for (const item of page.items) {
      itemsById.set(item.id, item);
    }

    nextCursor = page.nextCursor ?? null;
    pagesLoaded += 1;
    options.onProgress?.({ response: buildResponse(), pagesLoaded });
  }

  return buildResponse();
}

export default {
  fetchAllLocationPages,
};
