import { defineEventHandler, readBody } from "h3";
import type { EditableLocationFields } from "#shared/types/locations";
import { requireRole } from "../utils/auth.js";
import { generateLocationDescription } from "../utils/location-description.js";

export default defineEventHandler(async (event) => {
  const body = await readBody<Partial<EditableLocationFields>>(event);

  await requireRole(event, ["admin"]);

  return {
    description: await generateLocationDescription(body),
  };
});
