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

const { default: editableLocationFields } =
  await import("../shared/utils/editable-location-fields.ts");
const { normalizeEditableLocationFields } = editableLocationFields;
const { default: locationContract } =
  await import("../shared/utils/location-contract.ts");
const { normalizeAreaAttributes, getLocationDestinations } = locationContract;
const { migratePointIds } =
  await import("../scripts/lib/location-point-migration.js");

test("normalizes editable location fields before dirty comparison", () => {
  const payload = {
    name: "Loop Park",
    city: null,
    type: ["park"],
    characteristics: ["walking trails"],
    relatedUrls: [{ label: "Website", url: "https://example.com" }],
    photos: [{ url: "https://example.com/photo.jpg", alt: "Loop" }],
    coordinatePoints: [
      {
        id: "parking-1",
        kind: "parking",
        label: "Parking",
        latitude: 52.1,
        longitude: 4.3,
      },
    ],
  };

  const normalized = normalizeEditableLocationFields(payload);

  assert.deepEqual(normalized, {
    name: "Loop Park",
    city: "",
    province: "",
    country: "Netherlands",
    latitude: null,
    longitude: null,
    type: ["park"],
    characteristics: ["walking trails"],
    description: "",
    relatedUrls: [{ label: "Website", url: "https://example.com" }],
    photos: [{ url: "https://example.com/photo.jpg", alt: "Loop" }],
    coordinatePoints: [
      {
        id: "parking-1",
        kind: "parking",
        label: "Parking",
        latitude: 52.1,
        longitude: 4.3,
      },
    ],
  });

  normalized.relatedUrls[0].label = "Changed";
  normalized.photos[0].alt = "Changed";
  normalized.coordinatePoints[0].label = "Changed";

  assert.equal(payload.relatedUrls[0].label, "Website");
  assert.equal(payload.photos[0].alt, "Loop");
  assert.equal(payload.coordinatePoints[0].label, "Parking");
});

test("legacy missing attributes are unknown; positive evidence never implies everywhere off leash", () => {
  assert.deepEqual(normalizeAreaAttributes(undefined), {
    offLeash: "unknown",
    fenced: "unknown",
    swimming: "unknown",
    wheelchairAccessible: "unknown",
  });
  assert.deepEqual(
    normalizeAreaAttributes({ fenced: "no", swimming: "unknown" }, [
      "fenced",
      "swimming water",
      "off-leash area",
    ]),
    {
      offLeash: "partial",
      fenced: "no",
      swimming: "unknown",
      wheelchairAccessible: "unknown",
    },
  );
  assert.equal(normalizeAreaAttributes(null, ["fenced"]).fenced, "yes");
});

test("navigation destinations never include a general position or unrelated point", () => {
  const point = {
    id: "p",
    label: "Point",
    latitude: 52.123456,
    longitude: 4.123456,
  };
  const points = ["general", "parking", "entrance", "water", "hazard"].map(
    (kind) => ({ ...point, id: kind, kind }),
  );
  assert.deepEqual(getLocationDestinations(points), [points[1], points[2]]);
  assert.deepEqual(getLocationDestinations(), []);
  assert.deepEqual(
    getLocationDestinations([{ ...point, kind: "parking", latitude: null }]),
    [],
  );
});

test("point migration persists unique identities without changing values and is safe to rerun", () => {
  const point = {
    kind: "parking",
    label: "Parking",
    latitude: 52.123456,
    longitude: 4.123456,
  };
  const legacy = [
    point,
    { ...point, id: "existing" },
    { ...point, id: "existing" },
  ];
  const migrated = migratePointIds(legacy);
  assert.equal(new Set(migrated.map((item) => item.id)).size, 3);
  assert.equal(migrated[1].id, "existing");
  assert.deepEqual(
    migrated.map(({ id, ...item }) => item),
    legacy.map(({ id, ...item }) => item),
  );
  assert.deepEqual(migratePointIds(migrated), migrated);
  assert.equal(legacy[0].id, undefined);
  assert.deepEqual(migratePointIds(), []);
});

test("migration aligns unchanged pending points with their parent and avoids guessing changed/deleted identities", () => {
  const point = { kind: "entrance", label: "Gate", latitude: 52, longitude: 4 };
  const parent = migratePointIds([point]);
  assert.equal(migratePointIds([point], parent)[0].id, parent[0].id);
  const changed = migratePointIds([{ ...point, latitude: 53 }], parent);
  assert.notEqual(changed[0].id, parent[0].id);
  const ambiguous = migratePointIds(
    [point],
    [...parent, { ...parent[0], id: "another" }],
  );
  assert.notEqual(ambiguous[0].id, parent[0].id);
});

test("editable snapshots clone structured attributes and routes", () => {
  const payload = {
    attributes: normalizeAreaAttributes({ fenced: "no" }),
    routes: [{ id: "r", name: "Loop", url: "https://example.com/" }],
  };
  const normalized = normalizeEditableLocationFields(payload);
  normalized.attributes.fenced = "yes";
  normalized.routes[0].name = "Other";
  assert.equal(payload.attributes.fenced, "no");
  assert.equal(payload.routes[0].name, "Loop");
});
