import { NextResponse, type NextRequest } from "next/server";

// Optimistic redirect only: the real checks live in the API route guards and server layouts.
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("kenora_session");
  const { pathname } = request.nextUrl;
  if (!hasSession && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
