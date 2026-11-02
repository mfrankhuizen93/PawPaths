import assert from "node:assert/strict";
import Module from "node:module";
import test from "node:test";
import { ObjectId } from "mongodb";

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

const { default: locationContributions } =
  await import("../server/utils/location-contributions.ts");
const {
  ensureContributionIndexes,
  reviewContribution,
  createLocationContribution,
  sanitizeLocationPayload,
} = locationContributions;

const admin = {
  id: "admin-user",
  name: "Admin User",
  email: "admin@example.com",
  role: "admin",
};

const submitter = {
  id: "submitter-user",
  name: "Submitter User",
  email: "submitter@example.com",
};

function locationPayload(name = "Loop Park") {
  return {
    name,
    city: "Amsterdam",
    province: "North Holland",
    country: "Netherlands",
    latitude: 52.37,
    longitude: 4.9,
    type: ["park"],
    characteristics: ["walking trails"],
    description: "A good place to walk.",
    relatedUrls: [],
    coordinatePoints: [],
  };
}

function idsEqual(a, b) {
  return a instanceof ObjectId && b instanceof ObjectId
    ? a.equals(b)
    : Object.is(a, b);
}

function matches(document, filter) {
  return Object.entries(filter).every(([key, value]) =>
    value === null
      ? document[key] == null
      : typeof value === "object" && !(value instanceof ObjectId)
        ? JSON.stringify(document[key]) === JSON.stringify(value)
        : idsEqual(document[key], value),
  );
}

function createCollection(documents = []) {
  return {
    documents,
    indexes: [],
    async createIndex() {
      this.indexes.push([...arguments]);
      return "ok";
    },
    async findOne(filter) {
      return (
        this.documents.find((document) => matches(document, filter)) ?? null
      );
    },
    async insertOne(document) {
      const insertedId = document._id ?? new ObjectId();
      this.documents.push({ ...document, _id: insertedId });

      return { insertedId };
    },
    async updateOne(filter, update) {
      const document = this.documents.find((item) => matches(item, filter));

      if (!document) return { matchedCount: 0 };

      Object.assign(document, update.$set ?? {});

      return { matchedCount: 1 };
    },
    async findOneAndUpdate(filter, update) {
      const document = this.documents.find((item) => matches(item, filter));

      if (!document) return null;

      Object.assign(document, update.$set ?? {});

      return { ...document };
    },
    find(filter) {
      const rows = this.documents.filter((document) =>
        matches(document, filter),
      );

      return {
        sort() {
          return this;
        },
        async toArray() {
          return rows;
        },
      };
    },
  };
}

function createDb({ contributions = [], locations = [] } = {}) {
  const collections = {
    contributions: createCollection(contributions),
    locations: createCollection(locations),
  };

  return {
    collections,
    collection(name) {
      return collections[name];
    },
  };
}

function createPendingContribution({ id = new ObjectId(), payload } = {}) {
  const now = new Date("2026-05-28T12:00:00.000Z");

  return {
    _id: id,
    kind: "new-location",
    status: "pending",
    locationId: null,
    locationSlug: null,
    locationName: payload.name,
    payload,
    submitter,
    reviewer: null,
    reviewNote: null,
    createdAt: now,
    updatedAt: now,
    reviewedAt: null,
  };
}

test("approving a new location creates one published location and completes the contribution", async () => {
  const contribution = createPendingContribution({
    payload: locationPayload("Loop Park"),
  });
  const db = createDb({ contributions: [contribution] });

  const result = await reviewContribution({
    db,
    id: contribution._id.toString(),
    reviewer: admin,
    action: "approve",
  });

  assert.equal(db.collections.locations.documents.length, 1);

  const location = db.collections.locations.documents[0];
  assert.equal(location.slug, "loop-park-amsterdam");
  assert.equal(
    location.sourceUrl,
    `pawpaths:contribution:${contribution._id.toString()}`,
  );
  assert.equal(location.status, "published");
  assert.ok(location.sourceContributionId.equals(contribution._id));
  assert.equal(result.status, "approved");
  assert.equal(result.locationSlug, location.slug);
  assert.equal(result.locationId, location._id.toString());
});

