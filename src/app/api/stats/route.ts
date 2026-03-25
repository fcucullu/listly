import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Count unique users who are members of at least one Listly list
  const { data } = await supabase
    .from("listly_members")
    .select("user_id")
    .limit(1000);

  const uniqueUsers = new Set((data ?? []).map((m) => m.user_id));

  return NextResponse.json(
    { users: uniqueUsers.size },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60",
      },
    }
  );
}
