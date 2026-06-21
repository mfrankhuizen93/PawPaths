import assert from "node:assert/strict";
import test from "node:test";

import locationPages from "../shared/utils/location-pages.ts";

const { fetchAllLocationPages } = locationPages;

test("fetches every location page until the response total is loaded", async () => {
  const requests = [];
  const response = await fetchAllLocationPages(async ({ limit, skip }) => {
    requests.push({ limit, skip });
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

    return {
      items: allItems.slice(skip, skip + limit),
      total: allItems.length,
      limit,
      skip,
    };
  });

  assert.equal(response.items.length, 205);
  assert.deepEqual(requests, [
    { limit: 100, skip: 0 },
    { limit: 100, skip: 100 },
    { limit: 100, skip: 200 },
  ]);
});

test("stops paging when a response returns no more locations", async () => {
  let calls = 0;
  const response = await fetchAllLocationPages(
    async ({ limit, skip }) => {
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
        skip,
      };
    },
    { pageSize: 5 },
  );

  assert.equal(response.items.length, 1);
  assert.equal(calls, 2);
});
