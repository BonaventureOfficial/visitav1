import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { LogOut, User as UserIcon, Eye, Play, Film, Camera, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { formatCount } from "@/lib/format";
import { usePlayer } from "@/lib/player";
import { toast } from "sonner";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — Visita" }] }),
  component: ProfilePage,
});

interface MyVideo {
  id: string; title: string; thumbnail_url: string | null; video_url: string | null;
  views: number; likes: number; comments_count: number; channel_name: string | null; user_id: string | null;
}

function ProfilePage() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { play } = usePlayer();
  const [channelName, setChannelName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [videos, setVideos] = useState<MyVideo[]>([]);
  const [followerCount, setFollowerCount] = useState(0);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("channel_name,avatar_url").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data?.channel_name) setChannelName(data.channel_name);
        if ((data as any)?.avatar_url) setAvatarUrl((data as any).avatar_url);
      });
    supabase.from("videos").select("id,title,thumbnail_url,video_url,views,likes,comments_count,channel_name,user_id")
      .eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setVideos((data ?? []) as MyVideo[]));
    supabase.from("follows").select("id", { count: "exact", head: true }).eq("following_id", user.id)
      .then(({ count }) => setFollowerCount(count ?? 0));
  }, [user]);

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
      toast.success("✓");
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("👋");
    navigate({ to: "/" });
  };

  if (!user) return null;

  const totals = videos.reduce(
    (a, v) => ({ views: a.views + v.views, likes: a.likes + v.likes, comments: a.comments + v.comments_count }),
    { views: 0, likes: 0, comments: 0 },
  );

  return (
    <AppLayout>
      <section className="mx-auto max-w-3xl px-4 pt-6">
        <div className="rounded-3xl bg-card border border-border p-5 flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="relative h-16 w-16 rounded-full overflow-hidden gradient-brand flex items-center justify-center text-primary-foreground shadow-xl shadow-primary/30 group shrink-0"
            aria-label="Change avatar"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <UserIcon className="h-7 w-7" />
            )}
            <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
              {uploading ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <Camera className="h-5 w-5 text-white" />}
            </span>
            {uploading && (
              <span className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              </span>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-xl font-bold truncate">{channelName || t("myChannel")}</h1>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            <p className="text-xs text-primary mt-0.5">{formatCount(followerCount)} followers</p>
          </div>
          <button onClick={signOut} className="rounded-full p-2.5 bg-secondary hover:bg-accent text-muted-foreground hover:text-foreground" aria-label={t("signOut")}>
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          {[
            { label: t("views"), val: formatCount(totals.views) },
            { label: t("likes"), val: formatCount(totals.likes) },
            { label: t("comments"), val: formatCount(totals.comments) },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl bg-card border border-border p-4">
              <p className="font-display text-2xl font-bold text-primary">{s.val}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-8 mb-3 font-display text-lg font-bold flex items-center gap-2">
          <Film className="h-4 w-4 text-primary" /> {t("library")}
        </h2>

        {videos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            {t("noVideosYet")}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {videos.map((v) => (
              <button
                key={v.id}
                onClick={() => v.video_url && play({
                  id: v.id, title: v.title, video_url: v.video_url,
                  thumbnail_url: v.thumbnail_url, channel_name: v.channel_name, user_id: v.user_id,
                })}
                className="group relative aspect-square rounded-xl overflow-hidden bg-card border border-border/60 hover:border-primary/50 transition"
              >
                {v.thumbnail_url ? (
                  <img src={v.thumbnail_url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-secondary to-card" />
                )}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-1.5 flex items-center justify-between text-[10px] font-semibold text-white">
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {formatCount(v.views)}</span>
                </span>
                <span className="absolute bottom-1.5 right-1.5 h-7 w-7 rounded-full border border-primary bg-black/80 flex items-center justify-center text-primary opacity-0 group-hover:opacity-100 transition">
                  <Play className="h-3.5 w-3.5 ml-0.5 fill-primary" />
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="h-6" />
      </section>
    </AppLayout>
  );
}
