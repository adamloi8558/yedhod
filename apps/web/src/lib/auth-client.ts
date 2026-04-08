import { createClient } from "@kodhom/auth/client";

export const authClient = createClient(
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
);
