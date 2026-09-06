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
  score?: number;
}

export interface FeedCursor {
  score: number;
  id: string;
  page: number;
}

export interface FeedPage {
  rows: RankedVideo[];
  cursor: FeedCursor | null;
  done: boolean;
}

const COLUMNS =
  "id,title,description,category,thumbnail_url,video_url,views,likes,comments_count,reposts,shares,supav_count,channel_name,user_id,created_at,duration_seconds,is_reel";

type AnyClient = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
  from: (t: string) => any;
};
const db = supabase as never as AnyClient;

/* ------------------------------------------------------------------ */
/* Session seed : rend l'ordre du classement stable pendant la session */
/* (indispensable pour une pagination keyset sans doublons ni trous)   */
/* ------------------------------------------------------------------ */
let seed: number | null = null;
export function feedSeed(): number {
  if (seed !== null) return seed;
  if (typeof window === "undefined") return 0;
  const k = "visita_feed_seed";
  const stored = window.sessionStorage.getItem(k);
  seed = stored ? Number(stored) : Math.floor(Math.random() * 1_000_000);
  if (!stored) window.sessionStorage.setItem(k, String(seed));
  return seed;
}
/** Nouvelle graine : utilisée sur pull-to-refresh / rechargement volontaire. */
export function resetFeedSeed() {
  seed = Math.floor(Math.random() * 1_000_000);
  if (typeof window !== "undefined") window.sessionStorage.setItem("visita_feed_seed", String(seed));
  pageCache.clear();
}

/* ------------------------------------------------------------------ */
/* Cache court, par utilisateur + anti cache-stampede (in-flight dedupe)*/
/* ------------------------------------------------------------------ */
interface Entry<T> {
  at: number;
  value?: T;
  inflight?: Promise<T>;
}
const pageCache = new Map<string, Entry<FeedPage>>();

/** Fil personnalisé : cache très court. Anonyme (contenu partagé) : plus long. */
const TTL_PERSONAL = 30_000;
const TTL_SHARED = 120_000;
const MAX_ENTRIES = 60;

function prune(map: Map<string, Entry<unknown>>) {
  if (map.size <= MAX_ENTRIES) return;
  const oldest = [...map.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, map.size - MAX_ENTRIES);
  oldest.forEach(([k]) => map.delete(k));
}

/** Invalide le cache du fil (ex : nouvel événement fort de l'utilisateur). */
export function invalidateFeedCache() {
  pageCache.clear();
}

async function loadPage(opts: {
  isReel: boolean;
  userId?: string | null;
  limit: number;
  cursor: FeedCursor | null;
}): Promise<FeedPage> {
  const page = opts.cursor?.page ?? 0;
  const { data, error } = await db.rpc("get_ranked_feed", {
    _user_id: opts.userId ?? null,
    _is_reel: opts.isReel,
    _limit: opts.limit,
    _seed: feedSeed(),
    _page: page,
    _cursor_score: opts.cursor?.score ?? null,
    _cursor_id: opts.cursor?.id ?? null,
  });

  if (!error && Array.isArray(data)) {
    const rows = (data as Array<Record<string, unknown>>).map((r) => ({
      ...(r as unknown as RankedVideo),
      reposts: Number(r["reposts"] ?? 0),
    }));
    if (rows.length > 0) {
      const last = rows[rows.length - 1]!;
      return {
        rows,
        cursor: { score: Number(last.score ?? 0), id: last.id, page: page + 1 },
        done: rows.length < opts.limit,
      };
    }
    if (opts.cursor) return { rows: [], cursor: null, done: true };
  }

  /* --- Fallback chronologique (moteur ou requête indisponible) ---
     Keyset sur created_at : aucun OFFSET. */
  let q = db
    .from("videos")
    .select(COLUMNS)
    .eq("is_reel", opts.isReel)
    .order("created_at", { ascending: false })
    .limit(opts.limit);
  if (opts.cursor) q = q.lt("created_at", new Date(opts.cursor.score).toISOString());
  const res = await q;
  const rows = ((res?.data ?? []) as RankedVideo[]).map((r) => ({ ...r, reposts: r.reposts ?? 0 }));
  const last = rows[rows.length - 1];
  return {
    rows,
    cursor: last ? { score: new Date(last.created_at).getTime(), id: last.id, page: page + 1 } : null,
    done: rows.length < opts.limit,
  };
}

