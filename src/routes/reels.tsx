import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Heart, MessageCircle, Share2, Volume2, VolumeX, Clapperboard } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { FollowButton } from "@/components/FollowButton";
import { CommentsThread } from "@/components/CommentsThread";


import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { formatCount } from "@/lib/format";
import { fetchFeedPage, fetchCreatorMeta } from "@/lib/feed";
import type { FeedCursor, CreatorMeta } from "@/lib/feed";
import { track, trackImpression } from "@/lib/track";
import { toast } from "sonner";


interface ReelRow {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  views: number;
  likes: number;
  comments_count: number;
  shares: number;
  channel_name: string | null;
  user_id: string | null;
  created_at: string;
}

export const Route = createFileRoute("/reels")({
  head: () => ({
    meta: [
      { title: "Reels — Visita" },
      { name: "description", content: "Short vertical clips on Visita." },
    ],
  }),
  component: ReelsPage,
});

const REEL_PAGE = 6;

function ReelsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [reels, setReels] = useState<ReelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [muted, setMuted] = useState(false);
  const [meta, setMeta] = useState<Map<string, CreatorMeta>>(new Map());
  const [activeIndex, setActiveIndex] = useState(0);
  const cursorRef = useRef<FeedCursor | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const doneRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const prefetchRef = useRef<Promise<Awaited<ReturnType<typeof fetchFeedPage>>> | null>(null);

  const hydrate = async (rows: ReelRow[]) => {
    const owners = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
    if (owners.length > 0) {
      const m = await fetchCreatorMeta(owners);
      setMeta((prev) => { const n = new Map(prev); m.forEach((v, k) => n.set(k, v)); return n; });
    }
    if (user && rows.length > 0) {
      const { data } = await (supabase as any)
        .from("video_likes").select("video_id").eq("user_id", user.id).in("video_id", rows.map((r) => r.id));
      setLikedIds((prev) => {
        const n = new Set(prev);
        (data ?? []).forEach((r: any) => n.add(r.video_id));
        return n;
      });
    }
  };

  const append = (page: Awaited<ReturnType<typeof fetchFeedPage>>) => {
    const fresh = page.rows.filter((r) => !seenRef.current.has(r.id));
    fresh.forEach((r) => seenRef.current.add(r.id));
    cursorRef.current = page.cursor;
    doneRef.current = page.done || !page.cursor;
    if (fresh.length > 0) {
      setReels((prev) => [...prev, ...(fresh as unknown as ReelRow[])]);
      void hydrate(fresh as unknown as ReelRow[]);
    }
    return fresh.length;
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setReels([]);
    setLikedIds(new Set());
    seenRef.current = new Set();
    cursorRef.current = null;
    prefetchRef.current = null;
    doneRef.current = false;
    fetchFeedPage({ isReel: true, userId: user?.id ?? null, limit: REEL_PAGE, cursor: null })
      .then((page) => { if (!alive) return; append(page); setLoading(false); })
      .catch(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [user?.id]);

  /** Une seule page d'avance, déclenchée à 3 reels de la fin. */
  const loadMore = async () => {
    if (doneRef.current || loadingMoreRef.current || !cursorRef.current) return;
    loadingMoreRef.current = true;
    try {
      const req = prefetchRef.current ?? fetchFeedPage({
        isReel: true, userId: user?.id ?? null, limit: REEL_PAGE, cursor: cursorRef.current,
      });
      prefetchRef.current = null;
      append(await req);
    } catch { /* on garde la liste courante */ }
    loadingMoreRef.current = false;
  };

  useEffect(() => {
    if (reels.length > 0 && activeIndex >= reels.length - 3) void loadMore();
  }, [activeIndex, reels.length]);

  return (
    <AppLayout>
      <div
        className="fixed inset-x-0 top-0 bottom-16 bg-black overflow-y-scroll snap-y snap-mandatory z-0"
        style={{ scrollSnapType: "y mandatory" }}
      >
        {loading ? (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground">Loading…</div>
        ) : reels.length === 0 ? (
          <EmptyReels />
        ) : (
          reels.map((r, i) => (
            <ReelItem
              key={r.id}
              r={r}
              index={i}
              muted={muted}
              onToggleMute={() => setMuted((m) => !m)}
              onActive={setActiveIndex}
              /* la vidéo n'est attachée que pour le reel courant et le suivant :
                 aucun téléchargement inutile, navigation instantanée */
              armed={i <= activeIndex + 1 && i >= activeIndex - 1}
              preloadNext={i === activeIndex + 1}
              initialLiked={likedIds.has(r.id)}
              meta={r.user_id ? meta.get(r.user_id) ?? null : null}
            />
          ))
        )}
      </div>
    </AppLayout>
  );
}


