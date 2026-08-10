import { useCallback, useEffect, useRef, useState } from "react";
import { Download, X, Loader2, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import { fixWebmDuration } from "@/lib/webm-duration";

function fmt(s: number) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

function safeName(title: string) {
  return (title || "visita").replace(/[^\w\-]+/g, "_").slice(0, 60);
}

/**
 * Bouton "Télécharger" : vidéo entière, ou extrait défini par une barre à
 * deux poignées (glisser les extrémités), avec lecture d'essai de la sélection.
 */
export function DownloadButton({
  videoUrl,
  title,
  className,
}: {
  videoUrl: string | null | undefined;
  title: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [duration, setDuration] = useState(0);
  const [mode, setMode] = useState<"full" | "clip">("full");
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewing, setPreviewing] = useState(false);
  const [cursor, setCursor] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<"start" | "end" | null>(null);
  const cancelRef = useRef(false);
  const stateRef = useRef({ start: 0, end: 0, previewing: false });
  stateRef.current = { start, end, previewing };

  const openModal = () => {
    setOpen(true);
    setProgress(0);
    setMode("full");
    setPreviewing(false);
    setCursor(0);
  };

  useEffect(() => {
    if (!open) return;
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => {
      const d = Number.isFinite(v.duration) ? v.duration : 0;
      setDuration(d);
      setStart(0);
      setEnd(d);
    };
    const onTime = () => {
      setCursor(v.currentTime);
      const { end: e, previewing: p } = stateRef.current;
      if (p && v.currentTime >= e - 0.05) {
        v.pause();
        setPreviewing(false);
      }
    };
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("timeupdate", onTime);
    if (v.readyState >= 1) onMeta();
    return () => {
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("timeupdate", onTime);
    };
  }, [open]);

  // Drag des poignées
  const posFromEvent = useCallback(
    (clientX: number) => {
      const rect = barRef.current?.getBoundingClientRect();
      if (!rect || !duration) return 0;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      return ratio * duration;
    },
    [duration],
  );

  useEffect(() => {
    if (!open) return;
    const move = (clientX: number) => {
      if (!dragRef.current) return;
      const t = posFromEvent(clientX);
      if (dragRef.current === "start") {
        setStart(Math.min(t, stateRef.current.end - 1));
        const v = videoRef.current;
        if (v) v.currentTime = Math.min(t, stateRef.current.end - 1);
      } else {
        setEnd(Math.max(t, stateRef.current.start + 1));
      }
    };
    const onMouse = (e: MouseEvent) => move(e.clientX);
    const onTouch = (e: TouchEvent) => {
      if (e.touches[0]) move(e.touches[0].clientX);
    };
    const up = () => {
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMouse);
    window.addEventListener("touchmove", onTouch, { passive: true });
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", onMouse);
      window.removeEventListener("touchmove", onTouch);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchend", up);
    };
  }, [open, posFromEvent]);

  const togglePreview = async () => {
    const v = videoRef.current;
    if (!v) return;
    if (previewing) {
      v.pause();
      setPreviewing(false);
      return;
    }
    v.currentTime = start;
    setPreviewing(true);
    try {
      await v.play();
    } catch {
      setPreviewing(false);
    }
  };

  const downloadBlob = (blob: Blob, ext: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName(title)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  };

  const downloadFull = async () => {
    if (!videoUrl) return;
    setBusy(true);
    setProgress(0);
    try {
      const res = await fetch(videoUrl);
      if (!res.ok) throw new Error("Téléchargement impossible");
      const total = Number(res.headers.get("content-length") || 0);
      const reader = res.body?.getReader();
      if (!reader) {
        downloadBlob(await res.blob(), "mp4");
      } else {
        const chunks: Uint8Array[] = [];
        let received = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.length;
            if (total) setProgress(Math.round((received / total) * 100));
          }
        }
        downloadBlob(new Blob(chunks as BlobPart[], { type: "video/mp4" }), "mp4");
      }
      toast.success("Vidéo téléchargée");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur de téléchargement");
    } finally {
      setBusy(false);
    }
  };

  const downloadClip = async () => {
    if (!videoUrl) return;
    const from = start;
    const to = end;
    if (to - from < 1) {
      toast.error("Sélection trop courte");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      toast.error("Découpage non supporté sur cet appareil");
      return;
    }
    setBusy(true);
    setProgress(0);
    cancelRef.current = false;

    // Élément dédié pour l'extraction (le lecteur d'aperçu reste intact)
    const el = document.createElement("video");
    el.src = videoUrl;
    el.crossOrigin = "anonymous";
    el.playsInline = true;
    el.muted = true; // évite le double son pendant l'extraction
    el.volume = 0;
    el.preload = "auto";
    el.style.cssText = "position:fixed;left:-9999px;width:1px;height:1px;opacity:0";
    document.body.appendChild(el);

    const cleanup = () => {
      try {
        el.pause();
      } catch {
        /* noop */
      }
      el.removeAttribute("src");
      el.load();
      el.remove();
      setBusy(false);
    };

    try {
      videoRef.current?.pause();
      setPreviewing(false);

      await new Promise<void>((resolve, reject) => {
        el.onloadeddata = () => resolve();
        el.onerror = () => reject(new Error("Lecture impossible"));
      });

      await new Promise<void>((resolve) => {
        el.onseeked = () => resolve();
        el.currentTime = from;
      });

      const media = el as HTMLVideoElement & {
        captureStream?: () => MediaStream;
        mozCaptureStream?: () => MediaStream;
      };
      const stream = media.captureStream?.() ?? media.mozCaptureStream?.();
      if (!stream) throw new Error("Découpage non supporté sur ce navigateur");

      const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find(
        (m) => MediaRecorder.isTypeSupported(m),
      );
      const rec = new MediaRecorder(stream, {
        ...(mime ? { mimeType: mime } : {}),
        videoBitsPerSecond: 6_000_000,
        audioBitsPerSecond: 128_000,
      });
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      const isMp4 = !!mime?.startsWith("video/mp4");
      const done = new Promise<Blob>((resolve) => {
        rec.onstop = () => resolve(new Blob(chunks, { type: isMp4 ? "video/mp4" : "video/webm" }));
      });

      const span = to - from;
      rec.start();
      const t0 = performance.now();
      await el.play();

      await new Promise<void>((resolve) => {
        const tick = () => {
          setProgress(Math.min(99, Math.round(((el.currentTime - from) / span) * 100)));
          if (cancelRef.current || el.currentTime >= to || el.ended) {
            el.pause();
            if (rec.state !== "inactive") rec.stop();
            resolve();
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });

      const elapsedMs = performance.now() - t0;
      let blob = await done;
      if (!isMp4) blob = await fixWebmDuration(blob, Math.round(elapsedMs));
      setProgress(100);
      downloadBlob(blob, isMp4 ? "mp4" : "webm");
      toast.success(`Extrait téléchargé (${fmt(span)})`);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur de découpage");
    } finally {
      cleanup();
    }
  };

  if (!videoUrl) return null;

  const pct = (t: number) => (duration ? (t / duration) * 100 : 0);

  return (
    <>
      <button
        onClick={(e) => {
          e.stopPropagation();
          openModal();
        }}
        className={className ?? "flex items-center gap-1 hover:text-primary transition"}
        aria-label="Télécharger"
      >
        <Download className="h-4 w-4" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-3"
          onClick={(e) => {
            e.stopPropagation();
            if (!busy) setOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card border border-border p-4 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm flex items-center gap-2">
                <Download className="h-4 w-4 text-primary" /> Télécharger
              </p>
              <button
                onClick={() => {
                  cancelRef.current = true;
                  if (!busy) setOpen(false);
                }}
                className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["full", "Vidéo entière"],
                  ["clip", "Couper un extrait"],
                ] as Array<["full" | "clip", string]>
              ).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`h-10 rounded-xl text-sm font-medium border transition ${
                    mode === m
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className={mode === "clip" ? "space-y-3" : "hidden"}>
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  playsInline
                  preload="metadata"
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Barre de coupe à deux poignées */}
              <div className="pt-1 pb-2">
                <div ref={barRef} className="relative h-10 select-none touch-none">
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-secondary" />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-2 rounded-full bg-primary/70"
                    style={{ left: `${pct(start)}%`, width: `${Math.max(0, pct(end) - pct(start))}%` }}
                  />
                  {cursor >= start && cursor <= end && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-4 w-[2px] bg-foreground/80"
                      style={{ left: `${pct(cursor)}%` }}
                    />
                  )}
                  {(["start", "end"] as const).map((h) => (
                    <button
                      key={h}
                      onMouseDown={() => (dragRef.current = h)}
                      onTouchStart={() => (dragRef.current = h)}
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-8 w-5 rounded-md bg-primary border-2 border-background shadow-lg flex items-center justify-center"
                      style={{ left: `${pct(h === "start" ? start : end)}%` }}
                      aria-label={h === "start" ? "Début de l'extrait" : "Fin de l'extrait"}
                    >
                      <span className="h-3 w-[2px] bg-primary-foreground/80 rounded-full" />
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{fmt(start)}</span>
                  <span className="text-primary font-medium">Extrait : {fmt(end - start)}</span>
                  <span>{fmt(end)}</span>
                </div>
              </div>

              <button
                onClick={togglePreview}
                disabled={busy}
                className="w-full h-10 rounded-xl bg-secondary border border-border text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {previewing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {previewing ? "Arrêter l'aperçu" : "Écouter la sélection"}
              </button>
              <p className="text-[10px] text-muted-foreground">
                L'extraction se fait en temps réel : gardez cette fenêtre ouverte jusqu'à 100 %.
              </p>
            </div>

            {busy && (
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}

            <button
              onClick={mode === "full" ? downloadFull : downloadClip}
              disabled={busy}
              className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {progress}%
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />{" "}
                  {mode === "full" ? "Télécharger la vidéo" : `Télécharger l'extrait (${fmt(end - start)})`}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
