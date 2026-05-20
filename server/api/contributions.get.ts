import { defineEventHandler } from "h3";
import { requireRole } from "../utils/auth.js";
import { listPendingContributions } from "../utils/location-contributions.js";
import { getDb } from "../utils/mongodb.js";

export default defineEventHandler(async (event) => {
  await requireRole(event, ["maintainer", "admin"]);

  return {
    contributions: await listPendingContributions(await getDb()),
  };
});
