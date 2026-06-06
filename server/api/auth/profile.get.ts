import { defineEventHandler } from "h3";
import { requireCurrentUser } from "../../utils/auth.js";

export default defineEventHandler(async (event) => ({
  user: await requireCurrentUser(event),
}));
