import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { isTrustedRequestOrigin } from "@/lib/security/origin";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/") && !SAFE_METHODS.has(request.method)) {
    const host =
      request.headers.get("x-forwarded-host") ??
      request.headers.get("host");
    const origin = request.headers.get("origin");

    if (!isTrustedRequestOrigin(origin, host)) {
      return NextResponse.json(
        { ok: false, error: "درخواست نامعتبر است." },
        { status: 403 },
      );
    }
  }

  const hasSession = request.cookies.has(SESSION_COOKIE);

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
  matcher: [
    "/api/:path*",
    "/app/:path*",
    "/onboarding/:path*",
    "/login",
    "/register",
  ],
};
