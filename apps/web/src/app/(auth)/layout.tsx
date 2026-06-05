import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth-server";

export const metadata = {
  robots: { index: false, follow: false },
};

function sanitizeRedirect(value: string | null) {
  if (!value) return null;
  return value.startsWith("/") && !value.startsWith("//") ? value : null;
}

// If a session already exists, /login and /register are dead-ends — bounce
// the user back to wherever they came from (?redirect=...) or the home page.
// We read the redirect from the referer URL since layouts don't get
// searchParams; matches the param the auth pages already use.
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (session?.user) {
    const hdrs = await headers();
    const referer = hdrs.get("referer");
    let target = "/";
    if (referer) {
      try {
        const url = new URL(referer);
        const param = sanitizeRedirect(url.searchParams.get("redirect"));
        if (param) target = param;
      } catch {
        // ignore — fall through to "/"
      }
    }
    redirect(target);
  }
  return children;
}
