import { useEffect, useState } from "react";
import { ImagePlus, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { publishPost, PHOTO_TYPES, type PostKind } from "@/lib/posts";
import { toast } from "sonner";
import { GazetteEditor } from "@/components/GazetteEditor";
import { PAPER_THEMES, type GazetteNode, type PaperTheme } from "@/lib/gazette";

export function PostComposer({ kind, userId, onPublished }: { kind: PostKind; userId: string; onPublished: () => void }) {
  const { lang } = useI18n();
  const fr = lang === "fr";
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [document, setDocument] = useState<GazetteNode | null>(null);
  const [theme, setTheme] = useState<PaperTheme>("paper");
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <form className="mt-6 space-y-5" onSubmit={async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await publishPost(userId, kind, body, file, document, theme);
      toast.success(fr ? "Publication réussie" : "Published");
      onPublished();
    } catch (error) { toast.error(error instanceof Error ? error.message : fr ? "Publication impossible" : "Could not publish"); }
    finally { setBusy(false); }
  }}>
    {kind === "photo" && <div>
      <label className="block text-sm font-medium mb-2">Photo <span className="text-primary">*</span></label>
      <label className="relative flex min-h-52 w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-primary/70 bg-primary/5 cursor-pointer">
        <input aria-label={fr ? "Sélectionner une photo" : "Select a photo"} type="file" accept={PHOTO_TYPES.join(",")} className="sr-only" disabled={busy} onChange={(e) => {
          const next = e.target.files?.[0];
          if (!next) return;
          if (!PHOTO_TYPES.includes(next.type) || next.size > 20 * 1024 * 1024) { toast.error(fr ? "JPG, PNG, WEBP ou GIF · 20 Mo maximum" : "JPG, PNG, WEBP or GIF · 20 MB maximum"); e.target.value = ""; return; }
          setFile(next);
        }} />
        {preview ? <img src={preview} alt={fr ? "Photo à publier" : "Photo to publish"} className="max-h-96 w-full object-contain" /> : <span className="flex flex-col items-center gap-3 text-primary"><ImagePlus className="h-10 w-10" /><span>{fr ? "Sélectionner une photo" : "Select a photo"}</span></span>}
      </label>
      {file && <p className="mt-2 truncate text-xs text-muted-foreground">{file.name}</p>}
    </div>}
    {kind === "text" ? <GazetteEditor userId={userId} disabled={busy} theme={theme} onTheme={setTheme} onChange={(text, doc) => { setBody(text); setDocument(doc); }} /> : <div>
      <label htmlFor="post-body" className="block text-sm font-medium mb-2">{fr ? "Légende" : "Caption"}</label>
      <textarea id="post-body" value={body} onChange={(e) => setBody(e.target.value)} disabled={busy} maxLength={5000} rows={3} className="w-full rounded-lg bg-input border border-border p-4 text-sm outline-none focus:border-primary" />
    </div>}
    {kind === "photo" && <div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{fr ? "Fond" : "Paper"}</span>{PAPER_THEMES.map(paper => <Button type="button" key={paper} aria-label={`Fond ${paper}`} aria-pressed={theme === paper} variant="ghost" size="icon" disabled={busy} onClick={() => setTheme(paper)}><span data-paper={paper} className={`gazette-swatch h-6 w-6 rounded-full border-2 ${theme === paper ? "ring-2 ring-primary" : ""}`} /></Button>)}</div>}
    <Button type="submit" className="w-full h-11" disabled={busy || body.length > 5000 || (kind === "text" ? !body.trim() : !file)}>{busy ? <Loader2 className="animate-spin" /> : <Send />}{fr ? (kind === "text" ? "Publier la gazette" : "Publier une photo") : (kind === "text" ? "Publish gazette" : "Publish photo")}</Button>
  </form>;
}