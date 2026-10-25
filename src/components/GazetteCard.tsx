import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Newspaper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GazetteContent } from "@/components/GazetteContent";
import { gazetteTitle } from "@/lib/gazette";
import type { Publication } from "@/lib/posts";
import { useI18n } from "@/lib/i18n";

export function GazetteCard({ post, action }: { post: Publication; action?: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const { lang } = useI18n();
  const fr = lang === "fr";
  return <article className="gazette-panel" data-paper={post.paper_theme ?? "paper"}>
    <header className="gazette-masthead flex items-center justify-between gap-3">
      <span className="flex items-center gap-2"><Newspaper className="h-4 w-4" /><span className="min-w-0 break-words">{gazetteTitle(post.rich_content) || (post.kind === "photo" ? (fr ? "En images" : "In pictures") : (fr ? "Sans titre" : "Untitled"))}</span></span>
      <span className="text-[10px] font-sans uppercase">{post.kind === "photo" ? (fr ? "En images" : "In pictures") : (fr ? "Journal" : "Journal")}</span>
    </header>
    <div className="flex items-center justify-between gap-3 border-b border-current/20 py-2 text-xs">
      <Link to="/" search={{ channel: post.user_id }} className="flex min-w-0 items-center gap-2 font-sans font-semibold">
        {post.avatar_url && <img src={post.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />}<span className="truncate">{post.channel_name}</span>
      </Link>
      <time className="shrink-0 font-sans text-[10px]" dateTime={post.created_at}>{new Date(post.created_at).toLocaleDateString(fr ? "fr-FR" : "en-GB", { day: "numeric", month: "short", year: "numeric" })}</time>
    </div>
    <div className={`relative overflow-hidden pt-4 ${expanded ? "" : "max-h-80"}`}>
      {post.photo_url && <img src={post.photo_url} alt={post.body || "Gazette"} loading="lazy" className="mb-4 max-h-96 w-full object-contain" />}
      {post.rich_content ? <GazetteContent document={post.rich_content} images={post.inline_images} /> : post.body && <p className="gazette-plain whitespace-pre-wrap break-words">{post.body}</p>}
    </div>
    <footer className="mt-4 flex items-center justify-between border-t-2 border-current pt-2">
      <Button variant="ghost" size="sm" className="text-inherit hover:bg-current/10" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? <ArrowUpRight /> : <ArrowDownRight />}{expanded ? (fr ? "Refermer" : "Close") : (fr ? "Lire la gazette" : "Read the gazette")}</Button>{action}
    </footer>
  </article>;
}