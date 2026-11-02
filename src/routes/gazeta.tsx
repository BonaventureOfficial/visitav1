import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Clock, Loader2, Newspaper, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GazetteContent } from "@/components/GazetteContent";
import { usePublications } from "@/hooks/use-publications";
import { gazetteTitle, type GazetteNode } from "@/lib/gazette";
import type { Publication } from "@/lib/posts";
import { PostInteractions } from "@/components/PostInteractions";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/gazeta")({
  head: () => ({
    meta: [
      { title: "Gazeta — le kiosque Visita" },
      { name: "description", content: "Le quotidien Visita : la Une, les articles et reportages photo des journalistes de la communauté." },
      { property: "og:title", content: "Gazeta — le kiosque Visita" },
      { property: "og:description", content: "La Une et les gazettes de la communauté Visita, en lecture immersive." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GazetaPage,
});

function plain(n: GazetteNode | null | undefined): string {
  if (!n) return "";
  return (n.text ?? "") + " " + (n.content ?? []).map(plain).join(" ");
}
function textOf(p: Publication) { return (plain(p.rich_content) || p.body || "").replace(/\s+/g, " ").trim(); }
function minutes(p: Publication) { return Math.max(1, Math.round(textOf(p).split(" ").filter(Boolean).length / 200)); }

type Filter = "all" | "text" | "photo" | "paper" | "night" | "mint" | "rose";

function GazetaPage() {
  const { lang } = useI18n();
  const fr = lang === "fr";
  const { rows, busy, more, error, load } = usePublications();
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Publication | null>(null);
  const title = (p: Publication) => gazetteTitle(p.rich_content) || (p.kind === "photo" ? (fr ? "En images" : "In pictures") : (fr ? "Sans titre" : "Untitled"));
  const date = (s: string) => new Date(s).toLocaleDateString(fr ? "fr-FR" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
  const list = useMemo(() => rows.filter((p) => filter === "all" || (filter === "text" || filter === "photo" ? p.kind === filter : (p.paper_theme ?? "paper") === filter)), [rows, filter]);
  const [lead, ...rest] = list;

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", esc); };
  }, [open]);

  const filters: [Filter, string][] = [["all", fr ? "À la une" : "Front page"], ["text", fr ? "Articles" : "Articles"], ["photo", fr ? "En images" : "In pictures"], ["paper", fr ? "Classique" : "Classic"], ["night", fr ? "Nocturne" : "Night"], ["mint", fr ? "Menthe" : "Mint"], ["rose", fr ? "Rose" : "Rose"]];
  const meta = (p: Publication) => <p className="font-sans text-[11px] uppercase tracking-widest text-muted-foreground">{p.channel_name} · {date(p.created_at)} · <Clock className="inline h-3 w-3" /> {minutes(p)} min</p>;

  return <main className="mx-auto max-w-6xl px-4 pb-28 pt-4">
    <header className="border-b-4 border-double border-foreground pb-3 text-center">
      <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-muted-foreground">{date(new Date().toISOString())}</p>
      <h1 className="font-serif text-5xl font-black tracking-tight sm:text-7xl" style={{ fontFamily: "Georgia, serif" }}>Gazeta</h1>
      <p className="font-sans text-[10px] uppercase tracking-[0.3em] text-primary">{fr ? "Le quotidien des journalistes Visita" : "The daily of Visita reporters"}</p>
    </header>
    <nav className="flex gap-2 overflow-x-auto border-b border-border py-3" aria-label={fr ? "Thématiques" : "Topics"}>
      {filters.map(([k, l]) => <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} className="shrink-0 rounded-full font-sans" onClick={() => setFilter(k)}>{l}</Button>)}
    </nav>

    {lead && <button onClick={() => setOpen(lead)} className="grid w-full gap-6 border-b border-border py-6 text-left md:grid-cols-[3fr_2fr]" style={{ fontFamily: "Georgia, serif" }}>
      <div>
        <p className="mb-2 font-sans text-xs font-bold uppercase tracking-widest text-primary">{fr ? "La Une" : "Lead story"}</p>
        <h2 className="text-3xl font-black leading-tight sm:text-5xl">{title(lead)}</h2>
        <div className="mt-3">{meta(lead)}</div>
        <p className="mt-4 line-clamp-6 text-lg leading-relaxed first-letter:float-left first-letter:mr-2 first-letter:text-6xl first-letter:font-black first-letter:leading-none first-letter:text-primary md:columns-2 md:gap-6">{textOf(lead) || "…"}</p>
      </div>
      {(lead.photo_url || Object.values(lead.inline_images ?? {})[0]) && <img src={lead.photo_url ?? Object.values(lead.inline_images ?? {})[0]} alt="" className="max-h-96 w-full object-cover" />}
    </button>}

    <section className="grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3" style={{ fontFamily: "Georgia, serif" }}>
      {rest.map((p) => { const img = p.photo_url ?? Object.values(p.inline_images ?? {})[0]; return <button key={p.id} onClick={() => setOpen(p)} className="border-b border-border py-5 text-left sm:[&:not(:nth-child(2n))]:border-r sm:pr-6 lg:[&]:border-r-0">
        {img && <img src={img} alt="" loading="lazy" className="mb-3 aspect-[4/3] w-full object-cover" />}
        <h3 className="text-xl font-bold leading-snug">{title(p)}</h3>
        <div className="my-2">{meta(p)}</div>
        <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground first-letter:text-2xl first-letter:font-bold first-letter:text-foreground">{textOf(p)}</p>
      </button>; })}
    </section>

    {busy && <Loader2 className="mx-auto my-6 h-6 w-6 animate-spin text-primary" />}
    {!busy && !error && !list.length && <p className="py-12 text-center text-muted-foreground"><Newspaper className="mx-auto mb-2 h-8 w-8" />{fr ? "Aucune gazette dans cette rubrique." : "No gazette in this section."}</p>}
    {(more || error) && <div className="mt-6 text-center"><Button variant="secondary" disabled={busy} onClick={load}>{error ? (fr ? "Réessayer" : "Retry") : (fr ? "Éditions précédentes" : "Earlier editions")}</Button></div>}

    {open && <div role="dialog" aria-modal="true" aria-label={title(open)} className="fixed inset-0 z-[100] overflow-y-auto bg-background">
      <div className="sticky top-0 flex items-center justify-between border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
        <span className="font-sans text-xs uppercase tracking-widest text-muted-foreground">Gazeta · {minutes(open)} min</span>
        <Button variant="ghost" size="icon" aria-label={fr ? "Fermer" : "Close"} onClick={() => setOpen(null)}><X /></Button>
      </div>
      <article className="gazette-panel mx-auto my-6 max-w-2xl" data-paper={open.paper_theme ?? "paper"}>
        <h1 className="text-3xl font-black leading-tight sm:text-4xl" style={{ fontFamily: "Georgia, serif" }}>{title(open)}</h1>
        <p className="mb-4 mt-2 border-b border-current/20 pb-3 font-sans text-xs uppercase tracking-widest">{open.channel_name} · {date(open.created_at)}</p>
        {open.photo_url && <img src={open.photo_url} alt={open.body || ""} className="mb-4 w-full object-contain" />}
        {open.rich_content ? <GazetteContent document={open.rich_content} images={open.inline_images} /> : <p className="gazette-plain whitespace-pre-wrap break-words">{open.body}</p>}
        <PostInteractions key={open.id} post={open} trackView />
      </article>
    </div>}
  </main>;
}
