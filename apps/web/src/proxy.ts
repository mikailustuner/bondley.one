import { NextRequest, NextResponse } from "next/server";

function getMainDomain(host: string): string {
  const hostname = host.split(":")[0];
  const parts = hostname.split(".");
  if (parts.length <= 1) return hostname;
  if (parts.length === 2 && parts[1] === "localhost") return "localhost";
  return parts.slice(-2).join(".");
}

function extractSubdomain(host: string): string | null {
  const hostname = host.split(":")[0];
  const parts = hostname.split(".");
  if (parts.length <= 1) return null;
  if (parts.length === 2 && parts[1] === "localhost") return parts[0];
  if (parts.length >= 3) return parts[0];
  return null;
}

export function proxy(request: NextRequest) {
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

  if (pathname === "/login" || pathname === "/signup") {
    return NextResponse.next();
  }

  const subdomain = extractSubdomain(host);
  const mainDomain = getMainDomain(host);
  const protocol =
    request.headers.get("x-forwarded-proto") ||
    request.nextUrl.protocol.replace(":", "");

  // Subdomain -> main domain redirect (single origin so localStorage/auth works)
  if (subdomain === "dashboard") {
    const path = pathname === "/" ? "/dashboard" : `/dashboard${pathname}`;
    const url = `${protocol}://${mainDomain}${path}`;
    return NextResponse.redirect(url, 301);
  }
  if (subdomain === "admin") {
    const path = pathname === "/" ? "/admin" : `/admin${pathname}`;
    const url = `${protocol}://${mainDomain}${path}`;
    return NextResponse.redirect(url, 301);
  }

  // Main domain (and www): only "/" -> landing rewrite
  if (!subdomain || subdomain === "www") {
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/landing";
      return NextResponse.rewrite(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
