"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ORG_COOKIE } from "@/lib/session";
import { str } from "@/lib/forms";
import type { ActionState } from "@/lib/types";

export async function createOrganization(_: ActionState, fd: FormData): Promise<ActionState> {
  const name = str(fd, "name") ?? "";
  if (name.length < 2) return { error: "Informe o nome da empresa." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_organization", { p_name: name });
  if (error) return { error: error.message };

  (await cookies()).set(ORG_COOKIE, data as string, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/");
}
