import { type Collection, type Db, ObjectId } from "mongodb";
import { createError } from "h3";
import type {
  EditableLocationFields,
  LocationContribution,
  LocationContributionKind,
  LocationContributionStatus,
  LocationCoordinateKind,
  LocationCoordinatePoint,
  LocationPhoto,
  LocationRelatedUrl,
} from "#shared/types/locations";
import { getLocationSlug } from "#shared/utils/location-route";
import type { AuthUser } from "#shared/types/auth";

type ContributionDocument = {
  _id?: ObjectId;
  kind: LocationContributionKind;
  status: LocationContributionStatus;
  locationId?: ObjectId | null;
  locationSlug?: string | null;
  locationName?: string | null;
  payload: EditableLocationFields;
  submitter: {
    id: string;
    name: string;
    email: string;
  };
  reviewer?: {
    id: string;
    name: string;
    email: string;
  } | null;
  reviewNote?: string | null;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt?: Date | null;
};

type LocationDocument = EditableLocationFields & {
  _id?: ObjectId;
  slug: string;
  status: string;
  location?: {
    type: "Point";
    coordinates: [number, number];
  } | null;
  source?: string;
  photos?: unknown[];
  reviews?: unknown[];
  warnings?: string[];
  createdAt?: Date;
  updatedAt?: Date;
};

const LOCATION_TYPES = new Set([
  "park",
  "nature reserve",
  "dog playground",
  "beach",
]);

const CHARACTERISTICS = new Set([
  "off-leash area",
  "fenced",
  "food and drink",
  "horse trails",
  "mountain bike trails",
  "swimming water",
  "walking trails",
  "wheelchair accessible",
]);

const COORDINATE_KINDS = new Set<LocationCoordinateKind>([
  "general",
  "parking",
  "poi",
  "entrance",
  "other",
]);

function cleanText(value: unknown, maxLength = 200) {
  if (typeof value !== "string") return "";

  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function cleanLongText(value: unknown, maxLength = 3000) {
  if (typeof value !== "string") return "";

  return value.trim().slice(0, maxLength);
}

function cleanNumber(value: unknown, min: number, max: number) {
  if (value === null || value === undefined || value === "") return null;

  const number = Number(value);

  if (!Number.isFinite(number) || number < min || number > max) return null;

  return number;
}

function cleanList(value: unknown, allowed: Set<string>) {
  const values = Array.isArray(value) ? value : [];

  return Array.from(
    new Set(
      values
        .map((item) => cleanText(item, 80).toLowerCase())
        .filter((item) => allowed.has(item)),
    ),
  );
}

function cleanRelatedUrls(value: unknown): LocationRelatedUrl[] {
  const values = Array.isArray(value) ? value : [];

  return values
    .map((item) => {
      const label = cleanText(
        typeof item === "object" && item
          ? (item as { label?: unknown }).label
          : "",
        80,
      );
      const rawUrl = cleanText(
        typeof item === "object" && item ? (item as { url?: unknown }).url : "",
        500,
      );

      try {
        const url = new URL(rawUrl);

        if (!["http:", "https:"].includes(url.protocol)) return null;

        return {
          label: label || url.hostname,
          url: url.toString(),
        };
      } catch {
        return null;
      }
    })
    .filter((item): item is LocationRelatedUrl => Boolean(item))
    .slice(0, 5);
}

function cleanPhotos(value: unknown): LocationPhoto[] {
  const values = Array.isArray(value) ? value : [];

  return values
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const photo = item as Record<string, unknown>;
      const url = cleanText(photo.url, 2_000_000);
      const alt = cleanText(photo.alt, 160) || null;
      const width = Number(photo.width);
      const height = Number(photo.height);

      if (
        !url.startsWith("data:image/") &&
        !url.startsWith("https://") &&
        !url.startsWith("http://")
      ) {
        return null;
      }

      return {
        url,
        alt,
        width: Number.isFinite(width) && width > 0 ? width : null,
        height: Number.isFinite(height) && height > 0 ? height : null,
      };
    })
    .filter((item): item is LocationPhoto => Boolean(item))
    .slice(0, 4);
}

