CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE INDEX IF NOT EXISTS idx_videos_title_trgm ON public.videos USING gin (title extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_videos_channel_trgm ON public.videos USING gin (channel_name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_videos_reel_created_id ON public.videos (is_reel, created_at DESC, id DESC);