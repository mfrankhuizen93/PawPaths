import { defineEventHandler, getQuery } from "h3";
import type { QueryObject, QueryValue } from "ufo";
import type { LocationsResponse } from "#shared/types/locations";
import { getDb } from "../utils/mongodb.js";
import { inferLocationWarnings } from "../utils/location-warnings.js";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;
const CHARACTERISTIC_POINT_KIND_MAP: Record<string, string[]> = {
  "food and drink": ["cafe"],
  "off-leash area": ["off-leash-area"],
  "swimming water": ["swimming", "water"],
};
const TYPE_POINT_KIND_MAP: Record<string, string[]> = {
  "dog playground": ["dog-playground"],
};

type MongoFilter = Record<string, unknown>;
type PipelineStage = Record<string, unknown>;

type LocationReview = {
  rating?: unknown;
};

type RawLocationItem = {
  reviews?: LocationReview[];
  [key: string]: unknown;
};

function toFiniteNumber(value: QueryValue | QueryValue[]): number | null {
  if (Array.isArray(value)) return toFiniteNumber(value[0]);

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toPositiveNumber(value: QueryValue | QueryValue[]): number | null {
  const number = toFiniteNumber(value);
  return number && number > 0 ? number : null;
}

function toNonNegativeInteger(
  value: QueryValue | QueryValue[],
  fallback = 0,
): number {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}

function toLimitedInteger(value: QueryValue | QueryValue[]): number {
  const number = Number(value);

  if (!Number.isInteger(number) || number < 1) return DEFAULT_LIMIT;

  return Math.min(number, MAX_LIMIT);
}

function toRating(value: QueryValue | QueryValue[]): number | null {
  const number = toFiniteNumber(value);

  if (number === null || number < 1 || number > 5) return null;

  return number;
}

function escapeRegex(value: unknown) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toSearchQuery(value: QueryValue | QueryValue[]) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  return rawValue ? String(rawValue).trim() : "";
}

