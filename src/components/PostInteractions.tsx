import { useEffect, useState } from "react";
import { Heart, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatCount } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { Publication } from "@/lib/posts";

/** Vues : 5 petits bâtonnets vert foncé. */
export function ViewBarsIcon({ className = "h-4 w-4" }: { className?: string }) {
  return <svg viewBox="0 0 20 16" className={className} aria-hidden="true">
    {[6, 10, 4, 13, 8].map((h, i) => <rect key={i} x={1 + i * 4} y={16 - h} width="2.4" height={h} rx="1.2" fill="var(--gazette-green)" />)}
  </svg>;
}

/** Commentaire : bulle arrondie avec trois points. */
export function CommentBubbleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5Z" />
    <circle cx="8.5" cy="9.5" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="9.5" r="1" fill="currentColor" stroke="none" /><circle cx="15.5" cy="9.5" r="1" fill="currentColor" stroke="none" />
  </svg>;
}

/** Repost : deux flèches en boucle. */
export function RepostLoopIcon({ className = "h-4 w-4" }: { className?: string }) {
  return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 2.5 20.5 6 17 9.5" /><path d="M3.5 11V9a3 3 0 0 1 3-3h14" />
    <path d="M7 21.5 3.5 18 7 14.5" /><path d="M20.5 13v2a3 3 0 0 1-3 3h-14" />
  </svg>;
}

type C = { id: string; user_id: string; body: string; created_at: string; parent_id: string | null; author?: string };

export function PostInteractions({ post, trackView = false }: { post: Publication; trackView?: boolean }) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const fr = lang === "fr";
  const [likes, setLikes] = useState(post.likes_count ?? 0);
  const [views, setViews] = useState(post.views_count ?? 0);
  const [reposts, setReposts] = useState(post.reposts_count ?? 0);
  const [commentsCount, setCommentsCount] = useState(post.comments_count ?? 0);
  const [liked, setLiked] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [showComments, setShowComments] = useState(false);

  useEffect(() => {
    if (!user) return;
    let on = true;
    Promise.all([
      supabase.from("post_likes").select("id").eq("post_id", post.id).eq("user_id", user.id).maybeSingle(),
      supabase.from("post_reposts").select("id").eq("post_id", post.id).eq("user_id", user.id).maybeSingle(),
    ]).then(([l, r]) => { if (on) { setLiked(!!l.data); setReposted(!!r.data); } });
    return () => { on = false; };
  }, [post.id, user?.id]);

  // Vue valide après 3 s de lecture ; 1 par compte et par 24 h (contrôlé en base).
  useEffect(() => {
    if (!trackView || !user) return;
    const t = window.setTimeout(async () => {
      const { data } = await supabase.rpc("record_post_view", { _post_id: post.id, _seconds: 3 });
      if (data === true) setViews((v) => v + 1);
    }, 3000);
    return () => window.clearTimeout(t);
  }, [trackView, post.id, user?.id]);

  const need = () => { if (!user) toast.error(fr ? "Connectez-vous pour interagir" : "Sign in to interact"); return !!user; };

  const like = async () => {
    if (!need() || liked) return;
    setLiked(true); setLikes((n) => n + 1);
    const { error } = await supabase.from("post_likes").insert({ post_id: post.id, user_id: user!.id });
    if (error && error.code !== "23505") { setLiked(false); setLikes((n) => n - 1); toast.error(error.message); }
  };

  const repost = async () => {
    if (!need()) return;
    const was = reposted;
    setReposted(!was); setReposts((n) => Math.max(0, n + (was ? -1 : 1)));
    const { error } = was
      ? await supabase.from("post_reposts").delete().eq("post_id", post.id).eq("user_id", user!.id)
      : await supabase.from("post_reposts").insert({ post_id: post.id, user_id: user!.id });
    if (error && error.code !== "23505") { setReposted(was); setReposts((n) => Math.max(0, n + (was ? 1 : -1))); toast.error(error.message); }
    else if (!was) toast.success(fr ? "Reposté" : "Reposted");
  };

  const btn = "flex items-center gap-1.5 rounded-full px-2 py-1 font-sans text-xs transition hover:bg-current/10";
  return <div onClick={(e) => e.stopPropagation()} className="mt-3 border-t border-current/20 pt-2">
    <div className="flex items-center justify-between gap-1">
      <button type="button" onClick={like} aria-pressed={liked} aria-label={fr ? "J'aime" : "Like"} className={`${btn} ${liked ? "text-primary" : ""}`}>
        <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />{formatCount(likes)}
      </button>
      <span className={btn} aria-label={fr ? "Vues" : "Views"}><ViewBarsIcon />{formatCount(views)}</span>
      <button type="button" onClick={() => setShowComments((s) => !s)} aria-expanded={showComments} aria-label={fr ? "Commentaires" : "Comments"} className={btn}>
        <CommentBubbleIcon />{formatCount(commentsCount)}
      </button>
      <button type="button" onClick={repost} aria-pressed={reposted} aria-label="Repost" className={`${btn} ${reposted ? "text-primary" : ""}`}>
        <RepostLoopIcon />{formatCount(reposts)}
      </button>
    </div>
    {showComments && <PostComments postId={post.id} onAdded={() => setCommentsCount((n) => n + 1)} />}
  </div>;
}

