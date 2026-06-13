import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Eye, Play, Film, Heart, MessageCircle, Share2, Send } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { CategoryMarquee } from "@/components/CategoryMarquee";
import { FollowButton } from "@/components/FollowButton";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { formatCount } from "@/lib/format";
import { usePlayer, useVideoHost } from "@/lib/player";
import { toast } from "sonner";

interface VideoRow {
  id: string;
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
  channel_name: string | null;
  user_id: string | null;
  created_at: string;
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Visita — Shows, Podcasts & Documentaries" },
      { name: "description", content: "Stream the best shows, podcasts and documentaries on Visita." },
    ],
  }),
  component: Home,
});

function Home() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<string>("all");
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [avatars, setAvatars] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    supabase.from("videos")
      .select("id,title,description,category,thumbnail_url,video_url,views,likes,comments_count,reposts,shares,channel_name,user_id,created_at")
      .order("created_at", { ascending: false }).limit(60)
      .then(({ data }) => { setVideos((data ?? []) as VideoRow[]); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!user || videos.length === 0) { setLikedIds(new Set()); return; }
    const ids = videos.map((v) => v.id);
    (supabase as any).from("video_likes").select("video_id").eq("user_id", user.id).in("video_id", ids)
      .then(({ data }: any) => setLikedIds(new Set((data ?? []).map((r: any) => r.video_id))));
  }, [user?.id, videos]);

  useEffect(() => {
    const ownerIds = Array.from(new Set(videos.map((v) => v.user_id).filter(Boolean))) as string[];
    if (ownerIds.length === 0) return;
    supabase.from("profiles").select("id,avatar_url").in("id", ownerIds)
      .then(({ data }) => {
        const m = new Map<string, string>();
        (data ?? []).forEach((p: any) => { if ((p as any).avatar_url) m.set(p.id, (p as any).avatar_url); });
        setAvatars(m);
      });
  }, [videos]);

  const list = useMemo(
    () => (filter === "all" ? videos : videos.filter((v) => v.category === filter)),
    [filter, videos],
  );

  const { current } = usePlayer();

  return (
    <AppLayout>
      <section className="mx-auto max-w-7xl px-3 pt-3">
        <CategoryMarquee
          active={filter}
          onSelect={(id) => setFilter(filter === id ? "all" : id)}
        />

        {current && <NowPlayingPinned />}

        {loading ? (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="aspect-video rounded-2xl bg-card animate-pulse" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {list.map((v) => <VideoCard key={v.id} v={v} initialLiked={likedIds.has(v.id)} avatarUrl={v.user_id ? avatars.get(v.user_id) ?? null : null} />)}
          </div>
        )}
        <div className="h-4" />
      </section>
    </AppLayout>
  );
}

function NowPlayingPinned() {
  const { current } = usePlayer();
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  useVideoHost(current?.id, el);
  return (
    <div className="mt-4 mx-auto w-full max-w-3xl">
      <div
        ref={setEl}
        className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-primary/50 shadow-2xl shadow-primary/20"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{current?.title}</p>
          <p className="text-[11px] text-muted-foreground truncate flex items-center gap-2">
            <span>{current?.channel_name ?? "Visita"}</span>
            <span className="opacity-60">·</span>
            <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {formatCount(current?.views ?? 0)}</span>
          </p>
        </div>
        <FollowButton ownerId={current?.user_id ?? null} size="md" showCount={false} />
      </div>
    </div>
  );
}


