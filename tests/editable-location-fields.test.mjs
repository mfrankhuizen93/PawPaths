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
