import assert from "node:assert/strict";
import test from "node:test";

import locationPages from "../shared/utils/location-pages.ts";

const { fetchAllLocationPages } = locationPages;

test("fetches every location page until the response total is loaded", async () => {
  const requests = [];
  const response = await fetchAllLocationPages(async ({ cursor, limit, pageNumber }) => {
    requests.push({ cursor, limit, pageNumber });
    const allItems = Array.from({ length: 205 }, (_, index) => ({
      id: String(index),
      slug: `location-${index}`,
      name: `Location ${index}`,
      type: [],
      characteristics: [],
      warnings: [],
      reviewCount: 0,
      ratingCount: 0,
      photos: [],
    }));
    const start = cursor ? Number(cursor) : 0;
    const items = allItems.slice(start, start + limit);

    return {
      items,
      total: allItems.length,
      limit,
      nextCursor:
        start + items.length < allItems.length ? String(start + limit) : null,
    };
  });

  assert.equal(response.items.length, 205);
  assert.deepEqual(response.metadata, {
    pageNumber: 3,
    pageSize: 100,
    totalFound: 205,
    resultCount: 205,
  });
  assert.deepEqual(requests, [
    { cursor: null, limit: 100, pageNumber: 1 },
    { cursor: "100", limit: 100, pageNumber: 2 },
    { cursor: "200", limit: 100, pageNumber: 3 },
  ]);
});

test("stops paging when a response has no cursor", async () => {
  let calls = 0;
  const response = await fetchAllLocationPages(
    async ({ limit }) => {
      calls += 1;

      return {
        items:
          calls === 1
            ? [
                {
                  id: "1",
                  slug: "one",
                  name: "One",
                  type: [],
                  characteristics: [],
                  warnings: [],
                  reviewCount: 0,
                  ratingCount: 0,
                  photos: [],
                },
              ]
            : [],
        total: 10,
        limit,
      };
    },
    { pageSize: 5 },
  );

  assert.equal(response.items.length, 1);
  assert.deepEqual(response.metadata, {
    pageNumber: 1,
    pageSize: 5,
    totalFound: 10,
    resultCount: 1,
  });
  assert.equal(calls, 1);
});

test("reports progress after each loaded location page", async () => {
  const progress = [];
  const allItems = Array.from({ length: 3 }, (_, index) => ({
    id: String(index),
    slug: `location-${index}`,
    name: `Location ${index}`,
    type: [],
    characteristics: [],
    warnings: [],
    reviewCount: 0,
    ratingCount: 0,
    photos: [],
  }));

  const response = await fetchAllLocationPages(
    async ({ cursor, limit }) => {
      const start = cursor ? Number(cursor) : 0;
      const items = allItems.slice(start, start + limit);

      return {
        items,
        total: allItems.length,
        limit,
        nextCursor:
          start + items.length < allItems.length ? String(start + limit) : null,
      };
    },
    {
      pageSize: 2,
      onProgress: ({ response, pagesLoaded }) => {
        progress.push({
          ids: response.items.map((item) => item.id),
          pagesLoaded,
        });
      },
    },
  );

  assert.deepEqual(
    progress.map((item) => item.ids),
    [
      ["0", "1"],
      ["0", "1", "2"],
    ],
  );
  assert.deepEqual(
    progress.map((item) => item.pagesLoaded),
    [1, 2],
  );
  assert.equal(response.items.length, 3);
});

test("keeps fetching past the old fifty page cap", async () => {
  const total = 5105;
  let calls = 0;

  const response = await fetchAllLocationPages(async ({ cursor, limit }) => {
    calls += 1;
    const start = cursor ? Number(cursor) : 0;

    return {
      items: Array.from(
        { length: Math.max(0, Math.min(limit, total - start)) },
        (_, index) => {
          const id = start + index;

          return {
            id: String(id),
            slug: `location-${id}`,
            name: `Location ${id}`,
            type: [],
            characteristics: [],
            warnings: [],
            reviewCount: 0,
            ratingCount: 0,
            photos: [],
          };
        },
      ),
      total,
      limit,
      nextCursor: start + limit < total ? String(start + limit) : null,
    };
  });

  assert.equal(response.items.length, total);
  assert.equal(calls, 52);
});
