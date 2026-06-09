
-- Storage policies for videos & thumbnails buckets
CREATE POLICY "Public can read videos"
ON storage.objects FOR SELECT TO public
USING (bucket_id IN ('videos','thumbnails'));

CREATE POLICY "Authenticated can upload videos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('videos','thumbnails') AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners can update own media"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('videos','thumbnails') AND owner = auth.uid());

CREATE POLICY "Owners can delete own media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('videos','thumbnails') AND owner = auth.uid());
