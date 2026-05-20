import { createError, defineEventHandler, getRouterParam, readBody } from "h3";
import { requireCurrentUser } from "../../../utils/auth.js";
import { getDb } from "../../../utils/mongodb.js";

function cleanText(value: unknown, maxLength = 2000) {
  if (typeof value !== "string") return "";

  return value.trim().slice(0, maxLength);
}

function cleanRating(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const rating = Number(value);

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw createError({
      statusCode: 400,
      statusMessage: "Rating must be between 1 and 5.",
    });
  }

  return Math.round(rating);
}

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");

  if (!slug) {
    throw createError({
      statusCode: 404,
      statusMessage: "Location not found.",
    });
  }

  const user = await requireCurrentUser(event);
  const body = await readBody(event);
  const text = cleanText(body?.text);
  const rating = cleanRating(body?.rating);

  if (!text) {
    throw createError({
      statusCode: 400,
      statusMessage: "Review text is required.",
    });
  }

  const now = new Date();
  const review = {
    reviewer: user.name,
    reviewerName: user.name,
    userId: user.id,
    date: now,
    dateText: now.toISOString().slice(0, 10),
    rating,
    text,
    source: "community",
  };
  const db = await getDb();
  const result = await db.collection("locations").updateOne(
    { slug, status: "published" },
    {
      $push: { reviews: review },
      $set: { updatedAt: now },
    },
  );

  if (result.matchedCount === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: "Location not found.",
    });
  }

  return { review };
});
