import fs from "node:fs/promises";
import Module from "node:module";
import { MongoClient, ObjectId } from "mongodb";
import { getMongoConfig, loadEnvFile } from "./env.js";

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

const { default: locationContributions } = await import(
  "../server/utils/location-contributions.ts"
);
const { createLocationContribution, sanitizeLocationPayload } =
  locationContributions;

const SOURCE_PATH = "staatsbosbeheer-locations.json";
const DEFAULT_SLUG = "waterland-durgerdam";

function getArgument(name) {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));

  return value ? value.slice(prefix.length) : null;
}

function toPayload(candidate) {
  return sanitizeLocationPayload({
    name: candidate.name,
    city: candidate.city,
    province: candidate.province,
    country: candidate.country ?? "NL",
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    type: candidate.type,
    characteristics: candidate.characteristics,
    description: candidate.description,
    relatedUrls: candidate.relatedUrls,
    photos: candidate.photos,
    coordinatePoints: candidate.coordinatePoints,
  });
}

const targetSlug = getArgument("slug") ?? DEFAULT_SLUG;
const contributionId = getArgument("contribution-id");
const submitAll = process.argv.includes("--all");
await loadEnvFile();

const candidates = JSON.parse(await fs.readFile(SOURCE_PATH, "utf8"));

if (!Array.isArray(candidates)) {
  throw new Error(`${SOURCE_PATH} should contain an array`);
}

const { uri, dbName } = getMongoConfig();
const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db(dbName);
  const contributions = db.collection("contributions");
  const locations = db.collection("locations");

  async function submitCandidate(candidate, explicitContributionId = null) {
    const payload = toPayload(candidate);
    const routeUrl = candidate.sourceUrl;
    const approvedContribution = routeUrl
      ? await contributions.findOne(
          {
            kind: "new-location",
            status: "approved",
            "submitter.id": "staatsbosbeheer-scraper",
            "payload.relatedUrls.url": routeUrl,
          },
          { projection: { _id: 1, locationId: 1 } },
        )
      : null;
    const publishedLocation = approvedContribution?.locationId
      ? await locations.findOne({
          _id: approvedContribution.locationId,
          status: "published",
        })
      : null;

    if (publishedLocation) {
      await contributions.deleteMany({
        kind: "new-location",
        status: "pending",
        "submitter.id": "staatsbosbeheer-scraper",
        "payload.relatedUrls.url": routeUrl,
      });

      const existingChange = await contributions.findOne({
        kind: "location-change",
        status: "pending",
        locationId: publishedLocation._id,
        "submitter.id": "staatsbosbeheer-scraper",
      });

      if (existingChange) {
        await contributions.updateOne(
          { _id: existingChange._id },
          {
            $set: {
              locationName: payload.name,
              payload,
              updatedAt: new Date(),
            },
          },
        );

        return {
          action: "updated",
          id: existingChange._id.toString(),
          location: `${payload.name}, ${payload.city}`,
          kind: "location-change",
        };
      }

      const contribution = await createLocationContribution({
        db,
        user: {
          id: "staatsbosbeheer-scraper",
          name: "Staatsbosbeheer Scraper",
          email: "scraper@pawpaths.local",
        },
        kind: "location-change",
        payload,
        location: publishedLocation,
      });

      return {
        action: "created",
        id: contribution.id,
        location: `${payload.name}, ${payload.city}`,
        kind: "location-change",
      };
    }

    const existingFilter = explicitContributionId
      ? { _id: new ObjectId(explicitContributionId), status: "pending" }
      : {
          kind: "new-location",
          status: "pending",
          "submitter.id": "staatsbosbeheer-scraper",
          ...(routeUrl
            ? { "payload.relatedUrls.url": routeUrl }
            : { "payload.name": payload.name }),
        };
    const existingContributions = await contributions
      .find(existingFilter, {
        projection: {
          _id: 1,
          kind: 1,
          status: 1,
          locationName: 1,
          "payload.name": 1,
          "payload.city": 1,
          createdAt: 1,
        },
      })
      .sort({ createdAt: 1, _id: 1 })
      .toArray();
    const existing = existingContributions[0] ?? null;

    if (existing) {
      await contributions.updateOne(
        { _id: existing._id },
        {
          $set: {
            locationName: payload.name,
            payload,
            updatedAt: new Date(),
          },
        },
      );

      const duplicateIds = existingContributions
        .slice(1)
        .map((contribution) => contribution._id);

      if (duplicateIds.length > 0) {
        await contributions.deleteMany({
          _id: { $in: duplicateIds },
          status: "pending",
          "submitter.id": "staatsbosbeheer-scraper",
        });
      }

      return {
        action: "updated",
        id: existing._id.toString(),
        location: `${payload.name}, ${payload.city}`,
        duplicatesRemoved: duplicateIds.length,
      };
    }

    const contribution = await createLocationContribution({
      db,
      user: {
        id: "staatsbosbeheer-scraper",
        name: "Staatsbosbeheer Scraper",
        email: "scraper@pawpaths.local",
      },
      kind: "new-location",
      payload,
    });

    return {
      action: "created",
      id: contribution.id,
      location: `${payload.name}, ${payload.city}`,
    };
  }

  if (submitAll) {
    const results = [];

    for (const candidate of candidates) {
      results.push(await submitCandidate(candidate));
    }

    const created = results.filter((result) => result.action === "created");
    const updated = results.filter((result) => result.action === "updated");
    const duplicatesRemoved = results.reduce(
      (total, result) => total + (result.duplicatesRemoved ?? 0),
      0,
    );

    console.log("Submitted Staatsbosbeheer candidates");
    console.log(`Source candidates: ${candidates.length}`);
    console.log(`Created: ${created.length}`);
    console.log(`Updated: ${updated.length}`);
    console.log(`Duplicate pending contributions removed: ${duplicatesRemoved}`);
    for (const result of results) {
      console.log(`- ${result.action}: ${result.id} ${result.location}`);
    }
  } else {
    const candidate = candidates.find((item) => item.slug === targetSlug);

    if (!candidate) {
      throw new Error(
        `Could not find Staatsbosbeheer candidate slug: ${targetSlug}`,
      );
    }

    const result = await submitCandidate(candidate, contributionId);

    console.log(
      result.action === "created"
        ? "Created pending contribution"
        : "Existing pending contribution found",
    );
    console.log(`Contribution id: ${result.id}`);
    console.log(`Location: ${result.location}`);
    if (result.action === "updated") {
      console.log("Refreshed payload from Staatsbosbeheer candidate");
    }
  }
} finally {
  await client.close();
}
