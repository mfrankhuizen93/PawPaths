import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

test("queues visible location searches when the map is moved or zoomed", async () => {
  const component = await fs.readFile("app/components/AppLocation.vue", "utf8");

  assert.match(component, /map\.value\.on\("moveend", queueViewportSearch\)/);
  assert.match(component, /map\.value\.on\("zoomend", queueViewportSearch\)/);
});

test("fetches visible locations with a single viewport request", async () => {
  const component = await fs.readFile("app/components/AppLocation.vue", "utf8");

  assert.doesNotMatch(component, /fetchAllLocationPages/);
  assert.match(component, /viewport: true/);
  assert.match(component, /fetchedLocations\.value = response\.items/);
});

test("location API keeps pagination for non-map searches", async () => {
  const route = await fs.readFile("server/api/locations.get.ts", "utf8");

  assert.match(route, /name: 1,\s+_id: 1,/);
  assert.match(route, /isViewportSearch \? null : toCursor\(query\.cursor\)/);
  assert.match(route, /isViewportSearch\s+\?\s+Promise\.resolve\(\[\]\)/);
});
