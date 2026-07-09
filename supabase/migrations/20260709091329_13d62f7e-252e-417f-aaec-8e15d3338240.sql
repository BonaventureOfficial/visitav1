ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS is_reel boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS duration_seconds integer;

CREATE INDEX IF NOT EXISTS videos_is_reel_created_at_idx
  ON public.videos (is_reel, created_at DESC);