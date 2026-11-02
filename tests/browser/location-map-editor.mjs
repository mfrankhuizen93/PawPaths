// Run against a local Nuxt dev server: node tests/browser/location-map-editor.mjs
// All API requests are intercepted; this check never writes application data.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseURL = process.env.PAWPATHS_TEST_URL || "http://127.0.0.1:3107";
const user = {
  id: "editor",
  name: "Editor",
  email: "editor@example.com",
  role: "admin",
  emailVerified: true,
};
const location = {
  id: "area-1",
  slug: "fixture-park",
  name: "Fixture park",
  city: "Amsterdam",
  country: "Netherlands",
  latitude: 52,
  longitude: 4,
  type: ["park"],
  characteristics: [],
  description: "A park.",
  coordinatePoints: [
    {
      id: "gate-1",
      kind: "entrance",
      label: "Gate",
      latitude: 52.001,
      longitude: 4.001,
    },
  ],
  photos: [],
  relatedUrls: [],
  reviews: [],
  warnings: [],
  reviewCount: 0,
  ratingCount: 0,
};
const submission = {
  id: "proposal-1",
  kind: "location-change",
  status: "pending",
  locationId: location.id,
  payload: location,
  submitter: {
    id: "contributor",
    name: "Contributor",
    email: "contributor@example.com",
  },
  createdAt: "2026-10-26T10:00:00Z",
  updatedAt: "2026-10-26T10:00:00Z",
};
const browser = await chromium.launch({ headless: true });
try {
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (route.request().method() !== "GET")
        throw new Error(`Unexpected write: ${path}`);
      let json;
      if (path === "/api/auth/profile") json = { user };
      else if (path === "/api/auth/get-session") json = { user, session: {} };
      else if (path === "/api/contributions")
        json = { contributions: [submission] };
      else if (path === `/api/locations/${location.slug}`) json = location;
      else if (path === "/api/locations")
        json = {
          items: [location],
          total: 1,
          limit: 20,
          nextCursor: null,
          metadata: {},
        };
      else if (path === "/api/geo/reverse")
        json = { city: "Amsterdam", country: "Netherlands" };
      else json = {};
      await route.fulfill({ json });
    });
    await page.route("https://demotiles.maplibre.org/**", (route) =>
      route.fulfill({
        json: {
          version: 8,
          sources: {},
          layers: [
            {
              id: "background",
              type: "background",
              paint: { "background-color": "#e8eee8" },
            },
          ],
        },
      }),
    );
    // Start on a lightweight route, then navigate on the client so API fixtures
    // also cover the real page fetches and maintainer middleware.
    await page.goto(`${baseURL}/account/reset`);
    await page.waitForFunction(
      () =>
        document.querySelector("#__nuxt")?.__vue_app__?.config.globalProperties
          .$nuxt?.isHydrating === false,
    );
    async function navigate(path) {
      await page.evaluate(
        async ({ user, path }) => {
          const app =
            document.querySelector("#__nuxt").__vue_app__.config
              .globalProperties.$nuxt;
          app.payload.state["$sauth:user"] = user;
          app.payload.state["$sauth:is-loaded"] = true;
          await app.$router.push(path);
        },
        { user, path },
      );
    }
    await navigate(`/?location=${location.slug}`);
    await page
      .getByRole("button", { name: "Location actions", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
    await page.getByRole("tab", { name: "Map", exact: true }).click();
    async function checkEditor() {
      const editMap = page.getByRole("button", {
        name: "Edit map",
        exact: true,
      });
      await editMap.waitFor();
      assert.equal(
        await editMap.isEnabled(),
        true,
        "Edit map must be enabled in an editable drawer",
      );
      await editMap.click();
      const editor = page.getByRole("dialog", {
        name: "Edit map points",
        exact: true,
      });
      await editor.waitFor();
      await editor.getByRole("button", { name: "Gate", exact: true }).click();
      await editor
        .getByRole("button", { name: "Replace position", exact: true })
        .click();
      await editor
        .getByRole("button", { name: "Cancel placement", exact: true })
        .click();
      await page.keyboard.press("Escape");
      await editor.waitFor({ state: "hidden" });
    }
    await checkEditor();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await navigate("/admin/submissions");
    await page.getByRole("button", { name: /Fixture park/ }).click();
    await page.getByRole("tab", { name: "Map", exact: true }).click();
    await checkEditor();
    assert.deepEqual(errors, []);
    console.log(`Location and moderation Edit map flows passed at ${width}px`);
    await page.close();
  }
} finally {
  await browser.close();
}
