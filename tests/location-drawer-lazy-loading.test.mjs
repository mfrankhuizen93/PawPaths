import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

test("keeps the location drawer shell eager while lazy-loading heavy drawer content", async () => {
  const page = await fs.readFile("app/pages/index.vue", "utf8");

  assert.match(
    page,
    /import AppDrawer from "~\/components\/drawer\/AppDrawer\.vue";/,
  );
  assert.match(page, /<AppDrawer\b/);
  assert.doesNotMatch(page, /<LazyAppDrawer\b/);

  assert.match(page, /<LazyAppLocationForm\b/);
  assert.match(page, /<LazyLocationAddDrawer\b/);
});
