import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ORG_COOKIE } from "@/lib/session";

/** Logout via POST (evita logout por link/CSRF simples). */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(ORG_COOKIE);
  return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
}
