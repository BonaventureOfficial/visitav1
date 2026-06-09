import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Eye, Heart, MessageCircle, Repeat2, Share2, Film } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { formatCount } from "@/lib/format";

type Category = "emission" | "podcast" | "documentary";

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
  const { t } = useI18n();
  const [filter, setFilter] = useState<Category | "all">("all");
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("videos")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60)
      .then(({ data }) => {
        setVideos((data ?? []) as VideoRow[]);
        setLoading(false);
      });
  }, []);

  const list = useMemo(
    () => (filter === "all" ? videos : videos.filter((v) => v.category === filter)),
    [filter, videos],
  );

  const tabs: Array<{ id: Category | "all"; label: string }> = [
    { id: "all", label: t("all") },
    { id: "emission", label: t("emissions") },
    { id: "podcast", label: t("podcasts") },
    { id: "documentary", label: t("documentaries") },
  ];

  return (
    <AppLayout>
      <section className="mx-auto max-w-7xl px-4 pt-6">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium transition border ${
                filter === tab.id
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="aspect-video rounded-2xl bg-card animate-pulse" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {list.map((v) => (
              <VideoCard key={v.id} v={v} />
            ))}
          </div>
        )}
      </section>
    </AppLayout>
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
      <Link
        to="/upload"
        className="inline-flex mt-6 rounded-xl gradient-brand text-primary-foreground font-semibold px-6 py-3 text-sm"
      >
        {t("uploadFirst")}
      </Link>
    </div>
  );
}

function VideoCard({ v }: { v: VideoRow }) {
  const [playing, setPlaying] = useState(false);
  return (
    <article className="group rounded-2xl overflow-hidden bg-card border border-border/60 hover:border-primary/40 transition-all">
      <div className="relative aspect-video bg-black">
        {playing && v.video_url ? (
          <video
            src={v.video_url}
            controls
            autoPlay
            playsInline
            preload="metadata"
            className="h-full w-full object-contain bg-black"
          />
        ) : (
          <button
            type="button"
            onClick={() => v.video_url && setPlaying(true)}
            className="absolute inset-0 group/play"
            aria-label="Play"
          >
            {v.thumbnail_url ? (
              <img
                src={v.thumbnail_url}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover group-hover/play:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-br from-secondary to-card" />
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/play:bg-black/30 transition">
              <span className="h-14 w-14 rounded-full gradient-brand flex items-center justify-center shadow-xl shadow-primary/40">
                <svg viewBox="0 0 24 24" className="h-6 w-6 ml-1 fill-primary-foreground"><path d="M8 5v14l11-7z"/></svg>
              </span>
            </span>
            <span className="absolute top-2 left-2 text-[10px] uppercase tracking-wider font-semibold bg-primary/90 text-primary-foreground px-2 py-0.5 rounded-full">
              {v.category}
            </span>
          </button>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-display font-semibold text-sm leading-snug line-clamp-2">{v.title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{v.channel_name ?? ""}</p>
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <Stat icon={Eye} n={v.views} />
          <Stat icon={Heart} n={v.likes} />
          <Stat icon={MessageCircle} n={v.comments_count} />
          <Stat icon={Repeat2} n={v.reposts} />
          <Stat icon={Share2} n={v.shares} />
        </div>
      </div>
    </article>
  );
}

function Stat({ icon: Icon, n }: { icon: typeof Eye; n: number }) {
  return (
    <span className="flex items-center gap-1">
      <Icon className="h-3.5 w-3.5" />
      {formatCount(n)}
    </span>
  );
}
