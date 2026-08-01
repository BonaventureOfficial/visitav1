import { useEffect, useState } from "react";
import { Heart, Send, CornerDownRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatCount } from "@/lib/format";
import { toast } from "sonner";

export interface ThreadComment {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  parent_id: string | null;
  likes_count: number;
  author?: string;
}

export function CommentsThread({
  videoId,
  limit = 50,
  compact = false,
  onAdded,
}: {
  videoId: string;
  limit?: number;
  compact?: boolean;
  onAdded?: () => void;
}) {
  const { user } = useAuth();
  const [comments, setComments] = useState<ThreadComment[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [replyTo, setReplyTo] = useState<ThreadComment | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await (supabase as any)
        .from("video_comments")
        .select("id,user_id,body,created_at,parent_id,likes_count")
        .eq("video_id", videoId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (!active) return;
      const rows = (data ?? []) as ThreadComment[];
      const ids = Array.from(new Set(rows.map((c) => c.user_id)));
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id,channel_name").in("id", ids);
        const names = new Map((profs ?? []).map((p) => [p.id, p.channel_name]));
        if (active) setComments(rows.map((c) => ({ ...c, author: names.get(c.user_id) ?? "Visita" })));
      } else if (active) setComments(rows);

      if (active && user && rows.length) {
        const { data: likes } = await (supabase as any)
          .from("comment_likes")
          .select("comment_id")
          .eq("user_id", user.id)
          .in("comment_id", rows.map((c) => c.id));
        if (active) setLikedIds(new Set((likes ?? []).map((l: any) => l.comment_id)));
      }
    })();
    return () => {
      active = false;
    };
  }, [videoId, user?.id, limit]);

  const toggleLike = async (c: ThreadComment) => {
    if (!user) {
      toast.error("Sign in to like");
      return;
    }
    const liked = likedIds.has(c.id);
    const delta = liked ? -1 : 1;
    setLikedIds((prev) => {
      const next = new Set(prev);
      liked ? next.delete(c.id) : next.add(c.id);
      return next;
    });
    setComments((rows) =>
      rows.map((r) => (r.id === c.id ? { ...r, likes_count: Math.max(0, r.likes_count + delta) } : r)),
    );
    const q = liked
      ? (supabase as any).from("comment_likes").delete().eq("user_id", user.id).eq("comment_id", c.id)
      : (supabase as any).from("comment_likes").insert({ user_id: user.id, comment_id: c.id });
    const { error } = await q;
    if (error && (error as any).code !== "23505") {
      setLikedIds((prev) => {
        const next = new Set(prev);
        liked ? next.add(c.id) : next.delete(c.id);
        return next;
      });
      setComments((rows) =>
        rows.map((r) => (r.id === c.id ? { ...r, likes_count: Math.max(0, r.likes_count - delta) } : r)),
      );
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const clean = body.trim();
    if (!user) {
      toast.error("Sign in to comment");
      return;
    }
    if (!clean) return;
    setBusy(true);
    const parentId = replyTo ? replyTo.parent_id ?? replyTo.id : null;
    const optimistic: ThreadComment = {
      id: crypto.randomUUID(),
      user_id: user.id,
      body: clean,
      created_at: new Date().toISOString(),
      parent_id: parentId,
      likes_count: 0,
      author: "You",
    };
    setComments((rows) => [optimistic, ...rows]);
    setBody("");
    setReplyTo(null);
    onAdded?.();
    const { error } = await (supabase as any)
      .from("video_comments")
      .insert({ user_id: user.id, video_id: videoId, body: clean, parent_id: parentId });
    if (error) {
      toast.error(error.message);
      setComments((rows) => rows.filter((c) => c.id !== optimistic.id));
    }
    setBusy(false);
  };

  const roots = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) =>
    comments.filter((c) => c.parent_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at));

  const Row = ({ c, isReply }: { c: ThreadComment; isReply?: boolean }) => (
    <div className={isReply ? "pl-5 border-l border-border/50" : ""}>
      <p className={`${compact ? "text-xs" : "text-sm"} leading-snug`}>
        <span className="font-semibold text-foreground">{c.author ?? "Visita"}</span>{" "}
        <span className="text-muted-foreground">{c.body}</span>
      </p>
      <div className="mt-1 flex items-center gap-4 text-[11px] text-muted-foreground">
        <button
          type="button"
          onClick={() => toggleLike(c)}
          className={`flex items-center gap-1 transition ${likedIds.has(c.id) ? "text-primary" : "hover:text-primary"}`}
          aria-label="Like comment"
        >
          <Heart className={`h-3.5 w-3.5 ${likedIds.has(c.id) ? "fill-current" : ""}`} />
          {formatCount(c.likes_count ?? 0)}
        </button>
        <button
          type="button"
          onClick={() => setReplyTo(c)}
          className="flex items-center gap-1 hover:text-primary transition"
          aria-label="Reply"
        >
          <CornerDownRight className="h-3.5 w-3.5" /> Reply
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-0" onClick={(e) => e.stopPropagation()}>
      <div className={`space-y-3 overflow-y-auto pr-1 ${compact ? "max-h-48" : "flex-1"}`}>
        {roots.length === 0 && (
          <p className="text-xs text-muted-foreground text-center">Be the first to comment.</p>
        )}
        {roots.map((c) => (
          <div key={c.id} className="space-y-2">
            <Row c={c} />
            {repliesOf(c.id).map((r) => (
              <Row key={r.id} c={r} isReply />
            ))}
          </div>
        ))}
      </div>

      {replyTo && (
        <div className="mt-2 flex items-center justify-between rounded-lg bg-secondary px-3 py-1.5 text-[11px]">
          <span className="truncate text-muted-foreground">
            Replying to <span className="text-foreground font-semibold">{replyTo.author ?? "Visita"}</span>
          </span>
          <button type="button" onClick={() => setReplyTo(null)} className="text-primary font-semibold">
            Cancel
          </button>
        </div>
      )}

      <form onSubmit={submit} className="mt-3 flex items-center gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={500}
          placeholder={replyTo ? "Write a reply" : "Add a comment"}
          className={`min-w-0 flex-1 rounded-full bg-secondary border border-border px-3 py-2 outline-none focus:border-primary ${compact ? "text-xs" : "text-sm"}`}
        />
        <button
          disabled={busy || !body.trim()}
          className="h-9 w-9 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50"
          aria-label="Send comment"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
