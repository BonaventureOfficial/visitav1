import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { User as UserIcon, Eye, Play, Film, Camera, Loader2, Zap, Image as ImageIcon, Trash2, X, Settings as SettingsIcon, Pencil, Check, Lock, CalendarDays, Mail, History as HistoryIcon, Type as TypeIcon } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { formatCount } from "@/lib/format";
import { maskEmail } from "@/lib/mask";
import { setMyAvatar } from "@/lib/avatar-store";
import { usePlayer } from "@/lib/player";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Visita" },
      { name: "description", content: "Your Visita channel: bio, stats and video library." },
      { property: "og:title", content: "Profile — Visita" },
      { property: "og:description", content: "Your Visita channel: bio, stats and video library." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

const LOCK_DAYS = 90;
const LOCK_MS = LOCK_DAYS * 24 * 60 * 60 * 1000;

function lockInfo(updatedAt: string | null) {
  if (!updatedAt) return { locked: false, daysLeft: 0 };
  const next = new Date(updatedAt).getTime() + LOCK_MS;
  const diff = next - Date.now();
  return { locked: diff > 0, daysLeft: Math.ceil(diff / (24 * 60 * 60 * 1000)) };
}

interface MyVideo {
  id: string; title: string; thumbnail_url: string | null; video_url: string | null;
  views: number; likes: number; comments_count: number; supav_count: number;
  channel_name: string | null; user_id: string | null; is_reel: boolean | null;
  duration_seconds: number | null; description?: string | null;
}

function ProfilePage() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { play } = usePlayer();
  const [channelName, setChannelName] = useState<string>("");
  const [bio, setBio] = useState<string>("");
  const [joinedAt, setJoinedAt] = useState<string | null>(null);
  const [nameUpdatedAt, setNameUpdatedAt] = useState<string | null>(null);
  const [bioUpdatedAt, setBioUpdatedAt] = useState<string | null>(null);
  const [editName, setEditName] = useState(false);
  const [editBio, setEditBio] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [bioDraft, setBioDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLInputElement>(null);
  const [videos, setVideos] = useState<MyVideo[]>([]);
  const [tab, setTab] = useState<"videos" | "reels">("videos");
  const [followerCount, setFollowerCount] = useState(0);
  const [selected, setSelected] = useState<MyVideo | null>(null);
  const [busy, setBusy] = useState(false);
  const [editMeta, setEditMeta] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");
  const [history, setHistory] = useState<MyVideo[]>([]);

  const nameLock = lockInfo(nameUpdatedAt);
  const bioLock = lockInfo(bioUpdatedAt);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  const reloadVideos = () => {
    if (!user) return;
    supabase.from("videos").select("id,title,description,thumbnail_url,video_url,views,likes,comments_count,supav_count,channel_name,user_id,is_reel,duration_seconds")
      .eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setVideos((data ?? []) as MyVideo[]));
  };

  const loadHistory = async () => {
    if (!user) return;
    const { data: views } = await supabase.from("video_views")
      .select("video_id,created_at").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(40);
    const ids: string[] = [];
    for (const v of (views ?? []) as { video_id: string }[]) {
      if (!ids.includes(v.video_id)) ids.push(v.video_id);
      if (ids.length === 5) break;
    }
    if (ids.length === 0) { setHistory([]); return; }
    const { data: vids } = await supabase.from("videos")
      .select("id,title,description,thumbnail_url,video_url,views,likes,comments_count,supav_count,channel_name,user_id,is_reel,duration_seconds")
      .in("id", ids);
    const map = new Map((vids ?? []).map((v: any) => [v.id, v as MyVideo]));
    setHistory(ids.map((id) => map.get(id)).filter(Boolean) as MyVideo[]);
  };

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles")
      .select("channel_name,avatar_url,bio,created_at,channel_name_updated_at,bio_updated_at")
      .eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        const p = data as any;
        if (p?.channel_name) { setChannelName(p.channel_name); setNameDraft(p.channel_name); }
        if (p?.avatar_url) { setAvatarUrl(p.avatar_url); setMyAvatar(p.avatar_url); }
        if (p?.bio) { setBio(p.bio); setBioDraft(p.bio); }
        setJoinedAt(p?.created_at ?? null);
        setNameUpdatedAt(p?.channel_name_updated_at ?? null);
        setBioUpdatedAt(p?.bio_updated_at ?? null);
      });
    reloadVideos();
    loadHistory();
    supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", user.id)
      .then(({ count }) => setFollowerCount(count ?? 0));
  }, [user]);

  const saveName = async () => {
    if (!user) return;
    const value = nameDraft.trim();
    if (value.length < 3 || value.length > 40) { toast.error("3 to 40 characters"); return; }
    if (value === channelName) { setEditName(false); return; }
    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from("profiles")
      .update({ channel_name: value, channel_name_updated_at: now } as any).eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setChannelName(value); setNameUpdatedAt(now); setEditName(false);
    toast.success(`Channel name updated — locked for ${LOCK_DAYS} days`);
  };

  const saveBio = async () => {
    if (!user) return;
    const value = bioDraft.trim().slice(0, 200);
    if (value === bio) { setEditBio(false); return; }
    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from("profiles")
      .update({ bio: value, bio_updated_at: now } as any).eq("id", user.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setBio(value); setBioUpdatedAt(now); setEditBio(false);
    toast.success(`Bio updated — locked for ${LOCK_DAYS} days`);
  };


  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) { toast.error("Image only"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
        cacheControl: "3600", upsert: true, contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage.from("avatars")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (sErr || !signed) throw sErr ?? new Error("URL");
      const url = signed.signedUrl;
      const { error: pErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      if (pErr) throw pErr;
      setAvatarUrl(url);
      setMyAvatar(url);

      toast.success("✓");
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onPickThumb = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user || !selected) return;
    if (!file.type.startsWith("image/")) { toast.error("Image only"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${selected.id}-thumb-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("thumbnails").upload(path, file, {
        cacheControl: "3600", upsert: true, contentType: file.type,
      });
      if (upErr) throw upErr;
      const { data: signed, error: sErr } = await supabase.storage.from("thumbnails")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (sErr || !signed) throw sErr ?? new Error("URL");
      const url = signed.signedUrl;
      const { error: uErr } = await supabase.from("videos").update({ thumbnail_url: url }).eq("id", selected.id);
      if (uErr) throw uErr;
      toast.success("Thumbnail updated");
      setSelected(null);
      reloadVideos();
    } catch (err: any) {
      toast.error(err?.message ?? "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const deleteVideo = async () => {
    if (!selected || !user) return;
    if (!confirm("Delete this video permanently? This cannot be undone.")) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("videos").delete().eq("id", selected.id);
      if (error) throw error;
      toast.success("Video deleted");
      setSelected(null);
      reloadVideos();
    } catch (err: any) {
      toast.error(err?.message ?? "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const saveMeta = async () => {
    if (!selected || !user) return;
    const title = titleDraft.trim();
    if (title.length < 3) { toast.error("Titre trop court"); return; }
    const description = descDraft.trim().slice(0, 2000);
    setBusy(true);
    try {
      const { error } = await supabase.from("videos")
        .update({ title, description }).eq("id", selected.id);
      if (error) throw error;
      toast.success("Vidéo mise à jour");
      setSelected({ ...selected, title, description });
      setEditMeta(false);
      reloadVideos();
    } catch (err: any) {
      toast.error(err?.message ?? "Échec de la mise à jour");
    } finally {
      setBusy(false);
    }
  };


  if (!user) return null;

  const totals = videos.reduce(
    (a, v) => ({
      views: a.views + v.views, likes: a.likes + v.likes,
      comments: a.comments + v.comments_count, supavs: a.supavs + (v.supav_count ?? 0),
    }),
    { views: 0, likes: 0, comments: 0, supavs: 0 },
  );

  return (
    <AppLayout>
      <section className="mx-auto max-w-3xl px-4 pt-6">
        <div className="rounded-3xl bg-card border border-border p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-primary" />
                Joined{" "}
                {joinedAt
                  ? new Date(joinedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
                  : "—"}
              </p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-primary" /> {maskEmail(user.email)}
              </p>

              {editName ? (
                <div className="flex items-center gap-2">
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    maxLength={40}
                    className="flex-1 min-w-0 rounded-xl bg-secondary border border-border px-3 py-2 text-sm outline-none focus:border-primary"
                    placeholder="Channel name"
                  />
                  <button onClick={saveName} disabled={saving} className="rounded-xl bg-primary text-primary-foreground p-2 disabled:opacity-60" aria-label="Save name">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </button>
                  <button onClick={() => { setEditName(false); setNameDraft(channelName); }} className="rounded-xl bg-secondary p-2" aria-label="Cancel">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="font-display text-xl font-bold truncate">{channelName || t("myChannel")}</h1>
                  <button
                    onClick={() => (nameLock.locked ? toast.error(`Name change available in ${nameLock.daysLeft} days`) : setEditName(true))}
                    className="shrink-0 rounded-full p-1.5 bg-secondary text-muted-foreground hover:text-foreground"
                    aria-label="Edit channel name"
                  >
                    {nameLock.locked ? <Lock className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                  </button>
                </div>
              )}
              {nameLock.locked && !editName && (
                <p className="text-[10px] text-muted-foreground">Editable again in {nameLock.daysLeft} days</p>
              )}

              <p className="text-xs text-primary">{formatCount(followerCount)} followers</p>
            </div>

            <Link
              to="/settings"
              className="rounded-full p-2.5 bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground shrink-0"
              aria-label="Settings"
            >
              <SettingsIcon className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-3 rounded-2xl border border-border bg-secondary/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Bio</p>
              {!editBio && (
                <button
                  onClick={() => (bioLock.locked ? toast.error(`Bio change available in ${bioLock.daysLeft} days`) : setEditBio(true))}
                  className="rounded-full p-1.5 text-muted-foreground hover:text-foreground"
                  aria-label="Edit bio"
                >
                  {bioLock.locked ? <Lock className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
            {editBio ? (
              <div className="mt-2 space-y-2">
                <textarea
                  value={bioDraft}
                  onChange={(e) => setBioDraft(e.target.value.slice(0, 200))}
                  rows={3}
                  className="w-full rounded-xl bg-background border border-border px-3 py-2 text-sm outline-none focus:border-primary resize-none"
                  placeholder="Tell viewers about your channel…"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">{bioDraft.length}/200</span>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditBio(false); setBioDraft(bio); }} className="rounded-xl bg-secondary px-3 py-1.5 text-xs font-semibold">Cancel</button>
                    <button onClick={saveBio} disabled={saving} className="rounded-xl bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold disabled:opacity-60">
                      {saving ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <p className="mt-1 text-sm text-foreground/90 whitespace-pre-wrap">
                  {bio || <span className="text-muted-foreground">No bio yet.</span>}
                </p>
                {bioLock.locked && (
                  <p className="mt-1 text-[10px] text-muted-foreground">Editable again in {bioLock.daysLeft} days</p>
                )}
              </>
            )}
          </div>

          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="relative h-24 w-24 rounded-full overflow-hidden gradient-brand flex items-center justify-center text-primary-foreground shadow-xl shadow-primary/30 group"
              aria-label="Change avatar"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <UserIcon className="h-9 w-9" />
              )}
              <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                <Camera className="h-5 w-5 text-white" />
              </span>
              {uploading && (
                <span className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                </span>
              )}
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
        </div>


        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          {[
            { label: t("views"), val: formatCount(totals.views), icon: null },
            { label: t("likes"), val: formatCount(totals.likes), icon: null },
            { label: "SupaV", val: formatCount(totals.supavs), icon: <Zap className="h-3 w-3 fill-current" /> },
            { label: t("comments"), val: formatCount(totals.comments), icon: null },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-card border border-border p-4">
              <p className="font-display text-2xl font-bold text-primary">{s.val}</p>
              <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-center gap-1">
                {s.icon}{s.label}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <Film className="h-4 w-4 text-primary" /> {t("library")}
          </h2>
          <div className="inline-flex rounded-full bg-secondary p-0.5 text-xs font-semibold">
            {(["videos", "reels"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`px-3 py-1.5 rounded-full transition ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                {k === "videos" ? "Videos" : "Reels"}
              </button>
            ))}
          </div>
        </div>

        {(() => {
          const shown = videos.filter((v) => (tab === "reels" ? v.is_reel === true : v.is_reel !== true));
          return shown.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            {t("noVideosYet")}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {shown.map((v) => (
              <button
                key={v.id}
                onClick={() => { setSelected(v); setEditMeta(false); setTitleDraft(v.title); setDescDraft(v.description ?? ""); }}
                className="group relative aspect-square rounded-xl overflow-hidden bg-card border border-border/60 hover:border-primary/50 transition"
              >
                {v.thumbnail_url ? (
                  <img src={v.thumbnail_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-secondary to-card" />
                )}
                <span className="absolute top-1.5 right-1.5 text-[10px] font-semibold bg-black/75 backdrop-blur text-primary border border-primary/40 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                  <Zap className="h-2.5 w-2.5 fill-current" /> {formatCount(v.supav_count ?? 0)}
                </span>
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-1.5 flex items-center justify-between text-[10px] font-semibold text-white">
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {formatCount(v.views)}</span>
                </span>
              </button>
            ))}
          </div>
        );
        })()}

        <div className="mt-8 mb-3 flex items-center gap-2">
          <h2 className="font-display text-lg font-bold flex items-center gap-2">
            <HistoryIcon className="h-4 w-4 text-primary" /> Historique
          </h2>
          <span className="text-[11px] text-muted-foreground">5 dernières vidéos regardées</span>
        </div>

        {history.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Aucun historique pour l'instant.
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((v) => (
              <button
                key={v.id}
                onClick={() => {
                  if (!v.video_url) return;
                  play({
                    id: v.id, title: v.title, video_url: v.video_url,
                    thumbnail_url: v.thumbnail_url, channel_name: v.channel_name,
                    user_id: v.user_id, views: v.views,
                  });
                }}
                className="w-full flex items-center gap-3 rounded-2xl bg-card border border-border hover:border-primary/50 p-2 text-left transition"
              >
                <div className="relative h-14 w-24 shrink-0 rounded-xl overflow-hidden bg-black">
                  {v.thumbnail_url ? (
                    <img src={v.thumbnail_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-secondary to-card" />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                      <Play className="h-3 w-3 text-black fill-black" />
                    </span>
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold line-clamp-1">{v.title}</p>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">{v.channel_name}</p>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Eye className="h-3 w-3" /> {formatCount(v.views)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="h-6" />
      </section>


      {selected && (
        <div
          className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={() => !busy && setSelected(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-card border border-border p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="h-16 w-16 rounded-xl overflow-hidden bg-black shrink-0">
                {selected.thumbnail_url && (
                  <img src={selected.thumbnail_url} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm line-clamp-2">{selected.title}</p>
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2">
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {formatCount(selected.views)}</span>
                  <span className="flex items-center gap-1 text-primary"><Zap className="h-3 w-3 fill-current" /> {formatCount(selected.supav_count ?? 0)}</span>
                </p>
              </div>
              <button onClick={() => setSelected(null)} disabled={busy} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-2">
              <button
                onClick={() => {
                  if (!selected.video_url) return;
                  play({
                    id: selected.id, title: selected.title, video_url: selected.video_url,
                    thumbnail_url: selected.thumbnail_url, channel_name: selected.channel_name,
                    user_id: selected.user_id, views: selected.views,
                  });
                  setSelected(null);
                }}
                className="w-full flex items-center gap-3 rounded-xl bg-secondary hover:bg-accent px-4 py-3 text-sm font-semibold transition"
              >
                <Play className="h-4 w-4 text-primary fill-primary" /> Play
              </button>
              <button
                onClick={() => thumbRef.current?.click()}
                disabled={busy}
                className="w-full flex items-center gap-3 rounded-xl bg-secondary hover:bg-accent px-4 py-3 text-sm font-semibold transition disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <ImageIcon className="h-4 w-4 text-primary" />}
                Change thumbnail from storage
              </button>
              <button
                onClick={deleteVideo}
                disabled={busy}
                className="w-full flex items-center gap-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-3 text-sm font-semibold transition disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" /> Delete video permanently
              </button>
            </div>
            <input ref={thumbRef} type="file" accept="image/*" className="hidden" onChange={onPickThumb} />
          </div>
        </div>
      )}
    </AppLayout>
  );
}
