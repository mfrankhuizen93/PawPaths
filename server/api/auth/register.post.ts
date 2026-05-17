import { defineEventHandler, readBody } from "h3";
import { createUserSession, registerUser } from "../../utils/auth.js";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const user = await registerUser({
    email: body?.email,
    password: body?.password,
    name: body?.name,
  });

  await createUserSession(event, user.id);

  return { user };
});
