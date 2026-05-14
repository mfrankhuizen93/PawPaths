import fs from "node:fs/promises";
import { MongoClient } from "mongodb";
import { getMongoConfig, loadEnvFile } from "./env.js";
import { inferLocationWarnings } from "../server/utils/location-warnings.js";

const SOURCE_PATH = "doggydating-locations.json";

function toDateOrNull(value) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isCloudinaryPhoto(photo) {
  return (
    photo?.provider === "cloudinary" || /res\.cloudinary\.com/.test(photo?.url)
  );
}

function getOriginalPhotoUrl(photo) {
  return photo?.originalUrl ?? photo?.url ?? null;
}

function mergePhotos(sourcePhotos = [], existingPhotos = []) {
  const existingCloudinaryByOriginalUrl = new Map();

  for (const photo of existingPhotos) {
    const originalUrl = getOriginalPhotoUrl(photo);
    if (originalUrl && isCloudinaryPhoto(photo)) {
      existingCloudinaryByOriginalUrl.set(originalUrl, photo);
    }
  }

  return sourcePhotos.map((photo) => {
    const originalUrl = getOriginalPhotoUrl(photo);
    const existingPhoto = existingCloudinaryByOriginalUrl.get(originalUrl);

    if (existingPhoto) return existingPhoto;

    return {
      url: photo.url,
      originalUrl: photo.originalUrl ?? photo.url,
      alt: photo.alt ?? null,
    };
  });
}

function toLocationDocument(location, existingLocation) {
  const hasCoordinates =
    Number.isFinite(location.longitude) && Number.isFinite(location.latitude);

  return {
    sourceUrl: location.url,
    source: "doggydating",
    name: location.name,
    city: location.cityGuess,
    province: location.province,
    country: "NL",
    latitude: location.latitude,
    longitude: location.longitude,
    location: hasCoordinates
      ? {
          type: "Point",
          coordinates: [location.longitude, location.latitude],
        }
      : null,
    type: location.type ?? [],
    characteristics: location.characteristics ?? [],
    warnings: location.warnings ?? inferLocationWarnings(location.reviews),
    description: location.description ?? "",
    relatedUrls: location.relatedUrls ?? [],
    photos: mergePhotos(location.photos, existingLocation?.photos),
    reviews: (location.reviews ?? []).map((review) => ({
      reviewerName: review.reviewer,
      dateText: review.date,
      date: toDateOrNull(review.date),
      rating: Number.isFinite(review.rating) ? review.rating : null,
      text: review.text,
      source: "doggydating",
    })),
    status: location.error ? "import_error" : "published",
    importError: location.error ?? null,
    updatedAt: new Date(),
  };
}

await loadEnvFile();

const { uri, dbName } = getMongoConfig();
const source = JSON.parse(await fs.readFile(SOURCE_PATH, "utf8"));

if (!Array.isArray(source)) {
  throw new Error(`${SOURCE_PATH} should contain an array`);
}

const client = new MongoClient(uri);

try {
  await client.connect();

  const db = client.db(dbName);
  const locations = db.collection("locations");

  const sourceUrls = source.map((location) => location.url).filter(Boolean);
  const existingLocations = await locations
    .find(
      { sourceUrl: { $in: sourceUrls } },
      { projection: { sourceUrl: 1, photos: 1 } },
    )
    .toArray();
  const existingBySourceUrl = new Map(
    existingLocations.map((location) => [location.sourceUrl, location]),
  );
  const documents = source.map((location) =>
    toLocationDocument(location, existingBySourceUrl.get(location.url)),
  );
  const operations = documents.map((document) => ({
    updateOne: {
      filter: { sourceUrl: document.sourceUrl },
      update: {
        $set: document,
        $unset: {
          ratingSummary: "",
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      upsert: true,
    },
  }));

  const result =
    operations.length > 0
      ? await locations.bulkWrite(operations, { ordered: false })
      : null;

  const documentSourceUrls = documents.map((document) => document.sourceUrl);
  const removedResult =
    documentSourceUrls.length > 0
      ? await locations.updateMany(
          {
            source: "doggydating",
            sourceUrl: { $nin: documentSourceUrls },
            status: { $ne: "removed" },
          },
          {
            $set: {
              status: "removed",
              updatedAt: new Date(),
            },
            $unset: {
              ratingSummary: "",
            },
          },
        )
      : { modifiedCount: 0 };

  await locations.createIndex({ sourceUrl: 1 }, { unique: true });
  await locations.createIndex({ location: "2dsphere" });
  await locations.createIndex({ status: 1 });
  await locations.createIndex({ type: 1 });
  await locations.createIndex({ characteristics: 1 });
  await locations.createIndex({ name: "text", description: "text" });
  try {
    await locations.dropIndex("ratingSummary.average_-1");
  } catch (error) {
    if (error.codeName !== "IndexNotFound") {
      throw error;
    }
  }

  console.log("Import complete");
  console.log(`Database: ${db.databaseName}`);
  console.log(`Collection: locations`);
  console.log(`Source rows: ${source.length}`);
  console.log(`Matched: ${result?.matchedCount ?? 0}`);
  console.log(`Inserted: ${result?.upsertedCount ?? 0}`);
  console.log(`Modified: ${result?.modifiedCount ?? 0}`);
  console.log(`Marked removed: ${removedResult.modifiedCount}`);
  console.log(`Total in collection: ${await locations.countDocuments()}`);
  console.log(
    `Published in collection: ${await locations.countDocuments({ status: "published" })}`,
  );
} finally {
  await client.close();
}
