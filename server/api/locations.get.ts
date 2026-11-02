import { defineEventHandler, getQuery, setHeader } from "h3";
import { ObjectId } from "mongodb";
import type { QueryObject, QueryValue } from "ufo";
import type { LocationsResponse } from "#shared/types/locations";
import { getDb } from "../utils/mongodb.js";
import { inferLocationWarnings } from "../utils/location-warnings.js";
import { readLocationSearch } from "#shared/utils/location-search";
import { buildLocationSearchFilter } from "../utils/location-search-filter";
import { normalizeAreaAttributes } from "#shared/utils/location-contract";

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;
const MAX_VIEWPORT_LIMIT = 1000;
type MongoFilter = Record<string, unknown>;
type PipelineStage = Record<string, unknown>;

type LocationReview = {
  rating?: unknown;
};

type RawLocationItem = {
  _id?: ObjectId;
  searchScore?: number;
  reviewCount?: number;
  ratingCount?: number;
  averageRatingSort?: number;
  name?: string;
  reviews?: LocationReview[];
  [key: string]: unknown;
};

type LocationCursor = {
  searchScore?: number;
  reviewCount: number;
  averageRatingSort: number;
  ratingCount: number;
  name: string;
  id: string;
};

function toFiniteNumber(value: QueryValue | QueryValue[]): number | null {
  if (Array.isArray(value)) return toFiniteNumber(value[0]);

  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toPositiveInteger(
  value: QueryValue | QueryValue[],
  fallback = 1,
): number {
  const number = Number(value);

  return Number.isInteger(number) && number >= 1 ? number : fallback;
}

function toLimitedInteger(
  value: QueryValue | QueryValue[],
  max = MAX_LIMIT,
): number {
  const number = Number(value);

  if (!Number.isInteger(number) || number < 1) return DEFAULT_LIMIT;

  return Math.min(number, max);
}

function clampLatitude(latitude: number) {
  return Math.max(-90, Math.min(90, latitude));
}

function normalizeLongitude(longitude: number) {
  return ((((longitude + 180) % 360) + 360) % 360) - 180;
}

function escapeRegex(value: unknown) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toCursor(value: QueryValue | QueryValue[]): LocationCursor | null {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (!rawValue) return null;

  try {
    const parsedValue = JSON.parse(
      Buffer.from(String(rawValue), "base64url").toString("utf8"),
    ) as Partial<LocationCursor>;

    if (
      typeof parsedValue.reviewCount !== "number" ||
      typeof parsedValue.averageRatingSort !== "number" ||
      typeof parsedValue.ratingCount !== "number" ||
      typeof parsedValue.name !== "string" ||
      typeof parsedValue.id !== "string" ||
      !ObjectId.isValid(parsedValue.id)
    ) {
      return null;
    }

    if (
      parsedValue.searchScore !== undefined &&
      typeof parsedValue.searchScore !== "number"
    ) {
      return null;
    }

    return {
      searchScore: parsedValue.searchScore,
      reviewCount: parsedValue.reviewCount,
      averageRatingSort: parsedValue.averageRatingSort,
      ratingCount: parsedValue.ratingCount,
      name: parsedValue.name,
      id: parsedValue.id,
    };
  } catch {
    return null;
  }
}

function toNextCursor(
  item: RawLocationItem | undefined,
  includeSearchScore: boolean,
) {
  if (!item?._id) return null;

  const cursor: LocationCursor = {
    reviewCount: Number(item.reviewCount ?? 0),
    averageRatingSort: Number(item.averageRatingSort ?? -1),
    ratingCount: Number(item.ratingCount ?? 0),
    name: String(item.name ?? ""),
    id: item._id.toHexString(),
  };

  if (includeSearchScore) {
    cursor.searchScore = Number(item.searchScore ?? 0);
  }

  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function getBoundsFilter(
  query: QueryObject,
  options: { includeCoordinatePoints?: boolean } = {},
): MongoFilter | null {
  const includeCoordinatePoints = options.includeCoordinatePoints ?? true;
  const rawWest = toFiniteNumber(query.west);
  const rawSouth = toFiniteNumber(query.south);
  const rawEast = toFiniteNumber(query.east);
  const rawNorth = toFiniteNumber(query.north);

  if (
    rawWest === null ||
    rawSouth === null ||
    rawEast === null ||
    rawNorth === null
  ) {
    return null;
  }

  const south = clampLatitude(rawSouth);
  const north = clampLatitude(rawNorth);
  const longitudeSpan = Math.abs(rawEast - rawWest);
  const west = longitudeSpan >= 360 ? -180 : normalizeLongitude(rawWest);
  const east = longitudeSpan >= 360 ? 180 : normalizeLongitude(rawEast);

  if (south > north) {
    return null;
  }

  const makeMainLocationBoundsClause = (
    minLng: number,
    maxLng: number,
  ): MongoFilter => ({
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

  const makeCoordinatePointBoundsClause = (
    minLng: number,
    maxLng: number,
  ): MongoFilter => ({
    coordinatePoints: {
      $elemMatch: {
        latitude: { $gte: south, $lte: north },
        longitude: { $gte: minLng, $lte: maxLng },
      },
    },
  });

  const makeBoundsClause = (minLng: number, maxLng: number): MongoFilter =>
    includeCoordinatePoints
      ? {
          $or: [
            makeMainLocationBoundsClause(minLng, maxLng),
            makeCoordinatePointBoundsClause(minLng, maxLng),
          ],
        }
      : makeMainLocationBoundsClause(minLng, maxLng);

  if (west <= east) {
    return makeBoundsClause(west, east);
  }

  return {
    $or: [makeBoundsClause(west, 180), makeBoundsClause(-180, east)],
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
      averageRatingSort: {
        $let: {
          vars: { ratings: ratingValues },
          in: {
            $cond: [
              { $gt: [{ $size: "$$ratings" }, 0] },
              { $round: [{ $avg: "$$ratings" }, 1] },
              -1,
            ],
          },
        },
      },
    },
  };
}

function buildProjection(options: { compact?: boolean } = {}): MongoFilter {
  const sharedProjection: MongoFilter = {
    _id: 1,
    id: { $toString: "$_id" },
    averageRatingSort: 1,
    searchScore: 1,
    slug: 1,
    name: 1,
    city: 1,
    country: 1,
    latitude: 1,
    longitude: 1,
    type: 1,
    characteristics: 1,
    coordinatePoints: 1,
    attributes: 1,
    routes: 1,
    distanceMeters: 1,
    warnings: { $ifNull: ["$warnings", []] },
    reviewCount: 1,
    ratingCount: 1,
    averageRating: 1,
  };

  if (options.compact) {
    return {
      ...sharedProjection,
      photos: { $literal: [] },
    };
  }

  return {
    ...sharedProjection,
    sourceUrl: 1,
    province: 1,
    location: 1,
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

function buildCursorMatchStage(
  cursor: LocationCursor,
  includeSearchScore: boolean,
): PipelineStage {
  const fields = [
    ...(includeSearchScore
      ? [
          {
            expression: "$searchScore",
            value: cursor.searchScore ?? 0,
            direction: "desc" as const,
          },
        ]
      : []),
    {
      expression: "$reviewCount",
      value: cursor.reviewCount,
      direction: "desc" as const,
    },
    {
      expression: "$averageRatingSort",
      value: cursor.averageRatingSort,
      direction: "desc" as const,
    },
    {
      expression: "$ratingCount",
      value: cursor.ratingCount,
      direction: "desc" as const,
    },
    { expression: "$name", value: cursor.name, direction: "asc" as const },
    {
      expression: "$_id",
      value: new ObjectId(cursor.id),
      direction: "asc" as const,
    },
  ];

  return {
    $match: {
      $expr: {
        $or: fields.map((field, index) => ({
          $and: [
            ...fields.slice(0, index).map((previous) => ({
              $eq: [previous.expression, previous.value],
            })),
            {
              [field.direction === "desc" ? "$lt" : "$gt"]: [
                field.expression,
                field.value,
              ],
            },
          ],
        })),
      },
    },
  };
}

function normalizeWarnings(
  items: RawLocationItem[],
  includeReviews: boolean,
): LocationsResponse["items"] {
  return items.map((item) => {
    const inferredWarnings = inferLocationWarnings(item.reviews);
    const warnings =
      inferredWarnings.length > 0
        ? inferredWarnings
        : Array.isArray(item.warnings)
          ? item.warnings
          : [];
    const { _id, averageRatingSort, searchScore, ...rawPublicItem } = item;
    const publicItem = {
      ...rawPublicItem,
      coordinatePoints: item.coordinatePoints ?? [],
      attributes: normalizeAreaAttributes(
        item.attributes,
        item.characteristics as string[] | undefined,
      ),
      routes: item.routes ?? [],
    };

    void _id;
    void averageRatingSort;
    void searchScore;

    if (includeReviews) {
      return {
        ...publicItem,
        warnings,
      } as LocationsResponse["items"][number];
    }

    const { reviews, ...location } = publicItem;

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

  const search = readLocationSearch(query);
  const filter = buildLocationSearchFilter(search.filters);
  const searchQuery = search.filters.q ?? "";
  const boundsFilter = getBoundsFilter(search.bounds ?? {}, {
    includeCoordinatePoints: false,
  });
  const isViewportSearch = query.viewport === "true" && Boolean(boundsFilter);
  if (isViewportSearch) {
    setHeader(event, "Cache-Control", "no-store");
  }
  const limit = toLimitedInteger(
    query.limit,
    isViewportSearch ? MAX_VIEWPORT_LIMIT : MAX_LIMIT,
  );
  const cursor = isViewportSearch ? null : toCursor(query.cursor);
  const pageNumber = toPositiveInteger(query.pageNumber);
  const includeReviews = query.includeReviews === "true";
  const lat = search.filters.lat;
  const lng = search.filters.lng;
  const radiusKm = search.filters.radiusKm;
  const isGeoSearch =
    lat !== undefined && lng !== undefined && radiusKm !== undefined;
  const minRating = search.filters.minRating ?? null;
  const projection = buildProjection({ compact: isViewportSearch });
  const ratingFieldsStage = buildRatingFieldsStage();

  const pipeline: PipelineStage[] = [];
  const countPipeline: PipelineStage[] = [];

  if (boundsFilter && !isGeoSearch) {
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
        query: boundsFilter ? { $and: [filter, boundsFilter] } : filter,
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
  }

  if (cursor) {
    pipeline.push(buildCursorMatchStage(cursor, Boolean(searchQuery)));
  }

  pipeline.push({
    $sort: {
      ...(searchQuery ? { searchScore: -1 } : {}),
      reviewCount: -1,
      averageRatingSort: -1,
      ratingCount: -1,
      name: 1,
      _id: 1,
    },
  });

  pipeline.push({ $limit: limit + 1 });
  pipeline.push({ $project: projection });
  countPipeline.push({ $count: "total" });

  const [rawItems, countResult] = await Promise.all([
    locations.aggregate(pipeline).toArray(),
    isViewportSearch
      ? Promise.resolve([])
      : locations.aggregate(countPipeline).toArray(),
  ]);
  const isTruncated = rawItems.length > limit;
  const pageItems = rawItems.slice(0, limit);
  const items = normalizeWarnings(pageItems, includeReviews);
  const total = isViewportSearch ? items.length : (countResult[0]?.total ?? 0);
  const nextCursor =
    !isViewportSearch && isTruncated
      ? toNextCursor(pageItems.at(-1), Boolean(searchQuery))
      : null;

  return {
    items,
    total,
    limit,
    nextCursor,
    metadata: {
      pageNumber,
      pageSize: limit,
      totalFound: total,
      resultCount: items.length,
      truncated: isViewportSearch ? isTruncated : false,
    },
  };
});
