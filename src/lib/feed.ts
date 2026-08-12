import { supabase } from "@/integrations/supabase/client";

export interface RankedVideo {
  id: string;
  user_id: string | null;
  title: string;
  description: string | null;
  category: string;
  thumbnail_url: string | null;
  video_url: string | null;
  views: number;
  likes: number;
  comments_count: number;
  reposts: number;
  shares: number;
  supav_count: number;
  channel_name: string | null;
  created_at: string;
  duration_seconds: number | null;
  is_reel: boolean;
}

const COLUMNS =
  "id,title,description,category,thumbnail_url,video_url,views,likes,comments_count,reposts,shares,supav_count,channel_name,user_id,created_at,duration_seconds,is_reel";

/**
 * Feed classé par le VISITA RANKING ENGINE (scores serveur : qualité,
 * tendance, fraîcheur, exploration, affinités, diversité).
 * Repli automatique sur l'ordre chronologique si le moteur est indisponible.
 */
export async function fetchRankedFeed(opts: {
  isReel: boolean;
  userId?: string | null;
  limit?: number;
}): Promise<RankedVideo[]> {
  const limit = opts.limit ?? 60;
  const { data, error } = await (supabase as never as {
    rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
  }).rpc("get_ranked_feed", {
    _user_id: opts.userId ?? null,
    _is_reel: opts.isReel,
    _limit: limit,
  });

  if (!error && Array.isArray(data) && data.length > 0) {
    return (data as Array<Record<string, unknown>>).map((r) => ({
      ...(r as unknown as RankedVideo),
      reposts: Number(r["reposts"] ?? 0),
    }));
  }

  const res = await (supabase as never as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (a: string, b: unknown) => {
          order: (c: string, o: { ascending: boolean }) => {
            limit: (n: number) => PromiseLike<{ data: unknown }>;
          };
        };
      };
    };
  })
    .from("videos")
    .select(COLUMNS)
    .eq("is_reel", opts.isReel)
    .order("created_at", { ascending: false })
    .limit(limit);

  return ((res.data ?? []) as RankedVideo[]).map((r) => ({ ...r, reposts: r.reposts ?? 0 }));
}
