import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { readEnv } from "./lib/env";

const protectedRoutes = ["/dashboard", "/settings", "/plans"];

function realOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const { hostname } = new URL(value);
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return undefined;
    }
    return value.replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const adminPortal = readEnv("ADMIN_PORTAL") === "1";
  const adminOrigin = realOrigin(readEnv("NEXT_PUBLIC_ADMIN_ORIGIN"));
  const mainOrigin = realOrigin(readEnv("NEXT_PUBLIC_MAIN_ORIGIN"));

  if (!adminPortal && adminOrigin && pathname.startsWith("/dashboard/admin")) {
    const url = new URL(`${adminOrigin}${pathname}${request.nextUrl.search}`);
    if (url.origin !== request.nextUrl.origin) {
      return NextResponse.redirect(url);
    }
  }

  if (
    adminPortal &&
    !pathname.startsWith("/dashboard/admin") &&
    !pathname.startsWith("/auth/") &&
    // The notification bell fetches its feed from every console. The handler
    // authenticates the session itself, so serving it on the admin deployment
    // grants no access beyond what the signed-in admin already has.
    !pathname.startsWith("/api/notifications") &&
    pathname !== "/api/health"
  ) {
    if (!mainOrigin || pathname === "/") {
      return NextResponse.redirect(new URL("/dashboard/admin", request.url));
    }
    const url = new URL(`${mainOrigin}${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  const isProtected = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const supabaseUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = readEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const signInUrl = new URL("/auth/signin", request.url);
    signInUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (pathname.startsWith("/dashboard")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, is_suspended")
      .eq("id", user.id)
      .maybeSingle();

    if ((profile?.is_suspended as boolean | undefined) === true) {
      const suspendedUrl = new URL("/auth/suspended", request.url);
      return NextResponse.redirect(suspendedUrl);
    }

    const role = profile?.role as string | undefined;

    if (pathname.startsWith("/dashboard/restaurant") && role !== "food_business") {
      return NextResponse.redirect(new URL("/auth/no-access", request.url));
    }

    if (pathname.startsWith("/dashboard/organizer") && role !== "event_organizer") {
      return NextResponse.redirect(new URL("/auth/no-access", request.url));
    }

    if (pathname.startsWith("/dashboard/admin") && role !== "system_admin") {
      return NextResponse.redirect(new URL("/auth/no-access", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