function VideoCard({ v, initialLiked, avatarUrl }: { v: VideoRow; initialLiked: boolean; avatarUrl: string | null }) {
  const { play, current } = usePlayer();
  const { user } = useAuth();
  const isActive = current?.id === v.id;

  const [liked, setLiked] = useState(initialLiked);
  const [likes, setLikes] = useState(v.likes);
  const [shares, setShares] = useState(v.shares);
  const [commentsCount, setCommentsCount] = useState(v.comments_count);
  const [commentsOpen, setCommentsOpen] = useState(false);

  useEffect(() => { setLiked(initialLiked); }, [initialLiked]);

  const open = () => v.video_url && play({
    id: v.id, title: v.title, video_url: v.video_url,
    thumbnail_url: v.thumbnail_url, channel_name: v.channel_name, user_id: v.user_id, views: v.views,
  });

  const toggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { toast.error("Sign in to like"); return; }
    if (liked) {
      setLiked(false); setLikes((c) => Math.max(0, c - 1));
      const { error } = await (supabase as any).from("video_likes").delete().eq("user_id", user.id).eq("video_id", v.id);
      if (error) { setLiked(true); setLikes((c) => c + 1); }
    } else {
      setLiked(true); setLikes((c) => c + 1);
      const { error } = await (supabase as any).from("video_likes").insert({ user_id: user.id, video_id: v.id });
      if (error && (error as any).code !== "23505") { setLiked(false); setLikes((c) => Math.max(0, c - 1)); }
    }
  };

  const share = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = typeof window !== "undefined" ? window.location.origin + "/?v=" + v.id : "";
    try {
      if (navigator.share) await navigator.share({ title: v.title, url });
      else { await navigator.clipboard.writeText(url); toast.success("Link copied"); }
      if (user) {
        setShares((c) => c + 1);
        const { error } = await (supabase as any).from("video_shares").insert({ user_id: user.id, video_id: v.id });
        if (error) setShares((c) => Math.max(0, c - 1));
      } else {
        toast.error("Sign in to count your share");
      }
    } catch {}
  };

  return (
    <article className={`group rounded-2xl overflow-hidden bg-card border transition-all ${isActive ? "border-primary/70 ring-2 ring-primary/30" : "border-border/60 hover:border-primary/50"}`}>
      <div className="relative aspect-video bg-black">
        {v.thumbnail_url ? (
          <img src={v.thumbnail_url} alt="" loading="lazy" decoding="async" width={640} height={360} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-secondary to-card" />
        )}
        <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wider font-bold bg-black/70 backdrop-blur text-primary border border-primary/40 px-2 py-0.5 rounded-full">
          {v.category}
        </span>
        <span className="absolute top-2 right-2 text-[10px] font-semibold bg-black/70 backdrop-blur text-white px-2 py-0.5 rounded-full flex items-center gap-1">
          <Eye className="h-3 w-3" /> {formatCount(v.views)}
        </span>
        <button
          onClick={open}
          aria-label="Play"
          className="absolute bottom-2 right-2 h-11 w-11 rounded-full border-2 border-primary bg-black/85 flex items-center justify-center text-primary shadow-xl shadow-primary/30 hover:scale-110 transition"
        >
          {isActive ? <span className="text-[10px] font-bold">NOW</span> : <Play className="h-5 w-5 ml-0.5 fill-primary" />}
        </button>
      </div>
      <div className="p-3">
        <h3 className="font-display font-semibold text-sm leading-snug line-clamp-2">{v.title}</h3>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-6 w-6 rounded-full overflow-hidden gradient-brand flex items-center justify-center text-primary-foreground text-[10px] font-bold shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : (
              (v.channel_name ?? "V").slice(0, 1).toUpperCase()
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate flex-1">{v.channel_name ?? ""}</p>
          <FollowButton ownerId={v.user_id} size="sm" showCount={false} />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <button onClick={toggleLike} className={`flex items-center gap-1 transition ${liked ? "text-primary" : "hover:text-primary"}`} aria-label="Like">
            <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} /> {formatCount(likes)}
          </button>
          <button onClick={(e) => { e.stopPropagation(); setCommentsOpen((open) => !open); }} className={`flex items-center gap-1 transition ${commentsOpen ? "text-primary" : "hover:text-primary"}`} aria-label="Comments">
            <MessageCircle className="h-4 w-4" /> {formatCount(commentsCount)}
          </button>
          <button onClick={share} className="flex items-center gap-1 hover:text-primary transition" aria-label="Share">
            <Share2 className="h-4 w-4" /> {formatCount(shares)}
          </button>
        </div>
        {commentsOpen && (
          <CommentPanel videoId={v.id} onAdded={() => setCommentsCount((c) => c + 1)} />
        )}
      </div>
    </article>
  );
}

interface CommentRow {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  author?: string;
}

function CommentPanel({ videoId, onAdded }: { videoId: string; onAdded: () => void }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("video_comments")
        .select("id,user_id,body,created_at")
        .eq("video_id", videoId)
        .order("created_at", { ascending: false })
        .limit(3);
      if (!active) return;
      const rows = (data ?? []) as CommentRow[];
      const ids = Array.from(new Set(rows.map((c) => c.user_id)));
      if (ids.length) {
        const { data: profiles } = await supabase.from("profiles").select("id,channel_name").in("id", ids);
        const names = new Map((profiles ?? []).map((p) => [p.id, p.channel_name]));
        if (active) setComments(rows.map((c) => ({ ...c, author: names.get(c.user_id) ?? "Visita" })));
      } else setComments(rows);
    })();
    return () => { active = false; };
  }, [videoId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const clean = body.trim();
    if (!user) { toast.error("Sign in to comment"); return; }
    if (!clean) return;
    setBusy(true);
    const optimistic: CommentRow = { id: crypto.randomUUID(), user_id: user.id, body: clean, created_at: new Date().toISOString(), author: "You" };
    setComments((rows) => [optimistic, ...rows].slice(0, 3));
    setBody("");
    onAdded();
    const { error } = await (supabase as any).from("video_comments").insert({ user_id: user.id, video_id: videoId, body: clean });
    if (error) { toast.error(error.message); setComments((rows) => rows.filter((c) => c.id !== optimistic.id)); }
    setBusy(false);
  };

  return (
    <div className="mt-3 border-t border-border/60 pt-3" onClick={(e) => e.stopPropagation()}>
      <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
        {comments.map((comment) => (
          <p key={comment.id} className="text-xs leading-snug text-muted-foreground">
            <span className="font-semibold text-foreground">{comment.author ?? "Visita"}</span> {comment.body}
          </p>
        ))}
      </div>
      <form onSubmit={submit} className="mt-3 flex items-center gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={500}
          placeholder="Ajouter un commentaire"
          className="min-w-0 flex-1 rounded-full bg-secondary border border-border px-3 py-2 text-xs outline-none focus:border-primary"
        />
        <button disabled={busy || !body.trim()} className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50" aria-label="Send comment">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

function EmptyState() {
  const { t } = useI18n();
  return (
    <div className="mt-16 text-center">
      <div className="mx-auto h-16 w-16 rounded-2xl bg-card border border-border flex items-center justify-center">
        <Film className="h-7 w-7 text-primary" />
      </div>
      <h2 className="mt-4 font-display text-xl font-bold">{t("welcome")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("noVideosYet")}</p>
      <Link to="/upload" className="inline-flex mt-6 rounded-xl gradient-brand text-primary-foreground font-semibold px-6 py-3 text-sm">
        {t("uploadFirst")}
      </Link>
    </div>
  );
}
