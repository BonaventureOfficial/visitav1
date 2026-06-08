import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { VideoCard } from "@/components/VideoCard";
import { mockVideos, type Category } from "@/lib/mock-videos";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Visita — Shows, Podcasts & Documentaries" },
      { name: "description", content: "Stream the best shows, podcasts and documentaries on Visita." },
      { property: "og:title", content: "Visita" },
      { property: "og:description", content: "Shows, podcasts and documentaries — all in one place." },
    ],
  }),
  component: Home,
});

function Home() {
  const { t } = useI18n();
  const [filter, setFilter] = useState<Category | "all">("all");
  const list = useMemo(
    () => (filter === "all" ? mockVideos : mockVideos.filter((v) => v.category === filter)),
    [filter],
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
        <div className="rounded-3xl gradient-brand p-6 md:p-10 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
          <div className="relative max-w-xl">
            <p className="uppercase tracking-[0.2em] text-xs text-primary-foreground/80">
              {t("discover")}
            </p>
            <h1 className="mt-2 text-3xl md:text-5xl font-display font-bold text-primary-foreground">
              {t("welcome")}
            </h1>
            <p className="mt-3 text-primary-foreground/90 text-sm md:text-base">{t("tagline")}</p>
          </div>
        </div>

        <div className="mt-6 flex gap-2 overflow-x-auto no-scrollbar pb-1">
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

        <h2 className="mt-6 text-lg font-display font-semibold">{t("trending")}</h2>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((v) => (
            <VideoCard key={v.id} v={v} />
          ))}
        </div>
      </section>
    </AppLayout>
  );
}
