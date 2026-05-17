import { defineEventHandler } from "h3";
import { getCurrentUser } from "../../utils/auth.js";

export default defineEventHandler(async (event) => {
  const user = await getCurrentUser(event);

  return { user };
});