/**
 * Une page du feed classée par le VISITA RANKING ENGINE v2.
 * Pagination keyset stable (score, id) — jamais d'OFFSET.
 * Cache court par utilisateur + déduplication des requêtes simultanées.
 */
export async function fetchFeedPage(opts: {
  isReel: boolean;
  userId?: string | null;
  limit?: number;
  cursor?: FeedCursor | null;
}): Promise<FeedPage> {
  const limit = opts.limit ?? 12;
  const cursor = opts.cursor ?? null;
  const key = `${opts.userId ?? "anon"}|${opts.isReel}|${limit}|${cursor?.score ?? "start"}|${cursor?.id ?? ""}`;
  const ttl = opts.userId ? TTL_PERSONAL : TTL_SHARED;
  const now = Date.now();
  const hit = pageCache.get(key);
  if (hit) {
    if (hit.inflight) return hit.inflight;
    if (hit.value && now - hit.at < ttl) return hit.value;
  }
  const inflight = loadPage({ isReel: opts.isReel, userId: opts.userId, limit, cursor })
    .then((value) => {
      pageCache.set(key, { at: Date.now(), value });
      prune(pageCache as Map<string, Entry<unknown>>);
      return value;
    })
    .catch((e) => {
      pageCache.delete(key);
      throw e;
    });
  pageCache.set(key, { at: now, inflight, value: hit?.value });
  return inflight;
}

/** Compat : première page uniquement. */
export async function fetchRankedFeed(opts: {
  isReel: boolean;
  userId?: string | null;
  limit?: number;
}): Promise<RankedVideo[]> {
  const p = await fetchFeedPage({ ...opts, limit: opts.limit ?? 12, cursor: null });
  return p.rows;
}

/* ------------------------------------------------------------------ */
/* Métadonnées créateurs : un seul appel batché (photo, bio, badge,    */
/* abonnés, déjà suivi) au lieu d'une requête par carte.               */
/* ------------------------------------------------------------------ */
export interface CreatorMeta {
  user_id: string;
  channel_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  joined_at: string | null;
  tier: "platinum" | "gold" | "blue" | null;
  followers: number;
  is_following: boolean;
}

const metaCache = new Map<string, { at: number; value: CreatorMeta }>();
const metaInflight = new Map<string, Promise<CreatorMeta[]>>();
const META_TTL = 120_000;

export async function fetchCreatorMeta(ownerIds: string[]): Promise<Map<string, CreatorMeta>> {
  const now = Date.now();
  const unique = Array.from(new Set(ownerIds.filter(Boolean)));
  const out = new Map<string, CreatorMeta>();
  const missing: string[] = [];
  for (const id of unique) {
    const c = metaCache.get(id);
    if (c && now - c.at < META_TTL) out.set(id, c.value);
    else missing.push(id);
  }
  if (missing.length === 0) return out;

  const key = missing.slice().sort().join(",");
  let req = metaInflight.get(key);
  if (!req) {
    req = Promise.resolve(db.rpc("get_creator_meta", { _owner_ids: missing }))
      .then(({ data }) => (Array.isArray(data) ? (data as CreatorMeta[]) : []))
      .catch(() => [] as CreatorMeta[])
      .finally(() => metaInflight.delete(key));

    metaInflight.set(key, req);
  }
  const rows = await req;
  rows.forEach((r) => {
    metaCache.set(r.user_id, { at: Date.now(), value: r });
    out.set(r.user_id, r);
  });
  return out;
}

/** Mise à jour locale après un follow/unfollow (évite un refetch). */
export function patchCreatorMeta(userId: string, patch: Partial<CreatorMeta>) {
  const c = metaCache.get(userId);
  if (c) metaCache.set(userId, { at: c.at, value: { ...c.value, ...patch } });
}

export function clearCreatorMetaCache() {
  metaCache.clear();
}
