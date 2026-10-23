import assert from "node:assert/strict";
import test from "node:test";
import Module from "node:module";
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  return originalResolveFilename.call(
    this,
    request.startsWith("#shared/")
      ? process.cwd() + "/shared/" + request.slice(8) + ".ts"
      : request,
    ...args,
  );
};
const { default: placementModule } =
  await import("../app/composables/useLocationPointPlacement.ts");
import coordinatesModule from "../shared/utils/location-coordinates.ts";

const { useLocationPointPlacement } = placementModule;
const { roundLocationCoordinates } = coordinatesModule;
const selected = { latitude: 52.123456789, longitude: 4.987654321 };
const confirmed = { latitude: 52.123457, longitude: 4.987654 };
const form = () => ({
  name: "Park",
  latitude: 51,
  longitude: 5,
  type: ["park"],
  characteristics: [],
  coordinatePoints: [
    { id: "gate", kind: "entrance", label: "Gate", latitude: 52, longitude: 4 },
    {
      id: "parking",
      kind: "parking",
      label: "Parking",
      latitude: 53,
      longitude: 6,
    },
  ],
});

test("area, add, and edit all stage a coordinate pair and require explicit confirmation", () => {
  const value = form();
  const editor = useLocationPointPlacement(() => value);
  const before = structuredClone(value);
  editor.pick(selected);
  assert.equal(editor.draft.value, null);
  editor.begin({ type: "area" });
  assert.equal(editor.confirm(), false);
  editor.pick(selected);
  assert.deepEqual(editor.draft.value, confirmed);
  assert.deepEqual(value, before);
  assert.equal(editor.confirm(), true);
  assert.equal(value.latitude, confirmed.latitude);
  assert.deepEqual(value.coordinatePoints, before.coordinatePoints);

  editor.begin({ type: "new", kind: "entrance", label: "Second gate" });
  editor.pick(selected);
  assert.equal(value.coordinatePoints.length, 2);
  assert.equal(editor.confirm(), true);
  const added = value.coordinatePoints[2];
  assert.ok(added.id);
  assert.deepEqual(
    { latitude: added.latitude, longitude: added.longitude },
    confirmed,
  );
  editor.begin({ type: "point", id: added.id });
  editor.pick({ latitude: 0, longitude: -180 });
  assert.equal(editor.confirm(), true);
  assert.equal(added.id, value.coordinatePoints[2].id);
  assert.equal(added.latitude, 0);
  assert.equal(added.longitude, -180);
  assert.equal(value.latitude, confirmed.latitude);
  assert.deepEqual(value.coordinatePoints.slice(0, 2), before.coordinatePoints);
});

test("rapid switching, cancel, deleted targets and stale IDs cannot write to another point or area", () => {
  const value = form();
  const before = structuredClone(value);
  const editor = useLocationPointPlacement(() => value);
  editor.begin({ type: "point", id: "gate" });
  editor.pick(selected);
  editor.begin({ type: "point", id: "parking" });
  assert.equal(editor.draft.value, null);
  assert.equal(editor.confirm(), false);
  editor.pick(selected);
  editor.cancel();
  assert.equal(editor.confirm(), false);
  assert.deepEqual(value, before);
  editor.begin({ type: "point", id: "missing" });
  assert.equal(editor.coordinates.value, null);
  editor.pick(selected);
  assert.equal(editor.confirm(), false);
  assert.deepEqual(value, before);
});

test("invalid coordinates cannot be confirmed and rounding handles boundaries", () => {
  const value = form();
  const before = structuredClone(value);
  const editor = useLocationPointPlacement(() => value);
  editor.begin({ type: "area" });
  for (const bad of [NaN, Infinity, -91, 91, null, "52"]) {
    editor.pick({ latitude: bad, longitude: 4 });
    assert.equal(editor.confirm(), false);
  }
  for (const bad of [-181, 181, NaN, Infinity, null]) {
    editor.pick({ latitude: 52, longitude: bad });
    assert.equal(editor.confirm(), false);
  }
  assert.deepEqual(value, before);
  assert.deepEqual(
    roundLocationCoordinates({ latitude: 89.9999999, longitude: -179.9999999 }),
    { latitude: 90, longitude: -180 },
  );
  assert.deepEqual(
    roundLocationCoordinates({ latitude: -0.0000001, longitude: 0 }),
    { latitude: 0, longitude: 0 },
  );
});

test("point limit leaves confirmed positions intact", () => {
  const value = form();
  value.coordinatePoints = Array.from({ length: 8 }, (_, index) => ({
    ...value.coordinatePoints[0],
    id: String(index),
  }));
  const before = structuredClone(value);
  const editor = useLocationPointPlacement(() => value);
  editor.begin({ type: "new", kind: "parking", label: "Parking" });
  editor.pick(selected);
  assert.equal(editor.confirm(), false);
  assert.deepEqual(value, before);
  assert.deepEqual(editor.draft.value, confirmed);
});