function cleanCoordinatePoints(value: unknown): LocationCoordinatePoint[] {
  const values = Array.isArray(value) ? value : [];

  return values
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const point = item as Record<string, unknown>;
      const latitude = cleanNumber(point.latitude, -90, 90);
      const longitude = cleanNumber(point.longitude, -180, 180);
      const kindValue = cleanText(point.kind, 40) as LocationCoordinateKind;
      const kind = COORDINATE_KINDS.has(kindValue) ? kindValue : "other";
      const fallbackLabel =
        kind === "parking"
          ? "Parking location"
          : kind === "poi"
            ? "POI"
            : kind === "entrance"
              ? "Entrance"
              : "Point";
      const label = cleanText(point.label, 120) || fallbackLabel;

      if (latitude === null || longitude === null) return null;

      return {
        id: cleanText(point.id, 80) || null,
        kind,
        label,
        latitude,
        longitude,
      };
    })
    .filter((item): item is LocationCoordinatePoint => Boolean(item))
    .slice(0, 8);
}

export function sanitizeLocationPayload(body: unknown): EditableLocationFields {
  const input =
    typeof body === "object" && body ? (body as Record<string, unknown>) : {};
  const name = cleanText(input.name, 120);
  const city = cleanText(input.city, 120) || null;
  const province = cleanText(input.province, 120) || null;
  const country = cleanText(input.country, 120) || "Netherlands";
  const latitude = cleanNumber(input.latitude, -90, 90);
  const longitude = cleanNumber(input.longitude, -180, 180);
  const type = cleanList(input.type, LOCATION_TYPES);
  const characteristics = cleanList(input.characteristics, CHARACTERISTICS);
  const description = cleanLongText(input.description) || null;
  const relatedUrls = cleanRelatedUrls(input.relatedUrls);
  const photos = Array.isArray(input.photos)
    ? cleanPhotos(input.photos)
    : undefined;
  const coordinatePoints = cleanCoordinatePoints(input.coordinatePoints);

  if (!name) {
    throw createError({
      statusCode: 400,
      statusMessage: "Location name is required.",
    });
  }

  if (!city) {
    throw createError({
      statusCode: 400,
      statusMessage: "City is required.",
    });
  }

  if (latitude === null || longitude === null) {
    throw createError({
      statusCode: 400,
      statusMessage: "Choose a general location on the map.",
    });
  }

  return {
    name,
    city,
    province,
    country,
    latitude,
    longitude,
    type,
    characteristics,
    description,
    relatedUrls,
    coordinatePoints,
    ...(photos ? { photos } : {}),
  };
}

function getUserSummary(user: AuthUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
}

function toObjectId(id: string) {
  if (!ObjectId.isValid(id)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid contribution id.",
    });
  }

  return new ObjectId(id);
}

function toContribution(document: ContributionDocument): LocationContribution {
  return {
    id: document._id?.toString() ?? "",
    kind: document.kind,
    status: document.status,
    locationId: document.locationId?.toString() ?? null,
    locationSlug: document.locationSlug ?? null,
    locationName: document.locationName ?? null,
    payload: document.payload,
    submitter: document.submitter,
    reviewer: document.reviewer ?? null,
    reviewNote: document.reviewNote ?? null,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    reviewedAt: document.reviewedAt?.toISOString() ?? null,
  };
}

export async function getContributionsCollection(db: Db) {
  const contributions = db.collection<ContributionDocument>("contributions");
  await Promise.all([
    contributions.createIndex({ status: 1, createdAt: -1 }),
    contributions.createIndex({ locationId: 1, status: 1 }),
    contributions.createIndex({ "submitter.id": 1, createdAt: -1 }),
  ]);

  return contributions;
}

