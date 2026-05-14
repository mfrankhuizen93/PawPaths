import crypto from "node:crypto";
import { MongoClient } from "mongodb";
import pLimit from "p-limit";
import { getCloudinaryConfig, getMongoConfig, loadEnvFile } from "./env.js";

const DEFAULT_LIMIT = 25;
const CONCURRENCY = 3;

function parseArgs() {
  const args = new Map();

  for (const arg of process.argv.slice(2)) {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    args.set(key, value);
  }

  return {
    dryRun: args.has("dry-run"),
    limit: args.has("all")
      ? Infinity
      : Number.parseInt(args.get("limit") ?? String(DEFAULT_LIMIT), 10),
  };
}

function cleanSlug(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function hash(value) {
  return crypto.createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function getOriginalPhotoUrl(photo) {
  if (!photo?.url) return null;

  return photo.originalUrl ?? photo.url;
}

function isCloudinaryPhoto(photo) {
  return (
    photo?.provider === "cloudinary" || /res\.cloudinary\.com/.test(photo?.url)
  );
}

function signUploadParams(params, apiSecret) {
  const signatureBase = Object.entries(params)
    .filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    )
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return crypto
    .createHash("sha1")
    .update(`${signatureBase}${apiSecret}`)
    .digest("hex");
}

async function uploadPhoto(
  { cloudName, apiKey, apiSecret },
  location,
  photo,
  index,
) {
  const originalUrl = getOriginalPhotoUrl(photo);
  if (!originalUrl) return null;

  const timestamp = Math.floor(Date.now() / 1000);
  const locationSlug = cleanSlug(location.name) || String(location._id);
  const publicId = `pawpaths/locations/${locationSlug}/${index + 1}-${hash(
    originalUrl,
  )}`;
  const params = {
    overwrite: "true",
    public_id: publicId,
    timestamp,
  };
  const formData = new FormData();

  formData.set("file", originalUrl);
  formData.set("api_key", apiKey);
  formData.set("overwrite", params.overwrite);
  formData.set("public_id", params.public_id);
  formData.set("timestamp", String(params.timestamp));
  formData.set("signature", signUploadParams(params, apiSecret));

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    },
  );
  const responseText = await response.text();
  let body;

  try {
    body = JSON.parse(responseText);
  } catch {
    throw new Error(
      `Cloudinary returned a non-JSON response for cloud "${cloudName}". Check CLOUDINARY_CLOUD_NAME in .env; it must be the exact Cloudinary cloud name, not the account name.`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `Cloudinary upload failed for ${originalUrl}: ${body.error?.message ?? response.statusText}`,
    );
  }

  return {
    url: body.secure_url,
    originalUrl,
    alt: photo.alt ?? null,
    provider: "cloudinary",
    publicId: body.public_id,
    width: body.width,
    height: body.height,
    format: body.format,
    bytes: body.bytes,
  };
}

async function processLocation(config, locations, location, dryRun) {
  const photos = location.photos ?? [];
  const nextPhotos = [...photos];
  let uploaded = 0;

  for (const [index, photo] of photos.entries()) {
    if (isCloudinaryPhoto(photo)) continue;

    if (dryRun) {
      uploaded += 1;
      continue;
    }

    nextPhotos[index] = await uploadPhoto(config, location, photo, index);
    uploaded += 1;
  }

  if (!dryRun && uploaded > 0) {
    await locations.updateOne(
      { _id: location._id },
      {
        $set: {
          photos: nextPhotos,
          updatedAt: new Date(),
        },
      },
    );
  }

  return uploaded;
}

await loadEnvFile();

const { dryRun, limit } = parseArgs();
const mongoConfig = getMongoConfig();
const cloudinaryConfig = getCloudinaryConfig();
const client = new MongoClient(mongoConfig.uri);

try {
  await client.connect();

  const db = client.db(mongoConfig.dbName);
  const locations = db.collection("locations");
  const query = {
    status: "published",
    photos: {
      $elemMatch: {
        url: { $not: /res\.cloudinary\.com/ },
        provider: { $ne: "cloudinary" },
      },
    },
  };
  const rows = await locations
    .find(query, {
      projection: {
        name: 1,
        photos: 1,
      },
    })
    .limit(Number.isFinite(limit) ? limit : 0)
    .toArray();
  const run = pLimit(CONCURRENCY);
  let uploaded = 0;

  console.log(
    `${dryRun ? "Dry run: " : ""}Processing ${rows.length} locations with uncopied photos`,
  );

  const results = await Promise.allSettled(
    rows.map((location) =>
      run(async () => {
        const count = await processLocation(
          cloudinaryConfig,
          locations,
          location,
          dryRun,
        );
        uploaded += count;
        console.log(
          `${location.name}: ${count} photo${count === 1 ? "" : "s"}`,
        );
      }),
    ),
  );
  const failed = results.filter((result) => result.status === "rejected");

  console.log("Upload complete");
  console.log(`Locations processed: ${rows.length}`);
  console.log(
    `Photos ${dryRun ? "that would be uploaded" : "uploaded"}: ${uploaded}`,
  );
  console.log(`Failed locations: ${failed.length}`);

  for (const failure of failed.slice(0, 5)) {
    console.log(`- ${failure.reason.message}`);
  }
} finally {
  await client.close();
}
