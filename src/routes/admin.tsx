import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { getAdminAnalytics, recomputeRanking } from "@/lib/ranking.functions";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { VerifiedBadge, type Tier } from "@/components/VerifiedBadge";
import {
  adminListMembers,
  adminRecentVideos,
  adminSetRole,
  adminSetVerification,
  adminDeleteVideo,
} from "@/lib/admin.functions";

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

            <ControlCenter />
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

type Member = Awaited<ReturnType<typeof adminListMembers>>[number];
type RecentVideo = Awaited<ReturnType<typeof adminRecentVideos>>[number];

const TIERS = ["platinum", "gold", "blue"] as const;

function ControlCenter() {
  const [members, setMembers] = useState<Member[]>([]);
  const [videos, setVideos] = useState<RecentVideo[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    adminListMembers().then(setMembers).catch(() => {});
    adminRecentVideos().then(setVideos).catch(() => {});
  };
  useEffect(load, []);

  const setTier = async (userId: string, tier: (typeof TIERS)[number] | null) => {
    setBusy(userId);
    try {
      await adminSetVerification({ data: { userId, tier } });
      toast.success(tier ? `Badge ${tier} accordé` : "Badge retiré");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action impossible");
    }
    setBusy(null);
  };

  const toggleRole = async (userId: string, role: "admin" | "moderator", grant: boolean) => {
    setBusy(userId);
    try {
      await adminSetRole({ data: { userId, role, grant } });
      toast.success(grant ? `Rôle ${role} accordé` : `Rôle ${role} retiré`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action impossible");
    }
    setBusy(null);
  };

  const removeVideo = async (videoId: string) => {
    setBusy(videoId);
    try {
      await adminDeleteVideo({ data: { videoId } });
      toast.success("Vidéo supprimée");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Suppression impossible");
    }
    setBusy(null);
  };

  const filtered = members.filter(
    (m) =>
      !q.trim() ||
      (m.channel_name ?? "").toLowerCase().includes(q.toLowerCase()) ||
      (m.email ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <>
      <section>
        <h2 className="font-semibold mb-2 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" /> Contrôle absolu — Membres
        </h2>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher une chaîne ou un email…"
          className="w-full h-10 rounded-xl bg-secondary border border-border px-3 text-sm outline-none focus:border-primary mb-3"
        />
        <div className="space-y-2">
          {filtered.map((m) => (
            <div key={m.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
              <div className="flex items-center gap-2">
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <span className="h-8 w-8 rounded-full bg-secondary" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-sm font-medium truncate">
                    {m.channel_name ?? "—"}
                    {m.tier && <VerifiedBadge tier={m.tier as Tier} className="h-3.5 w-3.5" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {m.email} · {m.videos} vidéos {m.roles.length > 0 && `· ${m.roles.join(", ")}`}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {TIERS.map((tier) => (
                  <button
                    key={tier}
                    disabled={busy === m.id}
                    onClick={() => setTier(m.id, tier)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold border ${
                      m.tier === tier
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary border-border text-muted-foreground"
                    }`}
                  >
                    {tier}
                  </button>
                ))}
                {m.tier && (
                  <button
                    disabled={busy === m.id}
                    onClick={() => setTier(m.id, null)}
                    className="rounded-lg px-2.5 py-1 text-[11px] font-semibold bg-secondary border border-border text-muted-foreground"
                  >
                    retirer badge
                  </button>
                )}
                {(["admin", "moderator"] as const).map((role) => {
                  const has = m.roles.includes(role);
                  return (
                    <button
                      key={role}
                      disabled={busy === m.id}
                      onClick={() => toggleRole(m.id, role, !has)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold border ${
                        has ? "bg-primary/20 text-primary border-primary/40" : "bg-secondary border-border text-muted-foreground"
                      }`}
                    >
                      {has ? `− ${role}` : `+ ${role}`}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-2">Modération des contenus</h2>
        <div className="space-y-2">
          {videos.map((v) => (
            <div key={v.id} className="rounded-xl border border-border bg-card p-3 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{v.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {v.channel_name ?? "—"} · {v.is_reel ? "Reel" : "Vidéo"} · {v.views} vues · {v.likes} likes ·{" "}
                  {v.supav_count} SupaV
                </p>
              </div>
              <button
                disabled={busy === v.id}
                onClick={() => removeVideo(v.id)}
                className="shrink-0 rounded-lg bg-red-500/15 text-red-400 px-3 py-1.5 text-xs font-semibold hover:bg-red-500/25 disabled:opacity-60"
              >
                Supprimer
              </button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