test("normalization preserves distinct point identities and exact destinations", () => {
  const points = [
    {
      id: "east",
      kind: "parking",
      label: "East",
      latitude: 52.123456,
      longitude: 4.123456,
    },
    {
      id: "west",
      kind: "parking",
      label: "West",
      latitude: 52.654321,
      longitude: 4.654321,
    },
  ];
  const payload = sanitizeLocationPayload({
    ...locationPayload(),
    coordinatePoints: points,
  });
  assert.deepEqual(
    payload.coordinatePoints.map(({ sourcePhotoId, ...point }) => point),
    points,
  );
  assert.equal(payload.latitude, 52.37);
  assert.throws(
    () =>
      sanitizeLocationPayload({
        ...payload,
        coordinatePoints: [{ ...points[0], id: undefined }],
      }),
    { statusCode: 400 },
  );
  assert.throws(
    () =>
      sanitizeLocationPayload({
        ...payload,
        coordinatePoints: [points[0], points[0]],
      }),
    { statusCode: 400 },
  );
  assert.throws(
    () =>
      sanitizeLocationPayload({
        ...payload,
        coordinatePoints: [{ ...points[0], latitude: 91 }],
      }),
    { statusCode: 400 },
  );
});

test("normalization preserves explicit negative and unknown attributes and external routes", () => {
  const attributes = {
    offLeash: "not-allowed",
    fenced: "no",
    swimming: "unknown",
    wheelchairAccessible: "yes",
  };
  const routes = [
    { id: "walk-1", name: "Forest loop", url: "https://example.com/walk" },
  ];
  const payload = sanitizeLocationPayload({
    ...locationPayload(),
    attributes,
    routes,
  });
  assert.deepEqual(payload.attributes, attributes);
  assert.deepEqual(payload.routes, routes);
  assert.equal(
    sanitizeLocationPayload(locationPayload()).attributes,
    undefined,
  );
  assert.throws(
    () =>
      sanitizeLocationPayload({
        ...payload,
        routes: [{ ...routes[0], url: "javascript:alert(1)" }],
      }),
    { statusCode: 400 },
  );
});

test("moderator save and approval retain the original proposal and submission metadata", async () => {
  const db = createDb();
  const payload = locationPayload("Original");
  const created = await createLocationContribution({
    db,
    user: submitter,
    kind: "new-location",
    payload,
  });
  payload.name = "Mutated outside persistence";
  const saved = await reviewContribution({
    db,
    id: created.id,
    reviewer: admin,
    action: "save",
    payload: locationPayload("Reviewed"),
  });
  assert.equal(saved.payload.name, "Reviewed");
  assert.equal(saved.submittedPayload.name, "Original");
  assert.deepEqual(saved.submitter, submitter);
  assert.equal(saved.createdAt, created.createdAt);
  assert.equal(saved.status, "pending");
  const approved = await reviewContribution({
    db,
    id: created.id,
    reviewer: admin,
    action: "approve",
  });
  assert.equal(approved.submittedPayload.name, "Original");
  assert.equal(approved.payload.name, "Reviewed");
  assert.equal(approved.status, "approved");
  assert.ok(approved.reviewedAt);
});

test("first review of a legacy new-location proposal retains the available proposal in storage and response", async () => {
  const contribution = createPendingContribution({
    payload: locationPayload("Available original"),
  });
  const db = createDb({ contributions: [contribution] });
  const result = await reviewContribution({
    db,
    id: contribution._id.toString(),
    reviewer: admin,
    action: "approve",
    payload: locationPayload("Moderator correction"),
  });
  assert.equal(result.submittedPayload.name, "Available original");
  assert.equal(contribution.submittedPayload.name, "Available original");
  assert.equal(result.payload.name, "Moderator correction");
});

