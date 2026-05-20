import { defineEventHandler, readBody } from "h3";
import { requireCurrentUser } from "../utils/auth.js";
import {
  createLocationContribution,
  sanitizeLocationPayload,
} from "../utils/location-contributions.js";
import { getDb } from "../utils/mongodb.js";

export default defineEventHandler(async (event) => {
  const user = await requireCurrentUser(event);
  const payload = sanitizeLocationPayload(await readBody(event));
  const db = await getDb();
  const contribution = await createLocationContribution({
    db,
    user,
    kind: "new-location",
    payload,
  });

  return { contribution };
});
