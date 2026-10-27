import assert from "node:assert/strict";
import test from "node:test";
import Module from "node:module";
import { reactive } from "vue";
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
const { default: editorModule } =
  await import("../app/composables/useLocationPointEditor.ts");
const { default: placementModule } =
  await import("../app/composables/useLocationPointPlacement.ts");
const { useLocationPointEditor } = editorModule;
const { useLocationPointPlacement } = placementModule;
const point = (id) => ({
  id,
  label: "Gate",
  kind: "entrance",
  latitude: 52,
  longitude: 4,
});

test("zero, one and many duplicate labels are edited only by identity, retaining coordinates and metadata", () => {
  for (const count of [0, 1, 8]) {
    const form = reactive({
      coordinatePoints: Array.from({ length: count }, (_, i) => ({
        ...point(String(i)),
        sourcePhotoId: `photo-${i}`,
      })),
    });
    const editor = useLocationPointEditor(
      () => form,
      () => true,
    );
    const before = structuredClone(JSON.parse(JSON.stringify(form)));
    editor.selectedId.value = "missing";
    assert.equal(editor.rename("Wrong"), false);
    if (!count) {
      assert.equal(editor.requestRemoval("missing"), false);
      continue;
    }
    editor.selectedId.value = "0";
    assert.equal(editor.rename("North gate"), true);
    assert.equal(editor.changeKind("parking"), true);
    assert.equal(editor.changeKind("general"), false);
    assert.equal(editor.rename(" "), false);
    assert.deepEqual(form.coordinatePoints[0], {
      ...before.coordinatePoints[0],
      label: "North gate",
      kind: "parking",
    });
    assert.deepEqual(
      form.coordinatePoints.slice(1),
      before.coordinatePoints.slice(1),
    );
  }
});

test("removal requires confirmation, follows ID through reorder and rechecks permissions", () => {
  const form = reactive({ coordinatePoints: [point("a"), point("b")] });
  const permission = reactive({ allowed: true });
  const editor = useLocationPointEditor(
    () => form,
    () => permission.allowed,
  );
  editor.selectedId.value = "a";
  assert.equal(editor.requestRemoval("a"), true);
  assert.equal(form.coordinatePoints.length, 2);
  permission.allowed = false;
  assert.equal(editor.confirmRemoval(), false);
  assert.equal(editor.rename("No"), false);
  assert.equal(editor.changeKind("parking"), false);
  assert.equal(editor.requestRemoval("b"), false);
  permission.allowed = true;
  form.coordinatePoints.reverse();
  assert.equal(editor.confirmRemoval(), true);
  assert.deepEqual(
    form.coordinatePoints.map((p) => p.id),
    ["b"],
  );
  assert.equal(editor.selectedId.value, null);
  assert.equal(editor.confirmRemoval(), false);
});

test("legacy missing or duplicate identities cannot edit or remove an ambiguous record", () => {
  for (const ids of [[undefined], ["a", "a"], [""]]) {
    const form = reactive({ coordinatePoints: ids.map(point) });
    const editor = useLocationPointEditor(
      () => form,
      () => true,
    );
    editor.selectedId.value = ids[0];
    assert.equal(editor.identityError.value, true);
    assert.equal(editor.editable.value, false);
    assert.equal(editor.rename("Wrong"), false);
    assert.equal(editor.requestRemoval(ids[0]), false);
    assert.equal(form.coordinatePoints.length, ids.length);
  }
});

test("repeated kinds and labels survive add, selected edit, remove, and serialization without reassignment", () => {
  let form = { coordinatePoints: [] };
  const placement = useLocationPointPlacement(() => form);
  const editor = useLocationPointEditor(
    () => form,
    () => true,
  );
  for (let index = 0; index < 8; index++) {
    placement.begin({ type: "new", kind: "parking", label: "Parking" });
    placement.pick({ latitude: 50 + index / 10, longitude: 4 + index / 10 });
    assert.equal(placement.confirm(), true);
  }
  const ids = form.coordinatePoints.map((p) => p.id);
  assert.equal(new Set(ids).size, 8);
  editor.selectedId.value = ids[3];
  editor.rename("West gate");
  editor.changeKind("entrance");
  placement.begin({ type: "point", id: ids[3] });
  placement.pick({ latitude: 0, longitude: 0 });
  placement.confirm();
  editor.requestRemoval(ids[1]);
  editor.confirmRemoval();
  form = JSON.parse(JSON.stringify(form));
  assert.deepEqual(
    form.coordinatePoints.map((p) => p.id),
    ids.filter((id) => id !== ids[1]),
  );
  assert.deepEqual(
    form.coordinatePoints.find((p) => p.id === ids[3]),
    {
      id: ids[3],
      label: "West gate",
      kind: "entrance",
      latitude: 0,
      longitude: 0,
    },
  );
  assert.equal(
    form.coordinatePoints.filter((p) => p.kind === "parking").length,
    6,
  );
});
