import { createError, defineEventHandler, getRouterParam } from "h3";
import type { LocationDetail } from "#shared/types/locations";
import { getLocationSlug } from "#shared/utils/location-route";
import { inferLocationWarnings } from "../../utils/location-warnings.js";
import { getDb } from "../../utils/mongodb.js";

type RawLocationDetail = LocationDetail & {
  reviews?: LocationDetail["reviews"];
};

function getRatingValuesExpression() {
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

function buildRatingFieldsStage() {
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

function buildProjection() {
  return {
    _id: 0,
    id: { $toString: "$_id" },
    sourceUrl: 1,
    name: 1,
    city: 1,
    province: 1,
    country: 1,
    latitude: 1,
    longitude: 1,
    type: 1,
    characteristics: 1,
    warnings: { $ifNull: ["$warnings", []] },
    description: 1,
    relatedUrls: 1,
    photos: 1,
    reviewCount: 1,
    ratingCount: 1,
    averageRating: 1,
    reviews: 1,
  };
}

export default defineEventHandler(async (event): Promise<LocationDetail> => {
  const slug = getRouterParam(event, "slug");

  if (!slug) {
    throw createError({
      statusCode: 404,
      statusMessage: "Location not found",
    });
  }

  const db = await getDb();
  const locations = db.collection("locations");
  const rawLocations = (await locations
    .aggregate([
      { $match: { status: "published" } },
      buildRatingFieldsStage(),
      { $sort: { name: 1 } },
      { $project: buildProjection() },
    ])
    .toArray()) as RawLocationDetail[];
  const location = rawLocations.find(
    (item) => getLocationSlug(item.name) === slug,
  );

  if (!location) {
    throw createError({
      statusCode: 404,
      statusMessage: "Location not found",
    });
  }

  return {
    ...location,
    warnings: inferLocationWarnings(location.reviews),
  };
});
