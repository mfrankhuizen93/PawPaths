import { createError, defineEventHandler, getRouterParam, readBody } from "h3";
import { requireCurrentUser } from "../../../utils/auth.js";
import {
  createLocationContribution,
  sanitizeLocationPayload,
} from "../../../utils/location-contributions.js";
import { getDb } from "../../../utils/mongodb.js";

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");

  if (!slug) {
    throw createError({
      statusCode: 404,
      statusMessage: "Location not found.",
    });
  }

  const user = await requireCurrentUser(event);
  const payload = sanitizeLocationPayload(await readBody(event));
  const db = await getDb();
  const location = await db
    .collection("locations")
    .findOne({ slug, status: "published" });

  if (!location) {
    throw createError({
      statusCode: 404,
      statusMessage: "Location not found.",
    });
  }

  const contribution = await createLocationContribution({
    db,
    user,
    kind: "location-change",
    payload,
    location,
  });

  return { contribution };
});
