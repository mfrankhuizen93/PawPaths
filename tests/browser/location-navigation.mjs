// Run against a local Nuxt dev server: node tests/browser/location-navigation.mjs
// All API requests are intercepted; this check never writes application data.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseURL = process.env.PAWPATHS_TEST_URL || "http://127.0.0.1:3107";
const user = {
  id: "editor",
  name: "Editor",
  email: "editor@example.com",
  role: "admin",
  navigationAppPreference: "google",
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
      id: "p1",
      kind: "parking",
      label: "Parking",
      latitude: 52.111111,
      longitude: 4.222222,
    },
    {
      id: "p2",
      kind: "parking",
      label: "Parking",
      latitude: 52.333333,
      longitude: 4.444444,
    },
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
    await page.getByRole("button", { name: "Navigate", exact: true }).click();
    let picker = page.getByRole("dialog", {
      name: "Choose a destination",
      exact: true,
    });
    await picker.waitFor();
    assert.equal(
      await picker
        .getByRole("button", { name: "Open navigation", exact: true })
        .isEnabled(),
      false,
    );
    await picker.getByRole("combobox").click();
    await page.getByRole("option", { name: /2. Parking/ }).click();
    const link = picker.getByRole("link", {
      name: "Open navigation",
      exact: true,
    });
    assert.equal(
      new URL(await link.getAttribute("href")).searchParams.get("destination"),
      "52.333333,4.444444",
    );
    await page.screenshot({ path: `/tmp/pawpaths-28-${width}.png` });
    await page.keyboard.press("Escape");
    await picker.waitFor({ state: "hidden" });
    await page.getByRole("tab", { name: "Links", exact: true }).click();
    await page
      .getByRole("button", { name: "Navigate", exact: true })
      .last()
      .click();
    await picker.waitFor();
    await picker.getByRole("combobox").click();
    await page.getByRole("option", { name: /3. Entrance/ }).click();
    assert.equal(
      new URL(
        await picker
          .getByRole("link", { name: "Open navigation", exact: true })
          .getAttribute("href"),
      ).searchParams.get("destination"),
      "52.001,4.001",
    );
    await page.keyboard.press("Escape");
    await picker.waitFor({ state: "hidden" });
    await page.keyboard.press("Escape");
    location.coordinatePoints = [
      {
        id: "general",
        kind: "general",
        label: "Area",
        latitude: 52,
        longitude: 4,
      },
    ];
    await navigate("/account/reset");
    await navigate(`/?location=${location.slug}`);
    await page.getByRole("button", { name: "Navigate", exact: true }).click();
    await picker.waitFor();
    await picker
      .getByText("No navigation destinations", { exact: true })
      .waitFor();
    assert.equal(await picker.getByRole("link").count(), 0);
    // A single eligible point navigates directly from either entry point.
    for (const kind of ["entrance", "parking"]) {
      location.coordinatePoints = [
        {
          id: "only",
          kind,
          label: "Only destination",
          latitude: 52.765432,
          longitude: 4.123456,
        },
        {
          id: "general",
          kind: "general",
          label: "Area center",
          latitude: 52,
          longitude: 4,
        },
        {
          id: "invalid",
          kind: "entrance",
          label: "Invalid",
          latitude: 100,
          longitude: 4,
        },
      ];
      await navigate("/account/reset");
      await navigate(`/?location=${location.slug}`);
      const directLink = page.getByRole("link", {
        name: "Navigate",
        exact: true,
      });
      assert.equal(
        new URL(await directLink.getAttribute("href")).searchParams.get(
          "destination",
        ),
        "52.765432,4.123456",
      );
      assert.equal(await directLink.getAttribute("target"), "_blank");
      await page
        .context()
        .route("https://www.google.com/maps/dir/**", (route) =>
          route.fulfill({
            contentType: "text/html",
            body: "Navigation destination",
          }),
        );
      const popupPromise = page.waitForEvent("popup");
      await directLink.click();
      const popup = await popupPromise;
      await popup.waitForLoadState();
      assert.equal(
        new URL(popup.url()).searchParams.get("destination"),
        "52.765432,4.123456",
      );
      await popup.close();
      assert.equal(await picker.count(), 0);
      await page.getByRole("tab", { name: "Links", exact: true }).click();
      assert.equal(await directLink.count(), 2);
      assert.equal(
        new URL(await directLink.last().getAttribute("href")).searchParams.get(
          "destination",
        ),
        "52.765432,4.123456",
      );
    }
    location.coordinatePoints = [
      {
        id: "p1",
        kind: "parking",
        label: "Parking",
        latitude: 52.111111,
        longitude: 4.222222,
      },
      {
        id: "p2",
        kind: "parking",
        label: "Parking",
        latitude: 52.333333,
        longitude: 4.444444,
      },
      {
        id: "gate-1",
        kind: "entrance",
        label: "Gate",
        latitude: 52.001,
        longitude: 4.001,
      },
    ];
    assert.deepEqual(errors, []);
    console.log(
      `Navigation selection and missing destination flows passed at ${width}px`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
