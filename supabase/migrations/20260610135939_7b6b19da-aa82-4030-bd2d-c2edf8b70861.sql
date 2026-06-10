
CREATE TABLE public.video_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, video_id)
);
GRANT SELECT, INSERT, DELETE ON public.video_likes TO authenticated;
GRANT SELECT ON public.video_likes TO anon;
GRANT ALL ON public.video_likes TO service_role;
ALTER TABLE public.video_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Likes are viewable by everyone" ON public.video_likes FOR SELECT USING (true);
CREATE POLICY "Users like as themselves" ON public.video_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users unlike themselves" ON public.video_likes FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.bump_video_likes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.videos SET likes = likes + 1 WHERE id = NEW.video_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.videos SET likes = GREATEST(0, likes - 1) WHERE id = OLD.video_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER trg_video_likes_ins AFTER INSERT ON public.video_likes
  FOR EACH ROW EXECUTE FUNCTION public.bump_video_likes();
CREATE TRIGGER trg_video_likes_del AFTER DELETE ON public.video_likes
  FOR EACH ROW EXECUTE FUNCTION public.bump_video_likes();

CREATE TABLE public.video_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  view_date date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, video_id, view_date)
);
GRANT SELECT, INSERT ON public.video_views TO authenticated;
GRANT ALL ON public.video_views TO service_role;
ALTER TABLE public.video_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Views are viewable by everyone" ON public.video_views FOR SELECT USING (true);
CREATE POLICY "Users record their own views" ON public.video_views FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.bump_video_views()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.videos SET views = views + 1 WHERE id = NEW.video_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_video_views_ins AFTER INSERT ON public.video_views
  FOR EACH ROW EXECUTE FUNCTION public.bump_video_views();
