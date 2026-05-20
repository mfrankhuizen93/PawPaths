import { defineEventHandler } from "h3";
import { listUsers } from "../../utils/auth.js";

export default defineEventHandler(async (event) => {
  return { users: await listUsers(event) };
});
