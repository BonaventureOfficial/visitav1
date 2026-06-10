import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, Play, Film, Heart, MessageCircle, Share2, Repeat2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { CategoryMarquee } from "@/components/CategoryMarquee";
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
  const [filter, setFilter] = useState<string>("all");
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("videos").select("*").order("created_at", { ascending: false }).limit(60)
      .then(({ data }) => { setVideos((data ?? []) as VideoRow[]); setLoading(false); });
  }, []);

  const list = useMemo(
    () => (filter === "all" ? videos : videos.filter((v) => v.category === filter)),
    [filter, videos],
  );

  return (
    <AppLayout>
      <section className="mx-auto max-w-7xl px-3 pt-3">
        <CategoryMarquee
          active={filter}
          onSelect={(id) => setFilter(filter === id ? "all" : id)}
        />

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
            {list.map((v) => <VideoCard key={v.id} v={v} />)}
          </div>
        )}
        <div className="h-4" />
      </section>
    </AppLayout>
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
