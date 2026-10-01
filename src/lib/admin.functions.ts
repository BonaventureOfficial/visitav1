import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./ranking.server";

const TIERS = ["platinum", "gold", "blue"] as const;

/** Liste complète des membres avec rôle, badge et volume de contenus (admin). */
export const adminListMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profiles }, { data: roles }, { data: verifs }, { data: stats }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,channel_name,email,avatar_url,created_at")
        .order("created_at", { ascending: false }).limit(500),
      supabaseAdmin.from("user_roles").select("user_id,role").limit(2000),
      supabaseAdmin.from("profile_verifications").select("user_id,tier").limit(2000),
      supabaseAdmin.from("creator_stats").select("user_id,videos_count").limit(5000),
    ]);

    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const list = roleMap.get(r.user_id) ?? [];
      list.push(r.role as string);
      roleMap.set(r.user_id, list);
    });
    const verifMap = new Map((verifs ?? []).map((v) => [v.user_id, v.tier as string]));
    const videoCount = new Map<string, number>(
      (stats ?? []).map((s) => [s.user_id, s.videos_count ?? 0]),
    );


    return (profiles ?? []).map((p) => ({
      id: p.id,
      channel_name: p.channel_name,
      email: p.email,
      avatar_url: p.avatar_url,
      created_at: p.created_at,
      roles: roleMap.get(p.id) ?? [],
      tier: verifMap.get(p.id) ?? null,
      videos: videoCount.get(p.id) ?? 0,
    }));
  });

/** Accorde ou retire un badge de vérification (admin). */
export const adminSetVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ userId: z.string().uuid(), tier: z.enum(TIERS).nullable() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.tier === null) {
      const { error } = await supabaseAdmin.from("profile_verifications").delete().eq("user_id", data.userId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("profile_verifications")
        .upsert({ user_id: data.userId, tier: data.tier, granted_by: context.userId }, { onConflict: "user_id" });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Donne ou retire un rôle (admin / moderator). */
export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      userId: z.string().uuid(),
      role: z.enum(["admin", "moderator"]),
      grant: z.boolean(),
    }),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    if (data.userId === context.userId && data.role === "admin" && !data.grant) {
      throw new Error("Impossible de retirer votre propre rôle admin");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.grant) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Supprime définitivement n'importe quelle vidéo (admin). */
export const adminDeleteVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ videoId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("videos").delete().eq("id", data.videoId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Contenus pour modération : paginés (keyset), filtrables, recherche par titre (admin). */
export const adminRecentVideos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z
      .object({
        q: z.string().max(100).optional(),
        type: z.enum(["all", "video", "reel"]).optional(),
        cursor: z.object({ created_at: z.string(), id: z.string().uuid() }).nullable().optional(),
      })
      .optional(),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const PAGE = 20;
    let query = supabaseAdmin
      .from("videos")
      .select("id,title,channel_name,views,likes,supav_count,is_reel,created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(PAGE + 1);
    const type = data?.type ?? "all";
    if (type !== "all") query = query.eq("is_reel", type === "reel");
    const q = data?.q?.trim().replace(/[%_,()]/g, " ");
    if (q) query = query.or(`title.ilike.%${q}%,channel_name.ilike.%${q}%`);
    const c = data?.cursor;
    if (c) {
      query = query.or(`created_at.lt.${c.created_at},and(created_at.eq.${c.created_at},id.lt.${c.id})`);
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const hasMore = list.length > PAGE;
    const items = list.slice(0, PAGE);
    const last = items[items.length - 1];
    return {
      items,
      next: hasMore && last ? { created_at: last.created_at, id: last.id } : null,
    };
  });
