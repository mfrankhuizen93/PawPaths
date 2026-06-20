import { createError, defineEventHandler, getRouterParam } from "h3";
import { requireRole } from "../../utils/auth.js";
import { getDb } from "../../utils/mongodb.js";

export default defineEventHandler(async (event) => {
  await requireRole(event, ["admin"]);

  const slug = getRouterParam(event, "slug");
  if (!slug) {
    throw createError({
      statusCode: 404,
      statusMessage: "Location not found.",
    });
  }

  const db = await getDb();
  const result = await db
    .collection("locations")
    .deleteOne({ slug, status: "published" });

  if (!result.deletedCount) {
    throw createError({
      statusCode: 404,
      statusMessage: "Location not found.",
    });
  }

  return { deleted: true };
});
