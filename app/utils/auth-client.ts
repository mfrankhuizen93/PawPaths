import { createAuthClient } from "better-auth/vue";
import { dashClient } from "@better-auth/infra/client";

export const authClient = createAuthClient({
  plugins: [dashClient()],
});

export const { signIn, signOut, signUp, useSession } = authClient;
