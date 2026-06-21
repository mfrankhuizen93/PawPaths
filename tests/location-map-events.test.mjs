import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

test("queues visible location searches when the map is moved or zoomed", async () => {
  const component = await fs.readFile("app/components/AppLocation.vue", "utf8");

  assert.match(component, /map\.value\.on\("moveend", queueViewportSearch\)/);
  assert.match(component, /map\.value\.on\("zoomend", queueViewportSearch\)/);
});
