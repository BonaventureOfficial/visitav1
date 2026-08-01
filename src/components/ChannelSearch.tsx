import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, X, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCount } from "@/lib/format";

interface ChannelHit {
  id: string;
  channel_name: string;
  avatar_url: string | null;
  followers: number;
}

export function ChannelSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<ChannelHit[]>([]);
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
    const term = q.trim();
    if (term.length < 1) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let active = true;
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,channel_name,avatar_url")
        .ilike("channel_name", `%${term}%`)
        .limit(20);
      if (!active) return;
      const rows = (data ?? []) as Array<{ id: string; channel_name: string; avatar_url: string | null }>;
      if (rows.length === 0) {
        setHits([]);
        setLoading(false);
        return;
      }
      const { data: follows } = await (supabase as any)
        .from("follows")
        .select("following_id")
        .in("following_id", rows.map((r) => r.id));
      const counts = new Map<string, number>();
      ((follows ?? []) as Array<{ following_id: string }>).forEach((f) =>
        counts.set(f.following_id, (counts.get(f.following_id) ?? 0) + 1),
      );
      if (!active) return;
      setHits(
        rows
          .map((r) => ({ ...r, followers: counts.get(r.id) ?? 0 }))
          .sort((a, b) => b.followers - a.followers || a.channel_name.localeCompare(b.channel_name))
          .slice(0, 8),
      );
      setLoading(false);
    }, 180);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [q]);

  const pick = (hit: ChannelHit) => {
    setOpen(false);
    setQ(hit.channel_name);
    navigate({ to: "/", search: { channel: hit.id } as never });
  };

  const clear = () => {
    setQ("");
    setHits([]);
    navigate({ to: "/", search: {} as never });
  };

  return (
    <div ref={boxRef} className="relative flex-1 max-w-xs mx-3">
      <div className="flex items-center gap-2 rounded-full bg-secondary border border-border/60 px-3 h-9 focus-within:border-primary transition">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search channels"
          aria-label="Search channels"
          className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        />
        {q && (
          <button type="button" onClick={clear} aria-label="Clear search" className="text-muted-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && q.trim() && (
        <div className="absolute left-0 right-0 top-11 z-50 rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden">
          {loading && <p className="px-3 py-3 text-xs text-muted-foreground">Searching…</p>}
          {!loading && hits.length === 0 && (
            <p className="px-3 py-3 text-xs text-muted-foreground">No channel found</p>
          )}
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
        </div>
      )}
    </div>
  );
}
