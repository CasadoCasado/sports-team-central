import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Public key exposed to the browser so it can subscribe.
export const getVapidPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: process.env.VAPID_PUBLIC_KEY ?? null };
});

type SubInput = {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
};

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: SubInput) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          user_id: userId,
          endpoint: data.endpoint,
          p256dh: data.p256dh,
          auth: data.auth,
          user_agent: data.userAgent ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" },
      );
    if (error) throw error;
    return { ok: true };
  });

export const deletePushSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { endpoint: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", data.endpoint);
    if (error) throw error;
    return { ok: true };
  });

type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

async function sendToUserIds(userIds: string[], payload: PushPayload) {
  if (userIds.length === 0) return { sent: 0 };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: subs, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds);
  if (error) throw error;
  if (!subs || subs.length === 0) return { sent: 0 };

  const webpushMod = await import("web-push");
  const webpush = (webpushMod as any).default ?? webpushMod;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:no-reply@teamhub.app",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );

  const body = JSON.stringify(payload);
  const stale: string[] = [];
  let sent = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
        sent += 1;
      } catch (err: any) {
        const code = err?.statusCode;
        if (code === 404 || code === 410) stale.push(s.id);
      }
    }),
  );

  if (stale.length > 0) {
    await supabaseAdmin.from("push_subscriptions").delete().in("id", stale);
  }
  return { sent };
}

export const sendPushToTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      teamId: string;
      title: string;
      body: string;
      url?: string;
      tag?: string;
      excludeSelf?: boolean;
      managersOnly?: boolean;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Verify caller belongs to the team (RLS covers this).
    const { data: myMembership, error: mErr } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("team_id", data.teamId)
      .eq("user_id", userId)
      .eq("status", "activo")
      .maybeSingle();
    if (mErr) throw mErr;
    if (!myMembership) return { sent: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("team_members")
      .select("user_id")
      .eq("team_id", data.teamId)
      .eq("status", "activo");
    if (data.managersOnly) q = q.in("role", ["capitan", "entrenador", "delegado"]);
    const { data: members, error } = await q;
    if (error) throw error;
    let userIds = (members ?? []).map((m) => m.user_id as string);
    if (data.excludeSelf !== false) userIds = userIds.filter((id) => id !== userId);
    return sendToUserIds(userIds, {
      title: data.title,
      body: data.body,
      url: data.url,
      tag: data.tag,
    });
  });

export const sendPushToUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { userId: string; title: string; body: string; url?: string; tag?: string }) => data,
  )
  .handler(async ({ data }) => {
    return sendToUserIds([data.userId], {
      title: data.title,
      body: data.body,
      url: data.url,
      tag: data.tag,
    });
  });
