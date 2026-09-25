import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";

// Lightweight edge-safe gatekeeper: only checks cookie presence for fast
// redirects. Full session + membership validation happens server-side in
// `src/app/app/layout.tsx` (Node runtime, DB-backed) — middleware must never
// be the only line of defense for authorization.
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/app") || pathname.startsWith("/onboarding")) {
    if (!hasSession) {
      const url = new URL("/login", request.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  if ((pathname === "/login" || pathname === "/register") && hasSession) {
    return NextResponse.redirect(new URL("/app/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/onboarding/:path*", "/login", "/register"],
};
