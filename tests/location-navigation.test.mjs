import assert from "node:assert/strict";
import Module from "node:module";
import test from "node:test";

const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveNuxtAliases(
  request,
  parent,
  isMain,
  options,
) {
  if (request.startsWith("#shared/")) {
    return originalResolveFilename.call(
      this,
      `${process.cwd()}/${request.replace("#shared/", "shared/")}.ts`,
      parent,
      isMain,
      options,
    );
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const { default: navigation } =
  await import("../shared/utils/location-navigation.ts");
const {
  getLocationNavigationUrl: url,
  getNavigationDestinationOptions: options,
} = navigation;
const point = {
  id: "gate",
  kind: "entrance",
  label: "Gate",
  latitude: 52.123456,
  longitude: 4.654321,
};

test("selected persisted coordinates are used by every navigation app", () => {
  const parking = {
    ...point,
    id: "parking",
    kind: "parking",
    latitude: -34.123456,
    longitude: 18.654321,
  };
  for (const selected of [point, parking]) {
    for (const app of ["google", "apple", "waze", "device", "unsupported"]) {
      const link = new URL(url([point, parking], selected.id, app));
      assert.equal(
        link.searchParams.get(
          app === "apple" ? "daddr" : app === "waze" ? "ll" : "destination",
        ),
        `${selected.latitude},${selected.longitude}`,
      );
      assert.equal(link.protocol, "https:");
    }
  }
  assert.equal(
    new URL(url([point], point.id, "device", true)).hostname,
    "maps.apple.com",
  );
  assert.equal(
    new URL(url([point], point.id, "unsupported")).hostname,
    "www.google.com",
  );
});

test("missing, stale, ambiguous and invalid destinations cannot generate URLs", () => {
  assert.equal(url(undefined, "gate"), undefined);
  assert.equal(url([point], null), undefined);
  assert.equal(url([point], "stale"), undefined);
  assert.equal(url([{ ...point, kind: "general" }], "gate"), undefined);
  assert.equal(url([point, point], "gate"), undefined);
  for (const invalid of [null, undefined, NaN, Infinity, "52", 91, -91])
    assert.equal(url([{ ...point, latitude: invalid }], "gate"), undefined);
  for (const invalid of [null, undefined, NaN, Infinity, "4", 181, -181])
    assert.equal(url([{ ...point, longitude: invalid }], "gate"), undefined);
  for (const id of [undefined, "", " "])
    assert.deepEqual(options([{ ...point, id }]), []);
  assert.ok(url([{ ...point, latitude: 0, longitude: 0 }], "gate"));
  assert.ok(url([{ ...point, latitude: -90, longitude: 180 }], "gate"));
});

test("repeated parking labels remain distinct and unrelated kinds are excluded", () => {
  const points = [
    point,
    { ...point, kind: "parking", id: "p1" },
    { ...point, kind: "parking", id: "p2" },
    { ...point, kind: "water", id: "water" },
  ];
  const items = options(points);
  assert.deepEqual(
    items.map((item) => item.value),
    ["gate", "p1", "p2"],
  );
  assert.equal(new Set(items.map((item) => item.label)).size, 3);
  assert.match(items[0].label, /Entrance.*Gate/);
  assert.match(items[1].label, /Parking.*Gate/);
  assert.match(options([{ ...point, label: " " }])[0].label, /Entrance/);
  assert.deepEqual(options([{ ...point, kind: "general" }]), []);
  assert.deepEqual(options(), []);
});

test("general location is a validated fallback only when no entrance or parking is usable", () => {
  const general = { latitude: 51.123456, longitude: -2.654321 };
  for (const app of ["google", "apple", "waze", "device"]) {
    const link = new URL(url([], null, app, false, general));
    assert.equal(
      link.searchParams.get(
        app === "apple" ? "daddr" : app === "waze" ? "ll" : "destination",
      ),
      "51.123456,-2.654321",
    );
  }
  assert.ok(url([{ ...point, latitude: 100 }], null, "google", false, general));
  for (const kind of ["entrance", "parking"]) {
    const points = [{ ...point, kind }];
    assert.equal(url(points, null, "google", false, general), undefined);
    assert.equal(
      new URL(url(points, point.id, "google", false, general)).searchParams.get(
        "destination",
      ),
      "52.123456,4.654321",
    );
  }
  assert.equal(url([], "stale", "google", false, general), undefined);
  for (const invalid of [
    undefined,
    {},
    { latitude: null, longitude: 4 },
    { latitude: 52, longitude: null },
    { latitude: 91, longitude: 4 },
    { latitude: 52, longitude: -181 },
    { latitude: NaN, longitude: Infinity },
    { latitude: "52", longitude: "4" },
  ]) {
    assert.equal(url([], null, "google", false, invalid), undefined);
  }
  assert.ok(url([], null, "google", false, { latitude: 0, longitude: 0 }));
});
