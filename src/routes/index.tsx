import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Eye, Play, Film } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { CategoryMarquee } from "@/components/CategoryMarquee";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { formatCount } from "@/lib/format";
import { usePlayer } from "@/lib/player";

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
  const [filter, setFilter] = useState<string>("all");
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("videos").select("*").order("created_at", { ascending: false }).limit(60)
      .then(({ data }) => { setVideos((data ?? []) as VideoRow[]); setLoading(false); });
  }, []);

  const featured = filter === "all" ? videos[0] : undefined;
  const list = useMemo(
    () => {
      const base = filter === "all" ? videos.slice(1) : videos.filter((v) => v.category === filter);
      return base;
    },
    [filter, videos],
  );

  return (
    <AppLayout>
      <section className="mx-auto max-w-7xl px-3 pt-3">
        <CategoryMarquee
          active={filter}
          onSelect={(id) => setFilter(filter === id ? "all" : id)}
        />

        {featured && <Featured v={featured} />}

        {loading ? (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="aspect-video rounded-2xl bg-card animate-pulse" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {list.map((v) => <VideoCard key={v.id} v={v} />)}
          </div>
        )}
        <div className="h-4" />
      </section>
    </AppLayout>
  );
}

function Featured({ v }: { v: VideoRow }) {
  const { play } = usePlayer();
  const { t } = useI18n();
  const open = () => v.video_url && play({
    id: v.id, title: v.title, video_url: v.video_url,
    thumbnail_url: v.thumbnail_url, channel_name: v.channel_name, user_id: v.user_id,
  });
  return (
    <article className="relative mt-4 rounded-3xl overflow-hidden bg-black border border-border/60 aspect-[4/3] sm:aspect-[16/9]">
      {v.thumbnail_url ? (
        <img src={v.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-card to-black" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
      <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-primary/15 backdrop-blur-sm text-primary border border-primary/40 px-3 py-1 text-[11px] font-bold tracking-widest uppercase">
        {t("featured")}
      </span>
      <div className="absolute left-0 right-0 bottom-0 p-5">
        <h2 className="font-display text-2xl sm:text-3xl font-bold leading-tight max-w-[80%]">{v.title}</h2>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-8 w-8 rounded-full gradient-brand flex items-center justify-center text-primary-foreground text-xs font-bold">
            {(v.channel_name ?? "V").slice(0, 1).toUpperCase()}
          </div>
          <span className="text-xs text-muted-foreground">by {v.channel_name ?? "Visita"}</span>
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> {formatCount(v.views)}</span>
          <span className="flex items-center gap-1 text-primary/90"><Heart className="h-3.5 w-3.5 fill-current" /> {formatCount(v.likes)}</span>
          <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> {formatCount(v.comments_count)}</span>
        </div>
      </div>
      <button
        onClick={open}
        aria-label="Play"
        className="absolute bottom-4 right-4 h-14 w-14 rounded-full border-2 border-primary bg-black/80 backdrop-blur flex items-center justify-center text-primary shadow-2xl shadow-primary/30 hover:scale-105 transition"
      >
        <Play className="h-6 w-6 ml-0.5 fill-primary" />
      </button>
    </article>
  );
}

function VideoCard({ v }: { v: VideoRow }) {
  const { play } = usePlayer();
  const open = () => v.video_url && play({
    id: v.id, title: v.title, video_url: v.video_url,
    thumbnail_url: v.thumbnail_url, channel_name: v.channel_name, user_id: v.user_id,
  });
  return (
    <article className="group rounded-2xl overflow-hidden bg-card border border-border/60 hover:border-primary/50 transition-all">
      <div className="relative aspect-video bg-black">
        {v.thumbnail_url ? (
          <img src={v.thumbnail_url} alt="" loading="lazy" className="h-full w-full object-cover" />
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
          <Play className="h-5 w-5 ml-0.5 fill-primary" />
        </button>
      </div>
      <div className="p-3">
        <h3 className="font-display font-semibold text-sm leading-snug line-clamp-2">{v.title}</h3>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-6 w-6 rounded-full gradient-brand flex items-center justify-center text-primary-foreground text-[10px] font-bold">
            {(v.channel_name ?? "V").slice(0, 1).toUpperCase()}
          </div>
          <p className="text-xs text-muted-foreground truncate">{v.channel_name ?? ""}</p>
        </div>
      </div>
    </article>
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
