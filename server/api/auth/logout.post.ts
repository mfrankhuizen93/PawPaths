import { defineEventHandler } from "h3";
import { clearUserSession } from "../../utils/auth.js";

export default defineEventHandler(async (event) => {
  await clearUserSession(event);

  return { ok: true };
});
