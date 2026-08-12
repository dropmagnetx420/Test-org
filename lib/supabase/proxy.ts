import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/dashboard", "/wallet", "/kyc", "/referrals", "/profile", "/notifications"];
const ADMIN_PREFIX = "/admin";
const AUTH_ROUTES = ["/login", "/register", "/forgot-password"];

/** `sb-<project-ref>-auth-token`, possibly chunked into `.0`, `.1`, … */
function hasSessionCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
}

function redirectTo(request: NextRequest, pathname: string, next?: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  if (next) url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isGated = path.startsWith(ADMIN_PREFIX) || PROTECTED_PREFIXES.some((p) => path.startsWith(p));

  /**
   * `auth.getUser()` is a round trip to Supabase on every matched request. With
   * no session cookie there is no token to validate or refresh, so the answer is
   * already known and the hop is pure latency for anonymous visitors.
   */
  if (!hasSessionCookie(request)) {
    return isGated ? redirectTo(request, "/login", path) : NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Stale or revoked cookie. Let public pages render as anonymous.
    return isGated ? redirectTo(request, "/login", path) : response;
  }

  if (AUTH_ROUTES.includes(path)) return redirectTo(request, "/dashboard");

  // Role is deliberately not checked here: `requireAdmin()` in the admin layout
  // is authoritative, and repeating the profile lookup added a second query to
  // every admin request for no extra safety.
  return response;
}