test("approval rejects stale proposals including deleted points and retains competing contributions", async () => {
  const point = {
    id: "entrance-1",
    kind: "entrance",
    label: "Gate",
    latitude: 52.1,
    longitude: 4.2,
  };
  const location = {
    ...locationPayload(),
    coordinatePoints: [point],
    _id: new ObjectId(),
    slug: "loop-park",
    status: "published",
  };
  const db = createDb({ locations: [location] });
  const first = await createLocationContribution({
    db,
    user: submitter,
    kind: "location-change",
    location,
    payload: { ...locationPayload("First"), coordinatePoints: [] },
  });
  const second = await createLocationContribution({
    db,
    user: submitter,
    kind: "location-change",
    location,
    payload: { ...locationPayload("Second"), coordinatePoints: [point] },
  });
  await reviewContribution({
    db,
    id: first.id,
    reviewer: admin,
    action: "approve",
  });
  await assert.rejects(
    reviewContribution({
      db,
      id: second.id,
      reviewer: admin,
      action: "approve",
    }),
    { statusCode: 409 },
  );
  assert.equal(location.name, "First");
  assert.deepEqual(location.coordinatePoints, []);
  assert.equal(db.collections.contributions.documents[1].status, "pending");
  assert.equal(
    db.collections.contributions.documents[1].submittedPayload.name,
    "Second",
  );
});

test("legacy pending changes without a historical base stay readable but cannot overwrite published data", async () => {
  const contribution = {
    ...createPendingContribution({ payload: locationPayload("Legacy edit") }),
    kind: "location-change",
    locationId: new ObjectId(),
  };
  const db = createDb({
    contributions: [contribution],
    locations: [
      {
        ...locationPayload(),
        _id: contribution.locationId,
        status: "published",
      },
    ],
  });
  await assert.rejects(
    reviewContribution({
      db,
      id: contribution._id.toString(),
      reviewer: admin,
      action: "approve",
    }),
    { statusCode: 409 },
  );
  assert.equal(contribution.status, "pending");
});

test("publication detects a change made after base comparison, including newly added optional fields", async () => {
  const location = {
    ...locationPayload(),
    _id: new ObjectId(),
    slug: "loop-park",
    status: "published",
  };
  const db = createDb({ locations: [location] });
  const created = await createLocationContribution({
    db,
    user: submitter,
    kind: "location-change",
    location,
    payload: locationPayload("Proposal"),
  });
  const collection = db.collections.locations;
  const update = collection.updateOne.bind(collection);
  collection.updateOne = async (filter, fields) => {
    location.routes = [
      { id: "new-route", name: "New route", url: "https://example.com/" },
    ];
    return update(filter, fields);
  };
  await assert.rejects(
    reviewContribution({
      db,
      id: created.id,
      reviewer: admin,
      action: "approve",
    }),
    { statusCode: 409 },
  );
  assert.equal(location.name, "Loop Park");
  assert.equal(location.routes[0].id, "new-route");
  assert.equal(db.collections.contributions.documents[0].status, "pending");
});

test("contribution indexes only require real contribution source ids to be unique", async () => {
  const db = createDb();

  await ensureContributionIndexes(db);

  assert.deepEqual(
    db.collections.locations.indexes.find(
      ([keys]) => keys.sourceContributionId === 1,
    ),
    [
      { sourceContributionId: 1 },
      {
        unique: true,
        partialFilterExpression: {
          sourceContributionId: { $type: "objectId" },
        },
      },
    ],
  );
  assert.equal(db.collections.contributions.indexes.length, 3);
});

test("retrying approval after a previous location insert reuses the existing location", async () => {
  const contributionId = new ObjectId();
  const payload = locationPayload("Retry Park");
  const contribution = createPendingContribution({
    id: contributionId,
    payload,
  });
  const existingLocationId = new ObjectId();
  const db = createDb({
    contributions: [contribution],
    locations: [
      {
        ...payload,
        _id: existingLocationId,
        slug: "retry-park-amsterdam",
        status: "published",
        sourceContributionId: contributionId,
      },
    ],
  });

  const result = await reviewContribution({
    db,
    id: contributionId.toString(),
    reviewer: admin,
    action: "approve",
  });

  assert.equal(db.collections.locations.documents.length, 1);
  assert.equal(result.status, "approved");
  assert.equal(result.locationSlug, "retry-park-amsterdam");
  assert.equal(result.locationId, existingLocationId.toString());
});

