import { createError, defineEventHandler, getRouterParam, readBody } from "h3";
import { requireRole } from "../../utils/auth.js";
import { reviewContribution } from "../../utils/location-contributions.js";
import { getDb } from "../../utils/mongodb.js";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 404,
      statusMessage: "Contribution not found.",
    });
  }

  const reviewer = await requireRole(event, ["maintainer", "admin"]);
  const body = await readBody(event);
  const action = body?.action;

  if (action !== "approve" && action !== "reject" && action !== "save") {
    throw createError({
      statusCode: 400,
      statusMessage: "Choose approve, reject, or save.",
    });
  }

  return {
    contribution: await reviewContribution({
      db: await getDb(),
      id,
      reviewer,
      action,
      note: body?.note,
      payload:
        action === "approve" || action === "save" ? body?.payload : undefined,
    }),
  };
});
