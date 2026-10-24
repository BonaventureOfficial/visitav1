import { supabase } from "@/integrations/supabase/client";
import { fetchCreatorMeta } from "@/lib/feed";
import { cleanGazette, gazettePaths, type GazetteNode, type PaperTheme } from "@/lib/gazette";

export type PostKind = "text" | "photo";
export type PostCursor = { created_at: string; id: string };
export type Publication = { id: string; user_id: string; kind: string; body: string; photo_path: string | null; created_at: string; photo_url?: string; channel_name?: string; avatar_url?: string | null; rich_content?: GazetteNode | null; paper_theme?: string; inline_images?: Record<string, string> };
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function fetchPosts(ownerId?: string, cursor?: PostCursor | null) {
  let query = supabase.from("posts").select("id,user_id,kind,body,photo_path,created_at,rich_content,paper_theme").order("created_at", { ascending: false }).order("id", { ascending: false }).limit(12);
  if (ownerId) query = query.eq("user_id", ownerId);
  if (cursor) query = query.or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`);
  const { data, error } = await query;
  if (error) throw error;
  const rows = data ?? [];
  const paths = [...new Set(rows.flatMap((p) => [...(p.photo_path ? [p.photo_path] : []), ...gazettePaths(cleanGazette(p.rich_content))]))];
  const [meta, signed] = await Promise.all([
    fetchCreatorMeta([...new Set(rows.map((p) => p.user_id))]),
    paths.length ? supabase.storage.from("post-photos").createSignedUrls(paths, 3600) : Promise.resolve({ data: [] }),
  ]);
  const urls = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));
  return rows.map((p): Publication => ({ ...p, rich_content: cleanGazette(p.rich_content), inline_images: Object.fromEntries(gazettePaths(cleanGazette(p.rich_content)).flatMap(path => { const url = urls.get(path); return url ? [[path, url]] : []; })), channel_name: meta.get(p.user_id)?.channel_name ?? "Visita", avatar_url: meta.get(p.user_id)?.avatar_url, photo_url: p.photo_path ? urls.get(p.photo_path) ?? undefined : undefined }));
}

export async function uploadPostImage(userId: string, file: File) {
  if (!PHOTO_TYPES.includes(file.type) || file.size > 20 * 1024 * 1024) throw new Error("JPG, PNG, WEBP ou GIF · 20 Mo maximum");
  const ext = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" } as Record<string, string>)[file.type];
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("post-photos").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
  if (error) throw error;
  const signed = await supabase.storage.from("post-photos").createSignedUrl(path, 3600);
  if (signed.error || !signed.data) throw signed.error ?? new Error("Photo indisponible");
  return { path, url: signed.data.signedUrl };
}

export async function publishPost(userId: string, kind: PostKind, body: string, file: File | null, document?: GazetteNode | null, paperTheme: PaperTheme = "paper") {
  const text = body.trim();
  if (text.length > 5000 || (kind === "text" && !text)) throw new Error("Texte requis");
  if (kind === "photo" && (!file || !PHOTO_TYPES.includes(file.type) || file.size > 20 * 1024 * 1024)) throw new Error("Photo JPG, PNG, WEBP ou GIF requise (20 Mo maximum)");
  let path: string | null = null;
  if (kind === "photo" && file) {
    const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" }[file.type] ?? "jpg";
    path = `${userId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("post-photos").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
    if (error) throw error;
  }
  const rich = kind === "text" ? cleanGazette(document) : null;
  if (rich && (JSON.stringify(rich).length > 60000 || gazettePaths(rich).some(p => !p.startsWith(`${userId}/`)))) throw new Error("Gazette trop volumineuse ou photo invalide");
  const { data, error } = await supabase.from("posts").insert({ user_id: userId, kind, body: text, photo_path: path, rich_content: rich as never, paper_theme: paperTheme }).select("id").single();
  if (error) {
    if (path) await supabase.storage.from("post-photos").remove([path]);
    throw error;
  }
  return data;
}