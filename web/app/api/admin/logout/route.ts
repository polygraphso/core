/**
 * POST /api/admin/logout — clear the admin cookie and redirect to login.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/admin-auth";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
  return NextResponse.redirect(new URL("/admin/login", request.url), {
    status: 303,
  });
}
