import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, UploadCloud, Film, Image as ImageIcon, X } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/upload")({
  head: () => ({ meta: [{ title: "New video — Visita" }] }),
  component: UploadPage,
});

type Cat = "emission" | "podcast" | "documentary";

const YEAR = 60 * 60 * 24 * 365;

function UploadPage() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [frames, setFrames] = useState<string[]>([]); // 3 auto frames as data URLs
  const [customThumb, setCustomThumb] = useState<{ url: string; blob: Blob } | null>(null);
  const [selectedThumb, setSelectedThumb] = useState<number | "custom" | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Cat>("emission");
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
      if (customThumb) URL.revokeObjectURL(customThumb.url);
    };
  }, [videoUrl, customThumb]);

  if (!loading && !user) {
    return (
      <AppLayout>
        <section className="mx-auto max-w-md px-4 pt-16 text-center">
          <UploadCloud className="h-12 w-12 mx-auto text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">{t("signInToUpload")}</p>
          <Link
            to="/auth"
            className="inline-flex mt-6 rounded-xl gradient-brand text-primary-foreground font-semibold px-6 py-3 text-sm"
          >
            {t("signIn")}
          </Link>
        </section>
      </AppLayout>
    );
  }

  const onPickVideo = (file: File) => {
    if (!file.type.startsWith("video/")) {
      toast.error("Invalid video file");
      return;
    }
    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setFrames([]);
    setSelectedThumb(null);
  };

  const onLoadedMetadata = async () => {
    const video = videoRef.current;
    if (!video) return;
    const duration = video.duration;
    if (!isFinite(duration) || duration <= 0) return;
    const times = [duration * 0.25, duration * 0.5, duration * 0.75];
    const captured: string[] = [];
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    for (const time of times) {
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          captured.push(canvas.toDataURL("image/jpeg", 0.85));
          video.removeEventListener("seeked", onSeeked);
          resolve();
        };
        video.addEventListener("seeked", onSeeked);
        video.currentTime = time;
      });
    }
    setFrames(captured);
    setSelectedThumb(1);
  };

  const dataUrlToBlob = (dataUrl: string): Blob => {
    const [header, b64] = dataUrl.split(",");
    const mime = header.match(/data:(.*?);/)?.[1] ?? "image/jpeg";
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!title.trim()) {
      toast.error(t("titleRequired"));
      return;
    }
    if (!videoFile) {
      toast.error(t("videoRequired"));
      return;
    }
    if (selectedThumb === null) {
      toast.error(t("thumbRequired"));
      return;
    }

    setSubmitting(true);
    setProgress(5);
    try {
      const ext = videoFile.name.split(".").pop()?.toLowerCase() || "mp4";
      const id = crypto.randomUUID();
      const videoPath = `${user.id}/${id}.${ext}`;

      // Raw quality preserved — direct upload, long cache
      const { error: vErr } = await supabase.storage
        .from("videos")
        .upload(videoPath, videoFile, {
          cacheControl: "31536000",
          contentType: videoFile.type || "video/mp4",
          upsert: false,
        });
      if (vErr) throw vErr;
      setProgress(70);

      // Thumbnail
      const thumbBlob =
        selectedThumb === "custom" ? customThumb!.blob : dataUrlToBlob(frames[selectedThumb]);
      const thumbExt = thumbBlob.type === "image/png" ? "png" : "jpg";
      const thumbPath = `${user.id}/${id}.${thumbExt}`;
      const { error: tErr } = await supabase.storage
        .from("thumbnails")
        .upload(thumbPath, thumbBlob, {
          cacheControl: "31536000",
          contentType: thumbBlob.type || "image/jpeg",
          upsert: false,
        });
      if (tErr) throw tErr;
      setProgress(85);

      // Long-lived signed URLs (private buckets)
      const [{ data: vSigned }, { data: tSigned }] = await Promise.all([
        supabase.storage.from("videos").createSignedUrl(videoPath, YEAR),
        supabase.storage.from("thumbnails").createSignedUrl(thumbPath, YEAR),
      ]);

      const { data: profile } = await supabase
        .from("profiles")
        .select("channel_name")
        .eq("id", user.id)
        .maybeSingle();

      const { error: insErr } = await supabase.from("videos").insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        category,
        video_url: vSigned?.signedUrl ?? null,
        thumbnail_url: tSigned?.signedUrl ?? null,
        channel_name: profile?.channel_name ?? user.email?.split("@")[0] ?? null,
      });
      if (insErr) throw insErr;

      setProgress(100);
      toast.success("✓");
      navigate({ to: "/" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <section className="mx-auto max-w-2xl px-4 pt-6">
        <h1 className="font-display text-2xl font-bold">{t("uploadTitle")}</h1>

        <form onSubmit={onSubmit} className="mt-6 space-y-6">
          {/* Video dropzone — orange HD frame */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              {t("videoFile")} <span className="text-primary">*</span>
            </label>
            <label
              className="relative block aspect-video rounded-2xl border-2 border-dashed border-primary/70 bg-primary/5 hover:bg-primary/10 transition cursor-pointer overflow-hidden"
              style={{ boxShadow: "0 0 0 1px hsl(var(--primary)/0.3), 0 20px 60px -20px hsl(var(--primary)/0.3)" }}
            >
              <input
                type="file"
                accept="video/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPickVideo(f);
                }}
              />
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={onLoadedMetadata}
                  className="h-full w-full bg-black object-contain"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                  <div className="h-14 w-14 rounded-2xl gradient-brand flex items-center justify-center shadow-lg shadow-primary/30">
                    <Film className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <p className="mt-3 font-display font-semibold text-foreground">
                    {t("dropVideo")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{t("dropVideoHint")}</p>
                </div>
              )}
            </label>
            {videoFile && (
              <p className="mt-2 text-[11px] text-muted-foreground truncate">
                {videoFile.name} • {(videoFile.size / 1024 / 1024).toFixed(1)} MB
              </p>
            )}
          </div>

          {/* Title (required) */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {t("title")} <span className="text-primary">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
              placeholder={t("titlePlaceholder")}
              className="w-full rounded-xl bg-input border border-border px-4 py-3 text-sm outline-none focus:border-primary"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {t("description")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={3}
              className="w-full rounded-xl bg-input border border-border px-4 py-3 text-sm outline-none focus:border-primary resize-none"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              {t("category")}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["emission", "podcast", "documentary"] as const).map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`rounded-xl border py-2.5 text-xs font-medium capitalize ${
                    category === c
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card border-border text-muted-foreground"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Thumbnail picker */}
          {videoFile && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">
                {t("chooseThumb")} <span className="text-primary">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {frames.length === 0
                  ? [0, 1, 2].map((i) => (
                      <div key={i} className="aspect-video rounded-xl bg-card animate-pulse" />
                    ))
                  : frames.map((f, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedThumb(i)}
                        className={`relative aspect-video rounded-xl overflow-hidden border-2 transition ${
                          selectedThumb === i ? "border-primary" : "border-transparent"
                        }`}
                      >
                        <img src={f} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <label className="flex-1 cursor-pointer rounded-xl border border-border bg-card px-3 py-2.5 text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  {t("uploadCustomThumb")}
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const url = URL.createObjectURL(f);
                      setCustomThumb({ url, blob: f });
                      setSelectedThumb("custom");
                    }}
                  />
                </label>
                {customThumb && (
                  <div className="relative h-14 w-24 rounded-lg overflow-hidden border-2 border-primary">
                    <img src={customThumb.url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        URL.revokeObjectURL(customThumb.url);
                        setCustomThumb(null);
                        if (selectedThumb === "custom") setSelectedThumb(frames.length ? 1 : null);
                      }}
                      className="absolute top-0.5 right-0.5 bg-black/70 rounded-full p-0.5"
                      aria-label="Remove"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Submit */}
          {submitting && (
            <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full gradient-brand transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl gradient-brand text-primary-foreground font-semibold py-3.5 text-sm shadow-lg shadow-primary/20 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? `${progress}%` : t("publish")}
          </button>
        </form>
      </section>
    </AppLayout>
  );
}
