import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { getAdminAnalytics, recomputeRanking } from "@/lib/ranking.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Analytics — Visita Ranking Engine" },
      { name: "description", content: "Tableau de bord des performances du feed, des vidéos et des créateurs Visita." },
      { property: "og:title", content: "Analytics — Visita Ranking Engine" },
      { property: "og:description", content: "Performances du feed, des vidéos et des créateurs Visita." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type Data = Awaited<ReturnType<typeof getAdminAnalytics>>;

function AdminPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () => {
    getAdminAnalytics()
      .then(setData)
      .catch(() => setError("Accès réservé aux administrateurs."));
  };
  useEffect(load, []);

  const recompute = async () => {
    setBusy(true);
    try {
      await recomputeRanking();
      toast.success("Scores recalculés");
      load();
    } catch {
      toast.error("Recalcul impossible");
    }
    setBusy(false);
  };

  if (error) {
    return (
      <AppLayout>
        <div className="p-6 text-center text-muted-foreground">{error}</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl font-bold">Ranking Analytics</h1>
          <button
            onClick={recompute}
            disabled={busy}
            className="rounded-xl gradient-brand text-primary-foreground text-sm font-semibold px-4 py-2 disabled:opacity-60"
          >
            {busy ? "Calcul…" : "Recalculer"}
          </button>
        </div>

        {!data ? (
          <p className="text-muted-foreground text-sm">Chargement…</p>
        ) : (
          <>
            <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Stat label="Impressions" value={data.feed.impressions} />
              <Stat label="Heures vues" value={data.feed.watchHours} />
              <Stat label="Complétions" value={data.feed.completions} />
              <Stat label="Complétion moy." value={`${data.feed.avgCompletion}%`} />
              <Stat label="Skips" value={data.feed.skips} />
              <Stat label="Signaux négatifs" value={data.feed.negatives} />
            </section>

            <section>
              <h2 className="font-semibold mb-2">Événements (7 jours)</h2>
              <div className="flex flex-wrap gap-2">
                {Object.entries(data.counts).map(([k, v]) => (
                  <span key={k} className="rounded-lg border border-border bg-card px-3 py-1 text-xs">
                    {k}: <span className="text-primary font-semibold">{v}</span>
                  </span>
                ))}
              </div>
            </section>

            <section>
              <h2 className="font-semibold mb-2">Top vidéos (score final)</h2>
              <div className="space-y-2">
                {data.topVideos.map((v) => (
                  <div key={v.video_id} className="rounded-xl border border-border bg-card p-3 text-sm">
                    <div className="font-medium truncate">{v.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {v.channel_name} · score {v.final_score.toFixed(1)} · qualité {v.quality_score.toFixed(1)} ·
                      tendance {v.trending_score.toFixed(1)} · exploration {v.exploration_boost.toFixed(1)}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 className="font-semibold mb-2">Top créateurs</h2>
              <div className="space-y-2">
                {data.topCreators.map((c) => (
                  <div key={c.user_id} className="rounded-xl border border-border bg-card p-3 text-sm">
                    <div className="font-medium truncate">{c.channel_name}</div>
                    <div className="text-xs text-muted-foreground">
                      qualité {c.quality_score.toFixed(1)} · {c.followers} abonnés · {c.videos_count} vidéos ·
                      complétion {(c.avg_completion * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </AppLayout>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-lg font-bold text-primary">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
