import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { EVENT_TYPES, sanitizeEventNumbers, assertAdmin } from "./ranking.server";

/** Enregistre un signal d'usage (impression, watch, skip, like, …). */
export const recordEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      videoId: z.string().uuid(),
      eventType: z.enum(EVENT_TYPES),
      watchMs: z.number().optional(),
      positionMs: z.number().optional(),
      durationMs: z.number().optional(),
      sessionId: z.string().max(64).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    const nums = sanitizeEventNumbers(data);
    const { error } = await context.supabase.rpc("record_video_event", {
      _video_id: data.videoId,
      _event_type: data.eventType,
      _watch_ms: nums.watchMs,
      _position_ms: nums.positionMs,
      _duration_ms: nums.durationMs,
      _session_id: data.sessionId ?? null,
    } as never);
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  });

/** Attribue un SupaV — entièrement validé côté serveur (60 s réellement vues, 1/jour). */
export const giveSupav = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ videoId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const { data: res, error } = await context.supabase.rpc("award_supav", {
      _video_id: data.videoId,
    } as never);
    if (error) return { ok: false, reason: error.message };
    return (res ?? { ok: false, reason: "unknown" }) as { ok: boolean; reason?: string };
  });

/** Recalcule les statistiques et scores de classement (admin). */
export const recomputeRanking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("recompute_ranking" as never);
    if (error) throw new Error(error.message);
    return { ok: true, at: new Date().toISOString() };
  });

/** Tableau de bord Analytics (admin uniquement). */
export const getAdminAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    const counts: Record<string, number> = {};
    await Promise.all(
      EVENT_TYPES.map(async (t) => {
        const { count } = await supabaseAdmin
          .from("video_events" as never)
          .select("id", { count: "exact", head: true })
          .eq("event_type", t)
          .gte("created_at", since);
        counts[t] = count ?? 0;
      }),
    );

    const { data: stats } = await supabaseAdmin
      .from("video_stats" as never)
      .select("impressions,watch_seconds,completions,skips,negatives,avg_completion")
      .limit(5000);

    const rows = (stats ?? []) as Array<Record<string, number>>;
    const sum = (k: string) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0);
    const feed = {
      impressions: sum("impressions"),
      watchHours: Math.round(sum("watch_seconds") / 360) / 10,
      completions: sum("completions"),
      skips: sum("skips"),
      negatives: sum("negatives"),
      avgCompletion: rows.length
        ? Math.round((sum("avg_completion") / rows.length) * 1000) / 10
        : 0,
    };

    const { data: topScores } = await supabaseAdmin
      .from("video_scores" as never)
      .select("video_id,quality_score,trending_score,exploration_boost,final_score")
      .order("final_score", { ascending: false })
      .limit(12);

    const ids = ((topScores ?? []) as Array<{ video_id: string }>).map((s) => s.video_id);
    const { data: vids } = ids.length
      ? await supabaseAdmin.from("videos" as never).select("id,title,channel_name,views").in("id", ids)
      : { data: [] as unknown[] };
    const vmap = new Map(
      ((vids ?? []) as Array<{ id: string }>).map((v) => [v.id, v as Record<string, unknown>]),
    );
    const topVideos = ((topScores ?? []) as Array<Record<string, unknown>>).map((s) => ({
      ...s,
      video: vmap.get(s["video_id"] as string) ?? null,
    }));

    const { data: creators } = await supabaseAdmin
      .from("creator_stats" as never)
      .select("user_id,videos_count,followers,avg_completion,quality_score")
      .order("quality_score", { ascending: false })
      .limit(12);
    const cids = ((creators ?? []) as Array<{ user_id: string }>).map((c) => c.user_id);
    const { data: profs } = cids.length
      ? await supabaseAdmin.from("profiles" as never).select("id,channel_name").in("id", cids)
      : { data: [] as unknown[] };
    const pmap = new Map(
      ((profs ?? []) as Array<{ id: string; channel_name: string }>).map((p) => [p.id, p.channel_name]),
    );
    const topCreators = ((creators ?? []) as Array<Record<string, unknown>>).map((c) => ({
      ...c,
      channel_name: pmap.get(c["user_id"] as string) ?? "—",
    }));

    return { counts, feed, topVideos, topCreators, generatedAt: new Date().toISOString() };
  });

/** Vrai si l'utilisateur connecté est administrateur. */
export const amIAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    } as never);
    return { admin: data === true };
  });
