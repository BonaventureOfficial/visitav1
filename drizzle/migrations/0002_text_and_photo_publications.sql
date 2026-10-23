CREATE TABLE public.posts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('text','photo')),
 body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 5000),
 photo_path text,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT posts_content_valid CHECK ((kind = 'text' AND char_length(btrim(body)) > 0 AND photo_path IS NULL) OR (kind = 'photo' AND photo_path IS NOT NULL AND photo_path LIKE user_id::text || '/%'))
);
GRANT SELECT ON public.posts TO anon;
GRANT SELECT, INSERT, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY posts_public_read ON public.posts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY posts_owner_insert ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY posts_owner_delete ON public.posts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX posts_created_id_idx ON public.posts (created_at DESC, id DESC);
CREATE INDEX posts_owner_created_id_idx ON public.posts (user_id, created_at DESC, id DESC);
CREATE POLICY post_photos_read ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'post-photos');
CREATE POLICY post_photos_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'post-photos' AND (storage.foldername(name))[1] = auth.uid()::text AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp','gif'));
CREATE POLICY post_photos_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'post-photos' AND (storage.foldername(name))[1] = auth.uid()::text);