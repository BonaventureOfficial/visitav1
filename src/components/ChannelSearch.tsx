import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, X, Users, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCount } from "@/lib/format";
import { usePlayer } from "@/lib/player";

interface ChannelHit {
  id: string;
  channel_name: string;
  avatar_url: string | null;
  followers: number;
}

interface VideoHit {
  id: string;
  title: string;
  thumbnail_url: string | null;
  video_url: string | null;
  channel_name: string | null;
  user_id: string | null;
  views: number;
  is_reel: boolean;
}

const VIDEO_COLS = "id,title,thumbnail_url,video_url,channel_name,user_id,views,is_reel";
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Échappe les jokers LIKE et les caractères spéciaux du filtre PostgREST. */
const clean = (s: string) => s.replace(/[%_\\,()*]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);

export function ChannelSearch() {
  const navigate = useNavigate();
  const { play } = usePlayer();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<ChannelHit[]>([]);
  const [videos, setVideos] = useState<VideoHit[]>([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useEffect(() => {
    const raw = q.trim();
    if (raw.length < 1) {
      setHits([]); setVideos([]); setLoading(false);
      return;
    }
    setLoading(true);
    let active = true;
    const timer = setTimeout(async () => {
      // Lien collé (ou identifiant) : recherche directe par clé primaire.
      const idMatch = raw.match(UUID_RE);
      if (idMatch) {
        const { data } = await supabase.from("videos").select(VIDEO_COLS).eq("id", idMatch[0]).limit(1);
        if (!active) return;
        setVideos((data ?? []) as VideoHit[]);
        setHits([]);
        setLoading(false);
        return;
      }

      const term = clean(raw);
      if (!term) { setHits([]); setVideos([]); setLoading(false); return; }
      const words = term.split(" ").filter((w) => w.length > 0).slice(0, 5);

      // Titres : chaque mot doit apparaître (index trigramme GIN), résultats bornés.
      let vq = supabase.from("videos").select(VIDEO_COLS);
      words.forEach((w) => { vq = vq.ilike("title", `%${w}%`); });
      const [chRes, vRes] = await Promise.all([
        supabase.from("profiles").select("id,channel_name,avatar_url").ilike("channel_name", `%${term}%`).limit(20),
        vq.order("views", { ascending: false }).limit(8),
      ]);
      if (!active) return;

      const rows = (chRes.data ?? []) as Array<{ id: string; channel_name: string; avatar_url: string | null }>;
      const counts = new Map<string, number>();
      if (rows.length > 0) {
        const { data: follows } = await (supabase as any)
          .from("creator_stats").select("user_id,followers").in("user_id", rows.map((r) => r.id));
        ((follows ?? []) as Array<{ user_id: string; followers: number }>).forEach((f) =>
          counts.set(f.user_id, f.followers ?? 0),
        );
      }
      if (!active) return;
      const lower = term.toLowerCase();
      setVideos(
        ((vRes.data ?? []) as VideoHit[]).sort((a, b) => {
          const ap = a.title.toLowerCase().startsWith(lower) ? 1 : 0;
          const bp = b.title.toLowerCase().startsWith(lower) ? 1 : 0;
          return bp - ap || b.views - a.views;
        }),
      );
      setHits(
        rows
          .map((r) => ({ ...r, followers: counts.get(r.id) ?? 0 }))
          .sort((a, b) => b.followers - a.followers || a.channel_name.localeCompare(b.channel_name))
          .slice(0, 5),
      );
      setLoading(false);
    }, 220);
    return () => { active = false; clearTimeout(timer); };
  }, [q]);

  const pick = (hit: ChannelHit) => {
    setOpen(false);
    setQ(hit.channel_name);
    navigate({ to: "/", search: { channel: hit.id } as never });
  };

  const pickVideo = (v: VideoHit) => {
    setOpen(false);
    if (!v.video_url) return;
    play({
      id: v.id, title: v.title, video_url: v.video_url,
      thumbnail_url: v.thumbnail_url, channel_name: v.channel_name, user_id: v.user_id, views: v.views,
    });
  };

  const clear = () => {
    setQ(""); setHits([]); setVideos([]);
    navigate({ to: "/", search: {} as never });
  };

  const empty = !loading && hits.length === 0 && videos.length === 0;

  return (
    <div ref={boxRef} className="relative flex-1 max-w-xs mx-3">
      <div className="flex items-center gap-2 rounded-full bg-secondary border border-border/60 px-3 h-9 focus-within:border-primary transition">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search videos, channels, links"
          aria-label="Search"
          className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        />
        {q && (
          <button type="button" onClick={clear} aria-label="Clear search" className="text-muted-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && q.trim() && (
        <div className="absolute left-0 right-0 top-11 z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-border/60 bg-card shadow-2xl">
          {loading && <p className="px-3 py-3 text-xs text-muted-foreground">Searching…</p>}
          {empty && <p className="px-3 py-3 text-xs text-muted-foreground">No result</p>}

          {!loading && videos.length > 0 && (
            <>
              <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Videos</p>
              {videos.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => pickVideo(v)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary transition text-left"
                >
                  <span className="relative h-9 w-14 rounded-md overflow-hidden bg-secondary shrink-0">
                    {v.thumbnail_url && <img src={v.thumbnail_url} alt="" loading="lazy" className="h-full w-full object-cover" />}
                    <Play className="absolute inset-0 m-auto h-3.5 w-3.5 text-primary" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">{v.title}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {v.channel_name ?? "Visita"} · {formatCount(v.views)} views{v.is_reel ? " · Reel" : ""}
                    </span>
                  </span>
                </button>
              ))}
            </>
          )}

          {!loading && hits.length > 0 && (
            <>
              <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Channels</p>
              {hits.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => pick(h)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary transition text-left"
                >
                  <span className="h-7 w-7 rounded-full overflow-hidden gradient-brand flex items-center justify-center text-[10px] font-bold text-primary-foreground shrink-0">
                    {h.avatar_url ? (
                      <img src={h.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      h.channel_name.slice(0, 1).toUpperCase()
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold">{h.channel_name}</span>
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                    <Users className="h-3 w-3" /> {formatCount(h.followers)}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
