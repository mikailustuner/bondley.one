import { NextRequest, NextResponse } from "next/server";

const SUBDOMAIN_MAP: Record<string, string> = {
  dashboard: "/dashboard",
  admin: "/admin",
  landing: "/landing",
  www: "/landing",
};

function extractSubdomain(host: string): string | null {
  const hostname = host.split(":")[0];
  const parts = hostname.split(".");

  // localhost (no dots) -> no subdomain
  if (parts.length <= 1) return null;

  // dashboard.localhost -> subdomain = "dashboard"
  if (parts.length === 2 && parts[1] === "localhost") return parts[0];

  // udkdigital.design (2 parts, base domain) -> no subdomain
  // dashboard.udkdigital.design (3+ parts) -> subdomain = "dashboard"
  if (parts.length >= 3) return parts[0];

  return null;
}

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Auth routes must stay as /login, /signup so (auth) layout is used; do not rewrite to /landing/login
  if (pathname === "/login" || pathname === "/signup") {
    return NextResponse.next();
  }

  const subdomain = extractSubdomain(host);
  const targetPrefix = subdomain ? SUBDOMAIN_MAP[subdomain] : "/landing";

  if (targetPrefix && !pathname.startsWith(targetPrefix)) {
    const url = request.nextUrl.clone();
    url.pathname = `${targetPrefix}${pathname}`;
    return NextResponse.rewrite(url);
  }

  if (!subdomain && !pathname.startsWith("/landing")) {
    const url = request.nextUrl.clone();
    url.pathname = `/landing${pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