function EmptyReels() {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center text-center px-6">
      <div className="h-16 w-16 rounded-2xl bg-card border border-border flex items-center justify-center">
        <Clapperboard className="h-7 w-7 text-primary" />
      </div>
      <h2 className="mt-4 font-display text-xl font-bold text-white">No reels yet</h2>
      <p className="mt-1 text-sm text-muted-foreground">Be the first to publish a reel.</p>
      <Link to="/upload" className="mt-6 inline-flex rounded-xl gradient-brand text-primary-foreground font-semibold px-6 py-3 text-sm">
        Publish a reel
      </Link>
    </div>
  );
}

function ReelItem({
  r, muted, onToggleMute, initialLiked, avatarUrl,
}: {
  r: ReelRow;
  muted: boolean;
  onToggleMute: () => void;
  initialLiked: boolean;
  avatarUrl: string | null;
}) {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(false);

  const [liked, setLiked] = useState(initialLiked);
  const [likes, setLikes] = useState(r.likes);
  const [shares, setShares] = useState(r.shares);
  const [commentsCount, setCommentsCount] = useState(r.comments_count);
  const [commentsOpen, setCommentsOpen] = useState(false);

  useEffect(() => { setLiked(initialLiked); }, [initialLiked]);

  // Autoplay when in view
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setVisible(e.isIntersecting && e.intersectionRatio > 0.6),
      { threshold: [0, 0.6, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (visible && !paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [visible, paused]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) {
      v.volume = 0.6;
      v.muted = muted;
    }
  }, [muted]);

  // Count view once past 30s (uses insert on video_views, unique per user/video)
  const recordedRef = useRef(false);
  const watchedRef = useRef(0);
  const lastTRef = useRef(0);
  const bucketRef = useRef(0);

  useEffect(() => { if (visible) trackImpression(r.id); }, [visible, r.id]);

  // signaux de visionnage / skip rapide
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onT = () => {
      const t = v.currentTime;
      const dt = t - lastTRef.current;
      if (dt > 0 && dt < 1.5) watchedRef.current += dt;
      lastTRef.current = t;
      const b = Math.floor(watchedRef.current / 15);
      if (b > bucketRef.current) {
        bucketRef.current = b;
        void track("watch", r.id, {
          watchMs: Math.round(watchedRef.current * 1000),
          positionMs: Math.round(t * 1000),
          durationMs: Number.isFinite(v.duration) ? Math.round(v.duration * 1000) : 0,
        });
      }
      if (Number.isFinite(v.duration) && v.duration > 0 && t / v.duration > 0.9) {
        void track("complete", r.id, {
          watchMs: Math.round(watchedRef.current * 1000),
          durationMs: Math.round(v.duration * 1000),
          once: true,
        });
      }
    };
    v.addEventListener("timeupdate", onT);
    return () => v.removeEventListener("timeupdate", onT);
  }, [r.id]);

  useEffect(() => {
    if (visible) return;
    if (watchedRef.current > 0 && watchedRef.current < 5) {
      void track("skip", r.id, { watchMs: Math.round(watchedRef.current * 1000) });
      watchedRef.current = 0;
    }
  }, [visible, r.id]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !user) return;
    const onTime = async () => {
      if (recordedRef.current) return;
      if (v.currentTime >= 30) {
        recordedRef.current = true;
        const { error } = await (supabase as any).from("video_views").insert({ user_id: user.id, video_id: r.id });
        if (error && (error as any).code !== "23505") recordedRef.current = false;
      }
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [user?.id, r.id]);

  const toggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { toast.error("Sign in to like"); return; }
    if (liked) {
      setLiked(false); setLikes((c) => Math.max(0, c - 1));
      const { error } = await (supabase as any).from("video_likes").delete().eq("user_id", user.id).eq("video_id", r.id);
      if (error) { setLiked(true); setLikes((c) => c + 1); }
    } else {
      setLiked(true); setLikes((c) => c + 1);
      const { error } = await (supabase as any).from("video_likes").insert({ user_id: user.id, video_id: r.id });
      if (error && (error as any).code !== "23505") { setLiked(false); setLikes((c) => Math.max(0, c - 1)); }
    }
  };

  const share = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = typeof window !== "undefined" ? window.location.origin + "/reels?v=" + r.id : "";
    try {
      if (navigator.share) await navigator.share({ title: r.title, url });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
      if (user) {
        setShares((c) => c + 1);
        const { error } = await (supabase as any).from("video_shares").insert({ user_id: user.id, video_id: r.id });
        if (error) setShares((c) => Math.max(0, c - 1));
      }
    } catch {}
  };

  const togglePlay = () => setPaused((p) => !p);

  return (
    <section
      ref={containerRef}
      className="relative w-full snap-start snap-always overflow-hidden bg-black"
      style={{ height: "calc(100dvh - 64px)" }}
    >
      {r.video_url ? (
        <video
          ref={videoRef}
          src={r.video_url}
          poster={r.thumbnail_url ?? undefined}
          playsInline
          loop
          muted={muted}
          preload="metadata"
          onClick={togglePlay}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-secondary to-card" />
      )}

      {/* Gradient overlay bottom */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* Top-right mute toggle */}
      <button
        onClick={onToggleMute}
        className="absolute top-3 right-3 z-10 h-10 w-10 rounded-full bg-black/60 backdrop-blur text-white flex items-center justify-center"
        aria-label={muted ? "Unmute" : "Mute"}
      >
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>

      {/* Right action rail */}
      <div className="absolute right-2 bottom-24 z-10 flex flex-col items-center gap-5 text-white">
        <button onClick={toggleLike} className="flex flex-col items-center gap-1" aria-label="Like">
          <span className={`h-11 w-11 rounded-full bg-black/50 backdrop-blur flex items-center justify-center ${liked ? "text-primary" : "text-white"}`}>
            <Heart className={`h-5 w-5 ${liked ? "fill-current" : ""}`} />
          </span>
          <span className="text-[11px] font-semibold drop-shadow">{formatCount(likes)}</span>
        </button>
        <button onClick={(e) => { e.stopPropagation(); setCommentsOpen(true); }} className="flex flex-col items-center gap-1" aria-label="Comments">
          <span className="h-11 w-11 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
            <MessageCircle className="h-5 w-5" />
          </span>
          <span className="text-[11px] font-semibold drop-shadow">{formatCount(commentsCount)}</span>
        </button>
        <button onClick={share} className="flex flex-col items-center gap-1" aria-label="Share">
          <span className="h-11 w-11 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
            <Share2 className="h-5 w-5" />
          </span>
          <span className="text-[11px] font-semibold drop-shadow">{formatCount(shares)}</span>
        </button>
      </div>


      {/* Bottom channel info */}
      <div className="absolute inset-x-0 bottom-0 z-10 p-4 pr-20 text-white">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-full overflow-hidden gradient-brand flex items-center justify-center text-primary-foreground text-xs font-bold shrink-0 border-2 border-white/70">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              (r.channel_name ?? "V").slice(0, 1).toUpperCase()
            )}
          </div>
          <span className="font-semibold text-sm truncate flex-1">{r.channel_name ?? "Visita"}</span>
          <FollowButton ownerId={r.user_id} size="sm" showCount={false} />
        </div>
        <h2 className="mt-2 text-sm font-semibold leading-snug line-clamp-2">{r.title}</h2>
        {r.description && (
          <p className="mt-1 text-xs text-white/80 line-clamp-2">{r.description}</p>
        )}
      </div>

      {paused && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 z-10 flex items-center justify-center bg-black/20"
          aria-label="Play"
        >
          <span className="h-16 w-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="h-8 w-8 fill-white ml-1"><path d="M8 5v14l11-7z" /></svg>
          </span>
        </button>
      )}

      {commentsOpen && (
        <CommentsSheet videoId={r.id} onClose={() => setCommentsOpen(false)} onAdded={() => setCommentsCount((c) => c + 1)} />
      )}
    </section>
  );
}

function CommentsSheet({ videoId, onClose, onAdded }: { videoId: string; onClose: () => void; onAdded: () => void }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative bg-card rounded-t-3xl border-t border-border/60 max-h-[70%] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-border/60 text-center text-sm font-semibold">Comments</div>
        <div className="flex-1 min-h-0 p-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
          <CommentsThread videoId={videoId} onAdded={onAdded} />
        </div>
      </div>
    </div>
  );
}



