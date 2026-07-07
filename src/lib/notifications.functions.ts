import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface NotificationPrefs {
  daily: boolean;
  alerts: boolean;
  aiAuto: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = { daily: true, alerts: true, aiAuto: false };

export const getMyNotificationPrefs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NotificationPrefs> => {
    const { data } = await context.supabase
      .from("profiles")
      .select("notification_prefs")
      .eq("id", context.userId)
      .maybeSingle();
    const raw = (data?.notification_prefs ?? {}) as Partial<NotificationPrefs>;
    return { ...DEFAULT_PREFS, ...raw };
  });

export const updateMyNotificationPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      daily: z.boolean().optional(),
      alerts: z.boolean().optional(),
      aiAuto: z.boolean().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }): Promise<NotificationPrefs> => {
    const { data: cur } = await context.supabase
      .from("profiles")
      .select("notification_prefs")
      .eq("id", context.userId)
      .maybeSingle();
    const merged: NotificationPrefs = {
      ...DEFAULT_PREFS,
      ...((cur?.notification_prefs ?? {}) as Partial<NotificationPrefs>),
      ...data,
    };
    const { error } = await context.supabase
      .from("profiles")
      .update({ notification_prefs: merged as unknown as Record<string, boolean> })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return merged;
  });
