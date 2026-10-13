"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getContext, ORG_COOKIE } from "@/lib/session";

export async function switchOrg(orgId: string) {
  const ctx = await getContext();
  if (!ctx.orgs.some((o) => o.id === orgId)) return;
  (await cookies()).set(ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/");
}
