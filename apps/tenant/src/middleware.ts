import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";
  const domain = host.split(":")[0].toLowerCase();

  const res = NextResponse.next();
  res.headers.set("x-tenant-domain", domain);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
