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
const { reviewContribution } = locationContributions;

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
    idsEqual(document[key], value),
  );
}

function createCollection(documents = []) {
  return {
    documents,
    async createIndex() {
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
