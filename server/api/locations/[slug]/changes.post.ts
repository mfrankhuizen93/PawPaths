import { createError, defineEventHandler, getRouterParam, readBody } from "h3";
import { requireCurrentUser } from "../../../utils/auth.js";
import {
  createLocationContribution,
  sanitizeLocationPayload,
} from "../../../utils/location-contributions.js";
import { getDb } from "../../../utils/mongodb.js";

const SUBMISSION_TIMEOUT_MS = 10_000;

async function withStepTimeout<T>(step: string, task: () => Promise<T>) {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      task(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(
            createError({
              statusCode: 504,
              statusMessage: `Saving timed out while ${step}.`,
            }),
          );
        }, SUBMISSION_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, "slug");

  if (!slug) {
    throw createError({
      statusCode: 404,
      statusMessage: "Location not found.",
    });
  }

  const body = await withStepTimeout("reading the location details", () =>
    readBody(event),
  );
  const user = await withStepTimeout("checking your session", () =>
    requireCurrentUser(event),
  );
  const payload = sanitizeLocationPayload(body);
  const db = await withStepTimeout("connecting to the database", () => getDb());
  const location = await withStepTimeout("finding the location", () =>
    db.collection("locations").findOne({ slug, status: "published" }),
  );

  if (!location) {
    throw createError({
      statusCode: 404,
      statusMessage: "Location not found.",
    });
  }

  const contribution = await withStepTimeout("saving the change", () =>
    createLocationContribution({
      db,
      user,
      kind: "location-change",
      payload,
      location,
    }),
  );

  return { contribution };
});
