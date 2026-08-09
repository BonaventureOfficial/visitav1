import { useRef, useState } from "react";
import { Download, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Part = "full" | "start" | "middle" | "end" | "custom";

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

function safeName(title: string) {
  return (title || "visita").replace(/[^\w\-]+/g, "_").slice(0, 60);
}

/**
 * Bouton "Télécharger" : la vidéo entière (fichier d'origine) ou une partie
 * (début / corps / fin / personnalisée) extraite côté client.
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
  const [part, setPart] = useState<Part>("full");
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const cancelRef = useRef(false);

  if (!videoUrl) return null;

  const openModal = () => {
    setOpen(true);
    setProgress(0);
    setPart("full");
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.src = videoUrl;
    probe.onloadedmetadata = () => {
      const d = Number.isFinite(probe.duration) ? probe.duration : 0;
      setDuration(d);
      setRange([0, Math.min(d, 30)]);
    };
  };

  const pickPart = (p: Part) => {
    setPart(p);
    if (!duration) return;
    const third = duration / 3;
    if (p === "start") setRange([0, third]);
    else if (p === "middle") setRange([third, third * 2]);
    else if (p === "end") setRange([third * 2, duration]);
  };

  const downloadBlob = (blob: Blob, ext: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName(title)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const downloadFull = async () => {
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
    const [from, to] = range;
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

    const el = document.createElement("video");
    el.src = videoUrl;
    el.crossOrigin = "anonymous";
    el.muted = false;
    el.playsInline = true;
    el.style.position = "fixed";
    el.style.opacity = "0";
    el.style.pointerEvents = "none";
    document.body.appendChild(el);

    const cleanup = () => {
      el.pause();
      el.remove();
      setBusy(false);
    };

    try {
      await new Promise<void>((resolve, reject) => {
        el.onloadedmetadata = () => resolve();
        el.onerror = () => reject(new Error("Lecture impossible"));
      });
      el.currentTime = from;
      await new Promise<void>((resolve) => {
        el.onseeked = () => resolve();
      });

      const stream = (el as HTMLVideoElement & { captureStream?: () => MediaStream; mozCaptureStream?: () => MediaStream })
        .captureStream?.() ??
        (el as HTMLVideoElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream?.();
      if (!stream) throw new Error("Découpage non supporté sur ce navigateur");

      const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find((m) =>
        MediaRecorder.isTypeSupported(m),
      );
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      const done = new Promise<Blob>((resolve) => {
        rec.onstop = () => resolve(new Blob(chunks, { type: mime?.startsWith("video/mp4") ? "video/mp4" : "video/webm" }));
      });

      rec.start(500);
      await el.play();

      const span = to - from;
      const tick = () => {
        setProgress(Math.min(100, Math.round(((el.currentTime - from) / span) * 100)));
        if (cancelRef.current || el.currentTime >= to || el.ended) {
          if (rec.state !== "inactive") rec.stop();
          el.pause();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);

      const blob = await done;
      downloadBlob(blob, mime?.startsWith("video/mp4") ? "mp4" : "webm");
      toast.success("Extrait téléchargé");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur de découpage");
    } finally {
      cleanup();
    }
  };

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
          className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3"
          onClick={(e) => {
            e.stopPropagation();
            if (!busy) setOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card border border-border p-4 space-y-3"
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

            <p className="text-[11px] text-muted-foreground">
              Choisissez la vidéo entière ou la partie à garder dans votre stockage.
            </p>

            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["full", "Vidéo entière"],
                  ["start", "Le début"],
                  ["middle", "Le corps"],
                  ["end", "La fin"],
                ] as Array<[Part, string]>
              ).map(([p, label]) => (
                <button
                  key={p}
                  onClick={() => pickPart(p)}
                  className={`h-10 rounded-xl text-sm font-medium border transition ${
                    part === p
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-secondary text-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {part !== "full" && duration > 0 && (
              <div className="space-y-2 rounded-xl bg-secondary/60 border border-border p-3">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Début : {fmt(range[0])}</span>
                  <span>Fin : {fmt(range[1])}</span>
                </div>
                <label className="block text-[10px] text-muted-foreground">Ajuster le début</label>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, duration - 1)}
                  step={1}
                  value={range[0]}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setPart("custom");
                    setRange(([, b]) => [v, Math.max(v + 1, b)]);
                  }}
                  className="w-full accent-[hsl(var(--primary))]"
                />
                <label className="block text-[10px] text-muted-foreground">Ajuster la fin</label>
                <input
                  type="range"
                  min={1}
                  max={Math.ceil(duration)}
                  step={1}
                  value={range[1]}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setPart("custom");
                    setRange(([a]) => [Math.min(a, v - 1), v]);
                  }}
                  className="w-full accent-[hsl(var(--primary))]"
                />
                <p className="text-[10px] text-muted-foreground">
                  Durée de l'extrait : {fmt(Math.max(0, range[1] - range[0]))} — l'extraction se fait en temps réel,
                  gardez cette fenêtre ouverte.
                </p>
              </div>
            )}

            {busy && (
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            )}

            <button
              onClick={part === "full" ? downloadFull : downloadClip}
              disabled={busy}
              className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {progress}%
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" /> {part === "full" ? "Télécharger la vidéo" : "Télécharger l'extrait"}
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
