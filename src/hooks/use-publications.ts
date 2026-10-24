import { useCallback, useEffect, useRef, useState } from "react";
import { fetchPosts, type Publication, type PostCursor } from "@/lib/posts";
export function usePublications(ownerId?: string) {
  const [rows, setRows] = useState<Publication[]>([]);
  const [busy, setBusy] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState(false);
  const cursor = useRef<PostCursor | null>(null);
  const lock = useRef(false);
  const generation = useRef(0);
  const load = useCallback(async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError(false);
    const version = generation.current;
    try {
      const page = await fetchPosts(ownerId, cursor.current);
      if (version !== generation.current) return;
      setRows(old => [...old, ...page.filter(p => !old.some(r => r.id === p.id))]);
      const last = page.at(-1);
      if (last) cursor.current = { id: last.id, created_at: last.created_at };
      setMore(page.length === 12);
    } catch { if (version === generation.current) setError(true); }
    finally { if (version === generation.current) { lock.current = false; setBusy(false); } }
  }, [ownerId]);
  useEffect(() => {
    generation.current++; lock.current = false; cursor.current = null; setRows([]); setMore(false);
    void load();
    return () => { generation.current++; };
  }, [load]);
  return { rows, busy, more, error, load, remove: (id: string) => setRows(old => old.filter(p => p.id !== id)) };
}