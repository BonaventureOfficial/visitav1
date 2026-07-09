import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Heart, MessageCircle, Share2, Send, Volume2, VolumeX, Clapperboard } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { FollowButton } from "@/components/FollowButton";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { formatCount } from "@/lib/format";
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

function ReelsPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [reels, setReels] = useState<ReelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [muted, setMuted] = useState(true);
  const [avatars, setAvatars] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    (supabase as any).from("videos")
      .select("id,title,description,thumbnail_url,video_url,views,likes,comments_count,shares,channel_name,user_id,created_at")
      .eq("is_reel", true)
      .order("created_at", { ascending: false })
      .limit(60)
      .then(({ data }: any) => { setReels((data ?? []) as ReelRow[]); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!user || reels.length === 0) { setLikedIds(new Set()); return; }
    const ids = reels.map((r) => r.id);
    (supabase as any).from("video_likes").select("video_id").eq("user_id", user.id).in("video_id", ids)
      .then(({ data }: any) => setLikedIds(new Set((data ?? []).map((r: any) => r.video_id))));
  }, [user?.id, reels]);

  useEffect(() => {
    const ownerIds = Array.from(new Set(reels.map((r) => r.user_id).filter(Boolean))) as string[];
    if (ownerIds.length === 0) return;
    supabase.from("profiles").select("id,avatar_url").in("id", ownerIds).then(({ data }) => {
      const m = new Map<string, string>();
      (data ?? []).forEach((p: any) => { if (p.avatar_url) m.set(p.id, p.avatar_url); });
      setAvatars(m);
    });
  }, [reels]);

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
          reels.map((r) => (
            <ReelItem
              key={r.id}
              r={r}
              muted={muted}
              onToggleMute={() => setMuted((m) => !m)}
              initialLiked={likedIds.has(r.id)}
              avatarUrl={r.user_id ? avatars.get(r.user_id) ?? null : null}
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
    if (v) v.muted = muted;
  }, [muted]);

  // Count view once past 30s (uses insert on video_views, unique per user/video)
  const recordedRef = useRef(false);
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

interface CommentRow { id: string; user_id: string; body: string; created_at: string; author?: string }

function CommentsSheet({ videoId, onClose, onAdded }: { videoId: string; onClose: () => void; onAdded: () => void }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await (supabase as any).from("video_comments")
        .select("id,user_id,body,created_at").eq("video_id", videoId)
        .order("created_at", { ascending: false }).limit(50);
      if (!active) return;
      const rows = (data ?? []) as CommentRow[];
      const ids = Array.from(new Set(rows.map((c) => c.user_id)));
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id,channel_name").in("id", ids);
        const names = new Map((profs ?? []).map((p) => [p.id, p.channel_name]));
        if (active) setComments(rows.map((c) => ({ ...c, author: names.get(c.user_id) ?? "Visita" })));
      } else setComments(rows);
    })();
    return () => { active = false; };
  }, [videoId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = body.trim();
    if (!user) { toast.error("Sign in to comment"); return; }
    if (!clean) return;
    setBusy(true);
    const optimistic: CommentRow = { id: crypto.randomUUID(), user_id: user.id, body: clean, created_at: new Date().toISOString(), author: "You" };
    setComments((rows) => [optimistic, ...rows]);
    setBody("");
    onAdded();
    const { error } = await (supabase as any).from("video_comments").insert({ user_id: user.id, video_id: videoId, body: clean });
    if (error) { toast.error(error.message); setComments((rows) => rows.filter((c) => c.id !== optimistic.id)); }
    setBusy(false);
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative bg-card rounded-t-3xl border-t border-border/60 max-h-[70%] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3 border-b border-border/60 text-center text-sm font-semibold">Comments</div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {comments.length === 0 && <p className="text-xs text-muted-foreground text-center">Be the first to comment.</p>}
          {comments.map((c) => (
            <p key={c.id} className="text-sm leading-snug">
              <span className="font-semibold">{c.author ?? "Visita"}</span>{" "}
              <span className="text-muted-foreground">{c.body}</span>
            </p>
          ))}
        </div>
        <form onSubmit={submit} className="p-3 border-t border-border/60 flex items-center gap-2" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={500}
            placeholder="Add a comment"
            className="flex-1 min-w-0 rounded-full bg-secondary border border-border px-4 py-2 text-sm outline-none focus:border-primary"
          />
          <button disabled={busy || !body.trim()} className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50" aria-label="Send">
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

const _memoUsedTypes = useMemo;
void _memoUsedTypes;