// Exercise the same placement -> editable snapshot -> API sanitizer -> review
// boundaries used by the add and edit drawers, using an isolated database double.
test("confirmed add/edit positions survive normalization, submission reload, reviewer save and approval", async () => {
  const { default: placementModule } =
    await import("../app/composables/useLocationPointPlacement.ts");
  const { default: normalization } =
    await import("../shared/utils/editable-location-fields.ts");
  const { useLocationPointPlacement } = placementModule;
  const { normalizeEditableLocationFields } = normalization;
  const db = createDb();
  let form = normalizeEditableLocationFields(locationPayload());
  const editor = useLocationPointPlacement(() => form);
  editor.begin({ type: "area" });
  editor.pick({ latitude: 52.11111149, longitude: 4.22222249 });
  editor.confirm();
  editor.begin({ type: "new", kind: "parking", label: "Parking" });
  editor.pick({ latitude: 52.33333349, longitude: 4.44444449 });
  editor.confirm();
  editor.begin({ type: "new", kind: "parking", label: "Parking" });
  editor.pick({ latitude: 52.55555549, longitude: 4.66666649 });
  editor.confirm();
  const expected = structuredClone(form);
  const added = await createLocationContribution({
    db,
    user: submitter,
    kind: "new-location",
    payload: sanitizeLocationPayload(normalizeEditableLocationFields(form)),
  });
  // A failed request does not consume or replace the confirmed form.
  const failedDb = {
    collection() {
      return {
        async insertOne() {
          throw new Error("Network failure");
        },
      };
    },
  };
  await assert.rejects(
    createLocationContribution({
      db: failedDb,
      user: submitter,
      kind: "new-location",
      payload: sanitizeLocationPayload(form),
    }),
    /Network failure/,
  );
  assert.deepEqual(form, expected);
  const reloaded = db.collections.contributions.documents[0];
  assert.deepEqual(
    reloaded.payload.coordinatePoints,
    added.payload.coordinatePoints,
  );
  await reviewContribution({
    db,
    id: added.id,
    reviewer: admin,
    action: "save",
    payload: normalizeEditableLocationFields(reloaded.payload),
  });
  await reviewContribution({
    db,
    id: added.id,
    reviewer: admin,
    action: "approve",
  });
  const published = db.collections.locations.documents[0];
  assert.equal(published.latitude, 52.111111);
  assert.equal(published.longitude, 4.222222);
  assert.deepEqual(published.location.coordinates, [4.222222, 52.111111]);
  assert.deepEqual(
    published.coordinatePoints.map(({ sourcePhotoId, ...point }) => point),
    expected.coordinatePoints,
  );

  form = normalizeEditableLocationFields(published);
  const id = form.coordinatePoints[0].id;
  const untouchedPoint = structuredClone(form.coordinatePoints[1]);
  const { default: pointEditorModule } =
    await import("../app/composables/useLocationPointEditor.ts");
  const pointEditor = pointEditorModule.useLocationPointEditor(
    () => form,
    () => true,
  );
  pointEditor.selectedId.value = id;
  pointEditor.rename("West entrance");
  pointEditor.changeKind("entrance");
  editor.begin({ type: "point", id });
  editor.pick({ latitude: -12.12345678, longitude: 130.98765432 });
  editor.confirm();
  const edited = await createLocationContribution({
    db,
    user: submitter,
    kind: "location-change",
    location: published,
    payload: sanitizeLocationPayload(normalizeEditableLocationFields(form)),
  });
  await reviewContribution({
    db,
    id: edited.id,
    reviewer: admin,
    action: "approve",
    payload: normalizeEditableLocationFields(edited.payload),
  });
  const loaded = normalizeEditableLocationFields(
    JSON.parse(JSON.stringify(published)),
  );
  assert.deepEqual(loaded.coordinatePoints[0], {
    id,
    kind: "entrance",
    label: "West entrance",
    latitude: -12.123457,
    longitude: 130.987654,
    sourcePhotoId: null,
  });
  assert.deepEqual(loaded.coordinatePoints[1], untouchedPoint);
  assert.equal(loaded.coordinatePoints.length, 2);
  assert.equal(loaded.latitude, 52.111111);
  assert.equal(loaded.longitude, 4.222222);
  assert.deepEqual(published.location.coordinates, [4.222222, 52.111111]);
});
