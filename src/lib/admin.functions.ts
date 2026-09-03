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

/** Dernières vidéos publiées, pour modération (admin). */
export const adminRecentVideos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("videos")
      .select("id,title,channel_name,views,likes,supav_count,is_reel,created_at")
      .order("created_at", { ascending: false })
      .limit(40);
    return data ?? [];
  });
