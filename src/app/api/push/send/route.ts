import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webPush from "web-push";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (authHeader !== serviceRoleKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Configure VAPID inside the handler — NEVER at module top-level. Top-level
  // execution runs during `next build` page-data collection and crashes the
  // whole build when these env vars are missing.
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  if (!vapidPublicKey || !vapidPrivateKey) {
    return NextResponse.json({ error: "Push not configured" }, { status: 503 });
  }
  webPush.setVapidDetails(
    "mailto:francisco.cucullu@gmail.com",
    vapidPublicKey,
    vapidPrivateKey
  );

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );

  // Get all push subscriptions
  const { data: subscriptions, error: subError } = await supabase
    .from("listly_push_subscriptions")
    .select("user_id, endpoint, keys_p256dh, keys_auth");

  if (subError || !subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  // For each subscription, count unchecked items assigned to that user
  let sent = 0;

  for (const sub of subscriptions) {
    const { data: items } = await supabase
      .from("listly_items")
      .select("id")
      .eq("assigned_to", sub.user_id)
      .eq("checked", false);

    const pendingCount = items?.length ?? 0;
    if (pendingCount === 0) continue;

    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.keys_p256dh,
        auth: sub.keys_auth,
      },
    };

    const payload = JSON.stringify({
      title: "Listly",
      body:
        pendingCount === 1
          ? "You have 1 pending item assigned to you"
          : `You have ${pendingCount} pending items assigned to you`,
      icon: "/icon-192.png",
    });

    try {
      await webPush.sendNotification(pushSubscription, payload);
      sent++;
    } catch (err) {
      // Subscription may be expired — remove it
      const isGone =
        err instanceof Error && "statusCode" in err && (err as { statusCode: number }).statusCode === 410;
      if (isGone) {
        await supabase
          .from("listly_push_subscriptions")
          .delete()
          .eq("endpoint", sub.endpoint);
      }
    }
  }

  return NextResponse.json({ ok: true, sent });
}
