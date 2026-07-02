
ALTER TABLE public.videos ADD COLUMN IF NOT EXISTS supav_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.video_supavs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  day_key DATE NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  day_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, day_key),
  UNIQUE (day_hash)
);

CREATE INDEX IF NOT EXISTS video_supavs_video_id_idx ON public.video_supavs(video_id);
CREATE INDEX IF NOT EXISTS video_supavs_day_key_idx ON public.video_supavs(day_key);

GRANT SELECT, INSERT ON public.video_supavs TO authenticated;
GRANT ALL ON public.video_supavs TO service_role;

ALTER TABLE public.video_supavs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view all supavs" ON public.video_supavs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own supavs" ON public.video_supavs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND day_hash = encode(digest(user_id::text || ':' || video_id::text || ':' || day_key::text, 'sha256'), 'hex'));

CREATE OR REPLACE FUNCTION public.bump_video_supavs()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.videos SET supav_count = supav_count + 1 WHERE id = NEW.video_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bump_video_supavs ON public.video_supavs;
CREATE TRIGGER trg_bump_video_supavs AFTER INSERT ON public.video_supavs
FOR EACH ROW EXECUTE FUNCTION public.bump_video_supavs();