function PostComments({ postId, onAdded }: { postId: string; onAdded: () => void }) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const fr = lang === "fr";
  const [rows, setRows] = useState<C[]>([]);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<C | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let on = true;
    (async () => {
      const { data } = await supabase.from("post_comments").select("id,user_id,body,created_at,parent_id").eq("post_id", postId).order("created_at", { ascending: false }).limit(100);
      const list = (data ?? []) as C[];
      const ids = [...new Set(list.map((c) => c.user_id))];
      const { data: profs } = ids.length ? await supabase.from("profiles").select("id,channel_name").in("id", ids) : { data: [] };
      const names = new Map((profs ?? []).map((p) => [p.id, p.channel_name]));
      if (on) setRows(list.map((c) => ({ ...c, author: names.get(c.user_id) ?? "Visita" })));
    })();
    return () => { on = false; };
  }, [postId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = body.trim();
    if (!user) { toast.error(fr ? "Connectez-vous pour commenter" : "Sign in to comment"); return; }
    if (!clean) return;
    setBusy(true);
    const parent_id = replyTo ? replyTo.parent_id ?? replyTo.id : null;
    const { data, error } = await supabase.from("post_comments").insert({ post_id: postId, user_id: user.id, body: clean, parent_id }).select("id,user_id,body,created_at,parent_id").single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setRows((r) => [{ ...(data as C), author: fr ? "Vous" : "You" }, ...r]);
    setBody(""); setReplyTo(null); onAdded();
  };

  const roots = rows.filter((c) => !c.parent_id);
  const replies = (id: string) => rows.filter((c) => c.parent_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const Row = ({ c, reply }: { c: C; reply?: boolean }) => <div className={reply ? "ml-4 border-l border-current/30 pl-3" : ""}>
    <p className="font-sans text-sm leading-snug"><span className="font-semibold">{c.author}</span> <span className="opacity-80">{c.body}</span></p>
    <button type="button" onClick={() => setReplyTo(c)} className="mt-0.5 font-sans text-[11px] font-semibold opacity-70 hover:opacity-100">{fr ? "Répondre" : "Reply"}</button>
  </div>;

  return <div className="mt-3 space-y-3">
    <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
      {!roots.length && <p className="text-center font-sans text-xs opacity-70">{fr ? "Soyez le premier à commenter." : "Be the first to comment."}</p>}
      {roots.map((c) => <div key={c.id} className="space-y-2"><Row c={c} />{replies(c.id).map((r) => <Row key={r.id} c={r} reply />)}</div>)}
    </div>
    {replyTo && <div className="flex items-center justify-between rounded-md bg-current/10 px-3 py-1 font-sans text-[11px]">
      <span className="truncate">{fr ? "Réponse à" : "Replying to"} <b>{replyTo.author}</b></span>
      <button type="button" onClick={() => setReplyTo(null)} className="font-semibold">{fr ? "Annuler" : "Cancel"}</button>
    </div>}
    <form onSubmit={submit} className="flex items-center gap-2">
      <input value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} placeholder={replyTo ? (fr ? "Écrire une réponse" : "Write a reply") : (fr ? "Ajouter un commentaire" : "Add a comment")} className="min-w-0 flex-1 rounded-full border border-current/30 bg-transparent px-3 py-2 font-sans text-sm outline-none focus:border-primary" />
      <button disabled={busy || !body.trim()} aria-label={fr ? "Envoyer" : "Send"} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"><Send className="h-4 w-4" /></button>
    </form>
  </div>;
}
