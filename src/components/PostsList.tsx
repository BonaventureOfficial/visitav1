import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { FileText, Loader2, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchPosts, type Publication, type PostCursor } from "@/lib/posts";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { timeAgo } from "@/lib/format";
import { toast } from "sonner";
import { GazetteCard } from "@/components/GazetteCard";
import { gazettePaths } from "@/lib/gazette";

export function PostsList({ ownerId, canManage = false }: { ownerId?: string; canManage?: boolean }) {
  const { lang } = useI18n();
  const fr = lang === "fr";
  const [rows, setRows] = useState<Publication[]>([]);
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  const [error, setError] = useState(false);
  const cursor = useRef<PostCursor | null>(null);
  const [selected, setSelected] = useState<Publication | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const load = async () => {
    if (busy) return;
    setBusy(true); setError(false);
    try {
      const page = await fetchPosts(ownerId, cursor.current);
      setRows((old) => [...old, ...page.filter((p) => !old.some((r) => r.id === p.id))]);
      const last = page.at(-1);
      if (last) cursor.current = { id: last.id, created_at: last.created_at };
      setMore(page.length === 12);
    } catch { setError(true); }
    finally { setBusy(false); }
  };
  useEffect(() => {
    let alive = true;
    cursor.current = null; setRows([]); setBusy(true); setError(false);
    fetchPosts(ownerId).then((page) => {
      if (!alive) return;
      setRows(page); setMore(page.length === 12);
      const last = page.at(-1);
      cursor.current = last ? { id: last.id, created_at: last.created_at } : null;
    }).catch(() => { if (alive) setError(true); }).finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [ownerId]);
  return <section className="mt-8" aria-label={fr ? "Publications" : "Posts"}>
    <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-bold"><FileText className="h-4 w-4 text-primary" />{fr ? "Publications" : "Posts"}</h2>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {rows.map((p) => <GazetteCard key={p.id} post={p} action={canManage && ownerId && <Button variant="ghost" size="icon" aria-label={fr ? "Supprimer la publication" : "Delete post"} onClick={() => { setSelected(p); setConfirmation(""); }}><Trash2 className="text-destructive" /></Button>} />)}
    </div>
    {!busy && !error && !rows.length && <p className="text-sm text-muted-foreground">{fr ? "Aucune publication pour l’instant." : "No posts yet."}</p>}
    {busy && <Loader2 className="mx-auto my-4 h-5 w-5 animate-spin text-primary" />}
    {(more || error) && <Button variant="secondary" className="mt-4" disabled={busy} onClick={load}>{error ? (fr ? "Réessayer" : "Retry") : (fr ? "Voir plus" : "Load more")}</Button>}
    {selected && <div className="fixed inset-0 z-[100] bg-background/95 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="delete-post-title">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between"><h3 id="delete-post-title" className="font-semibold">{fr ? "Supprimer la publication ?" : "Delete post?"}</h3><Button variant="ghost" size="icon" disabled={deleting} aria-label={fr ? "Fermer" : "Close"} onClick={() => setSelected(null)}><X /></Button></div>
        <label htmlFor="post-confirm" className="block text-sm">{fr ? "Saisissez CONFIRMER" : "Type CONFIRMER"}</label>
        <input id="post-confirm" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className="w-full rounded-md border border-border bg-input p-3" />
        <Button variant="destructive" className="w-full" disabled={confirmation !== "CONFIRMER" || deleting} onClick={async () => {
          if (confirmation !== "CONFIRMER" || !ownerId || !canManage) return;
          setDeleting(true);
          try {
            const { error: err } = await supabase.from("posts").delete().eq("id", selected.id).eq("user_id", ownerId);
            if (err) throw err;
            const paths = [...(selected.photo_path ? [selected.photo_path] : []), ...gazettePaths(selected.rich_content ?? null)];
            if (paths.length) await supabase.storage.from("post-photos").remove(paths);
            setRows((old) => old.filter((p) => p.id !== selected.id)); setSelected(null);
          } catch { toast.error(fr ? "Suppression impossible" : "Could not delete"); }
          finally { setDeleting(false); }
        }}>{fr ? "Confirmer" : "Confirm"}</Button>
      </div>
    </div>}
  </section>;
}