import { createClient } from "@kodhom/auth/client";

export const authClient = createClient(
  process.env.NEXT_PUBLIC_BACKOFFICE_URL || "http://localhost:3001"
);
