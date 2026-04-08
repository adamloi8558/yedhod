import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { auth } from "@kodhom/auth";
import { db, users } from "@kodhom/db";
import { eq } from "drizzle-orm";

const EMAIL = "adamloi8558@gmail.com";
const PASSWORD = "112233!!";
const NAME = "Admin";

async function main() {
  // Create user via Better Auth signup
  const ctx = await auth.api.signUpEmail({
    body: {
      email: EMAIL,
      password: PASSWORD,
      name: NAME,
    },
  });

  if (!ctx?.user) {
    console.error("Failed to create user");
    process.exit(1);
  }

  // Update role to admin
  await db
    .update(users)
    .set({ role: "admin" })
    .where(eq(users.id, ctx.user.id));

  console.log(`Admin user created: ${EMAIL} (id: ${ctx.user.id})`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
