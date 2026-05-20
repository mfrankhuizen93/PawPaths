import { defineEventHandler, readBody } from "h3";
import { updateUserRole } from "../../../utils/auth.js";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const id = event.context.params?.id ?? "";

  return { user: await updateUserRole(event, id, body?.role) };
});