function asArray(value: QueryValue | QueryValue[]): string[] {
  if (!value) return [];

  const values = Array.isArray(value) ? value : [value];

  return values.flatMap((item) =>
    String(item)
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

function addAndClause(filter: MongoFilter, clause: MongoFilter) {
  filter.$and = [...((filter.$and as MongoFilter[] | undefined) ?? []), clause];
}

function buildFieldOrPointKindClause(
  field: string,
  value: string,
  mappedPointKinds: string[],
): MongoFilter {
  if (mappedPointKinds.length === 0) return { [field]: value };

  return {
    $or: [
      { [field]: value },
      { "coordinatePoints.kind": { $in: mappedPointKinds } },
    ],
  };
}

function buildFilter(query: QueryObject): MongoFilter {
  const filter: MongoFilter = {
    status: "published",
  };

  const types = asArray(query.type).filter(Boolean);
  const excludedTypes = asArray(query.excludeType).filter(Boolean);
  if (types.length > 0) {
    const mappedPointKinds = types.flatMap(
      (type) => TYPE_POINT_KIND_MAP[type] ?? [],
    );

    if (mappedPointKinds.length > 0) {
      addAndClause(filter, {
        $or: [
          { type: { $in: types } },
          { "coordinatePoints.kind": { $in: mappedPointKinds } },
        ],
      });
    } else {
      filter.type = { $in: types };
    }
  }
  if (excludedTypes.length > 0) {
    filter.type = {
      ...((filter.type as MongoFilter | undefined) ?? {}),
      $nin: excludedTypes,
    };
    const mappedPointKinds = excludedTypes.flatMap(
      (type) => TYPE_POINT_KIND_MAP[type] ?? [],
    );

    if (mappedPointKinds.length > 0) {
      addAndClause(filter, {
        "coordinatePoints.kind": { $nin: mappedPointKinds },
      });
    }
  }

  const characteristics = asArray(query.characteristic).filter(Boolean);
  const excludedCharacteristics = asArray(query.excludeCharacteristic).filter(
    Boolean,
  );
  if (characteristics.length > 0) {
    for (const characteristic of characteristics) {
      addAndClause(
        filter,
        buildFieldOrPointKindClause(
          "characteristics",
          characteristic,
          CHARACTERISTIC_POINT_KIND_MAP[characteristic] ?? [],
        ),
      );
    }
  }
  if (excludedCharacteristics.length > 0) {
    filter.characteristics = {
      ...((filter.characteristics as MongoFilter | undefined) ?? {}),
      $nin: excludedCharacteristics,
    };
    const mappedPointKinds = excludedCharacteristics.flatMap(
      (characteristic) => CHARACTERISTIC_POINT_KIND_MAP[characteristic] ?? [],
    );

    if (mappedPointKinds.length > 0) {
      addAndClause(filter, {
        "coordinatePoints.kind": { $nin: mappedPointKinds },
      });
    }
  }

  const searchQuery = toSearchQuery(query.q);
  if (searchQuery) {
    const pattern = new RegExp(escapeRegex(searchQuery), "i");
    filter.$or = [
      { name: pattern },
      { city: pattern },
      { description: pattern },
    ];
  }

  return filter;
}

function getBoundsFilter(query: QueryObject): MongoFilter | null {
  const west = toFiniteNumber(query.west);
  const south = toFiniteNumber(query.south);
  const east = toFiniteNumber(query.east);
  const north = toFiniteNumber(query.north);

  if (west === null || south === null || east === null || north === null) {
    return null;
  }

  if (south < -90 || south > 90 || north < -90 || north > 90) {
    return null;
  }

  if (west < -180 || west > 180 || east < -180 || east > 180) {
    return null;
  }

  if (south > north) {
    return null;
  }

  const makeBoundsPolygon = (minLng: number, maxLng: number): MongoFilter => ({
    location: {
      $geoWithin: {
        $geometry: {
          type: "Polygon",
          coordinates: [
            [
              [minLng, south],
              [maxLng, south],
              [maxLng, north],
              [minLng, north],
              [minLng, south],
            ],
          ],
        },
      },
    },
  });

  if (west <= east) {
    return makeBoundsPolygon(west, east);
  }

  return {
    $or: [makeBoundsPolygon(west, 180), makeBoundsPolygon(-180, east)],
  };
}

function getRatingValuesExpression(): MongoFilter {
  return {
    $filter: {
      input: {
        $map: {
          input: { $ifNull: ["$reviews", []] },
          as: "review",
          in: "$$review.rating",
        },
      },
      as: "rating",
      cond: { $isNumber: "$$rating" },
    },
  };
}

function buildRatingFieldsStage(): PipelineStage {
  const ratingValues = {
    $let: {
      vars: { ratings: getRatingValuesExpression() },
      in: "$$ratings",
    },
  };

  return {
    $set: {
      reviewCount: { $size: { $ifNull: ["$reviews", []] } },
      ratingCount: {
        $let: {
          vars: { ratings: ratingValues },
          in: { $size: "$$ratings" },
        },
      },
      averageRating: {
        $let: {
          vars: { ratings: ratingValues },
          in: {
            $cond: [
              { $gt: [{ $size: "$$ratings" }, 0] },
              { $round: [{ $avg: "$$ratings" }, 1] },
              null,
            ],
          },
        },
      },
    },
  };
}

function buildProjection(includeReviews: boolean): MongoFilter {
  const projection: MongoFilter = {
    _id: 0,
    id: { $toString: "$_id" },
    slug: 1,
    name: 1,
    city: 1,
    province: 1,
    country: 1,
    latitude: 1,
    longitude: 1,
    location: 1,
    type: 1,
    characteristics: 1,
    coordinatePoints: 1,
    warnings: { $ifNull: ["$warnings", []] },
    photos: { $slice: [{ $ifNull: ["$photos", []] }, 1] },
    reviewCount: 1,
    ratingCount: 1,
    averageRating: 1,
  };

  if (!includeReviews) return projection;

  return {
    ...projection,
    sourceUrl: 1,
    description: 1,
    relatedUrls: 1,
    photos: 1,
    status: 1,
    source: 1,
    createdAt: 1,
    updatedAt: 1,
    reviews: 1,
  };
}

function buildSearchScoreStage(searchQuery: string): PipelineStage {
  const escapedQuery = escapeRegex(searchQuery);

  const getRegexScore = (field: string, regex: string, score: number) => ({
    $cond: [
      {
        $regexMatch: {
          input: { $ifNull: [`$${field}`, ""] },
          regex,
          options: "i",
        },
      },
      score,
      0,
    ],
  });

  return {
    $set: {
      searchScore: {
        $add: [
          getRegexScore("name", `^${escapedQuery}$`, 120),
          getRegexScore("name", `^${escapedQuery}`, 80),
          getRegexScore("name", escapedQuery, 60),
          getRegexScore("city", `^${escapedQuery}$`, 50),
          getRegexScore("city", `^${escapedQuery}`, 40),
          getRegexScore("city", escapedQuery, 30),
          getRegexScore("description", escapedQuery, 10),
        ],
      },
    },
  };
}

function normalizeWarnings(
  items: RawLocationItem[],
  includeReviews: boolean,
): LocationsResponse["items"] {
  return items.map((item) => {
    const warnings = inferLocationWarnings(item.reviews);

    if (includeReviews) {
      return {
        ...item,
        warnings,
      } as LocationsResponse["items"][number];
    }

    const { reviews, ...location } = item;

    return {
      ...location,
      warnings,
    } as LocationsResponse["items"][number];
  });
}

export default defineEventHandler(async (event): Promise<LocationsResponse> => {
  const query = getQuery(event);
  const db = await getDb();
  const locations = db.collection("locations");

  const filter = buildFilter(query);
  const searchQuery = toSearchQuery(query.q);
  const limit = toLimitedInteger(query.limit);
  const skip = toNonNegativeInteger(query.skip);
  const includeReviews = query.includeReviews === "true";
  const lat = toFiniteNumber(query.lat);
  const lng = toFiniteNumber(query.lng);
  const radiusKm = toPositiveNumber(query.radiusKm);
  const boundsFilter = getBoundsFilter(query);
  const isGeoSearch =
    !boundsFilter && lat !== null && lng !== null && radiusKm !== null;
  const minRating = toRating(query.minRating);
  const projection = buildProjection(includeReviews);
  const ratingFieldsStage = buildRatingFieldsStage();

  const pipeline: PipelineStage[] = [];
  const countPipeline: PipelineStage[] = [];

  if (boundsFilter) {
    const boundedFilter = {
      $and: [filter, boundsFilter],
    };

    pipeline.push({ $match: boundedFilter });
    countPipeline.push({ $match: boundedFilter });
  } else if (isGeoSearch) {
    const geoNearStage = {
      $geoNear: {
        near: {
          type: "Point",
          coordinates: [lng, lat],
        },
        distanceField: "distanceMeters",
        maxDistance: radiusKm * 1000,
        spherical: true,
        query: filter,
      },
    };

    pipeline.push(geoNearStage);
    countPipeline.push(geoNearStage);
  } else {
    pipeline.push({ $match: filter });
    countPipeline.push({ $match: filter });
  }

  pipeline.push(ratingFieldsStage);
  countPipeline.push(ratingFieldsStage);

  if (minRating !== null) {
    pipeline.push({ $match: { averageRating: { $gte: minRating } } });
    countPipeline.push({ $match: { averageRating: { $gte: minRating } } });
  }

  if (searchQuery) {
    pipeline.push(buildSearchScoreStage(searchQuery));
    pipeline.push({
      $sort: {
        searchScore: -1,
        reviewCount: -1,
        averageRating: -1,
        ratingCount: -1,
        name: 1,
      },
    });
  } else {
    pipeline.push({
      $sort: {
        reviewCount: -1,
        averageRating: -1,
        ratingCount: -1,
        name: 1,
      },
    });
  }

  pipeline.push({ $skip: skip });
  pipeline.push({ $limit: limit });
  pipeline.push({ $project: projection });
  countPipeline.push({ $count: "total" });

  const [rawItems, countResult] = await Promise.all([
    locations.aggregate(pipeline).toArray(),
    locations.aggregate(countPipeline).toArray(),
  ]);
  const total = countResult[0]?.total ?? 0;
  const items = normalizeWarnings(rawItems, includeReviews);

  return {
    items,
    total,
    limit,
    skip,
  };
});
