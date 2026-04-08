import { createAuthClient } from "better-auth/react";
import { multiSessionClient } from "better-auth/client/plugins";

export const createClient = (baseURL: string) =>
  createAuthClient({
    baseURL,
    plugins: [multiSessionClient()],
  });

export type AuthClient = ReturnType<typeof createClient>;
