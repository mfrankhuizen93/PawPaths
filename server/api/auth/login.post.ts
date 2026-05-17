import { defineEventHandler, readBody } from "h3";
import { createUserSession, loginUser } from "../../utils/auth.js";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const user = await loginUser(body?.email, body?.password);

  await createUserSession(event, user.id);

  return { user };
});
