// Server-only helper para envio de web-push. Mantido em módulo próprio para
// poder ser importado dinamicamente a partir de qualquer server fn sem puxar
// dependências client-side.
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string },
): Promise<{ sent: number; failed: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const webpush = (await import("web-push")).default;
  const vapidPub = process.env.VAPID_PUBLIC_KEY;
  const vapidPriv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@robolucro.app";
  if (!vapidPub || !vapidPriv) return { sent: 0, failed: 0 };
  webpush.setVapidDetails(subject, vapidPub, vapidPriv);

  const { data: subs } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  let sent = 0, failed = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
      );
      sent++;
    } catch (err) {
      failed++;
      const status = (err as { statusCode?: number }).statusCode;
      // 404/410 = endpoint expirado → remover
      if (status === 404 || status === 410) {
        await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
      }
    }
  }
  return { sent, failed };
}