export async function createLocationContribution(options: {
  db: Db;
  user: AuthUser;
  kind: LocationContributionKind;
  payload: EditableLocationFields;
  location?: LocationDocument;
}) {
  const contributions = await getContributionsCollection(options.db);
  const now = new Date();
  const document: ContributionDocument = {
    kind: options.kind,
    status: "pending",
    locationId: options.location?._id ?? null,
    locationSlug: options.location?.slug ?? null,
    locationName: options.location?.name ?? options.payload.name,
    payload: options.payload,
    submitter: getUserSummary(options.user),
    reviewer: null,
    reviewNote: null,
    createdAt: now,
    updatedAt: now,
    reviewedAt: null,
  };
  const result = await contributions.insertOne(document);

  return toContribution({ ...document, _id: result.insertedId });
}

function buildGeoPoint(payload: EditableLocationFields) {
  if (
    Number.isFinite(payload.longitude) &&
    Number.isFinite(payload.latitude) &&
    payload.longitude !== null &&
    payload.latitude !== null
  ) {
    return {
      type: "Point" as const,
      coordinates: [payload.longitude, payload.latitude] as [number, number],
    };
  }

  return null;
}

async function getAvailableSlug(
  locations: Collection<LocationDocument>,
  payload: EditableLocationFields,
) {
  const baseSlug = getLocationSlug(payload) || getLocationSlug(payload.name);
  let slug = baseSlug;
  let suffix = 2;

  while (await locations.findOne({ slug }, { projection: { _id: 1 } })) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

async function approveContribution(db: Db, contribution: ContributionDocument) {
  const locations = db.collection<LocationDocument>("locations");
  const now = new Date();
  const location = buildGeoPoint(contribution.payload);

  if (contribution.kind === "new-location") {
    const slug = await getAvailableSlug(locations, contribution.payload);

    await locations.insertOne({
      ...contribution.payload,
      slug,
      status: "published",
      location,
      source: "community",
      photos: contribution.payload.photos ?? [],
      reviews: [],
      warnings: [],
      createdAt: now,
      updatedAt: now,
    });

    return;
  }

  if (!contribution.locationId) {
    throw createError({
      statusCode: 400,
      statusMessage: "This change is missing its location.",
    });
  }

  const result = await locations.updateOne(
    { _id: contribution.locationId, status: "published" },
    {
      $set: {
        ...contribution.payload,
        location,
        updatedAt: now,
      },
    },
  );

  if (result.matchedCount === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: "Location not found.",
    });
  }
}

export async function listPendingContributions(db: Db) {
  const contributions = await getContributionsCollection(db);
  const documents = await contributions
    .find({ status: "pending" })
    .sort({ createdAt: 1 })
    .toArray();

  return documents.map(toContribution);
}

export async function reviewContribution(options: {
  db: Db;
  id: string;
  reviewer: AuthUser;
  action: "approve" | "reject";
  note?: unknown;
}) {
  const contributions = await getContributionsCollection(options.db);
  const _id = toObjectId(options.id);
  const contribution = await contributions.findOne({ _id });

  if (!contribution) {
    throw createError({
      statusCode: 404,
      statusMessage: "Contribution not found.",
    });
  }

  if (contribution.status !== "pending") {
    throw createError({
      statusCode: 400,
      statusMessage: "This contribution has already been reviewed.",
    });
  }

  if (
    options.reviewer.role !== "admin" &&
    contribution.submitter.id === options.reviewer.id
  ) {
    throw createError({
      statusCode: 403,
      statusMessage: "Another maintainer needs to review your contribution.",
    });
  }

  if (options.action === "approve") {
    await approveContribution(options.db, contribution);
  }

  const now = new Date();
  const status = options.action === "approve" ? "approved" : "rejected";
  const result = await contributions.findOneAndUpdate(
    { _id },
    {
      $set: {
        status,
        reviewer: getUserSummary(options.reviewer),
        reviewNote: cleanLongText(options.note, 1000) || null,
        reviewedAt: now,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );

  if (!result) {
    throw createError({
      statusCode: 404,
      statusMessage: "Contribution not found.",
    });
  }

  return toContribution(result);
}
