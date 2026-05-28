import { defineEventHandler, readBody } from "h3";
import { updateCurrentUserProfile } from "../../utils/auth.js";

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  return {
    user: await updateCurrentUserProfile(event, {
      navigationAppPreference: body?.navigationAppPreference,
    }),
  };
});
