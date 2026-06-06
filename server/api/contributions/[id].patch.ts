import { createError, defineEventHandler, getRouterParam, readBody } from "h3";
import { requireRole } from "../../utils/auth.js";
import { reviewContribution } from "../../utils/location-contributions.js";
import { getDb } from "../../utils/mongodb.js";

const REVIEW_TIMEOUT_MS = 10_000;

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
              statusMessage: `Review timed out while ${step}.`,
            }),
          );
        }, REVIEW_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 404,
      statusMessage: "Contribution not found.",
    });
  }

  const body = await withStepTimeout("reading the review request", () =>
    readBody(event),
  );
  const reviewer = await withStepTimeout("checking your session", () =>
    requireRole(event, ["maintainer", "admin"]),
  );
  const action = body?.action;

  if (action !== "approve" && action !== "reject" && action !== "save") {
    throw createError({
      statusCode: 400,
      statusMessage: "Choose approve, reject, or save.",
    });
  }

  const db = await withStepTimeout("connecting to the database", () => getDb());
  const contribution = await withStepTimeout(
    `${action === "approve" ? "approving" : action === "reject" ? "rejecting" : "saving"} the contribution`,
    () =>
      reviewContribution({
        db,
        id,
        reviewer,
        action,
        note: body?.note,
        payload:
          action === "approve" || action === "save" ? body?.payload : undefined,
      }),
  );

  if (action !== "save") {
    return {
      contribution: {
        id: contribution.id,
        status: contribution.status,
        locationId: contribution.locationId,
        locationSlug: contribution.locationSlug,
        locationName: contribution.locationName,
      },
    };
  }

  return { contribution };
});
