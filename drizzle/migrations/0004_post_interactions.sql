ALTER TABLE public.posts ADD COLUMN likes_count integer NOT NULL DEFAULT 0, ADD COLUMN views_count integer NOT NULL DEFAULT 0, ADD COLUMN comments_count integer NOT NULL DEFAULT 0, ADD COLUMN reposts_count integer NOT NULL DEFAULT 0;

CREATE TABLE public.post_likes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE, user_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (post_id, user_id));
CREATE TABLE public.post_reposts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE, user_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (post_id, user_id));
CREATE TABLE public.post_views (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE, user_id uuid NOT NULL, view_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (post_id, user_id, view_date));
CREATE TABLE public.post_comments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE, user_id uuid NOT NULL, parent_id uuid REFERENCES public.post_comments(id) ON DELETE CASCADE, body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 500), created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX post_comments_post_idx ON public.post_comments(post_id, created_at DESC);
CREATE INDEX post_reposts_user_idx ON public.post_reposts(user_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.post_reposts TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.post_comments TO authenticated;
GRANT SELECT, INSERT ON public.post_likes TO authenticated;
GRANT SELECT ON public.post_views TO authenticated;
GRANT SELECT ON public.post_comments, public.post_reposts TO anon;
GRANT ALL ON public.post_likes, public.post_reposts, public.post_views, public.post_comments TO service_role;

ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reposts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own likes read" ON public.post_likes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "like once" ON public.post_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own views read" ON public.post_views FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "reposts read" ON public.post_reposts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "repost own" ON public.post_reposts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "unrepost own" ON public.post_reposts FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "comments read" ON public.post_comments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "comment own" ON public.post_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "delete own comment" ON public.post_comments FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.bump_post_counter() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE col text := TG_ARGV[0]; d int := CASE WHEN TG_OP = 'INSERT' THEN 1 ELSE -1 END; pid uuid := COALESCE(NEW.post_id, OLD.post_id);
BEGIN
  EXECUTE format('UPDATE public.posts SET %I = GREATEST(0, %I + $1) WHERE id = $2', col, col) USING d, pid;
  RETURN NULL;
END $$;
CREATE TRIGGER post_likes_count AFTER INSERT OR DELETE ON public.post_likes FOR EACH ROW EXECUTE FUNCTION public.bump_post_counter('likes_count');
CREATE TRIGGER post_reposts_count AFTER INSERT OR DELETE ON public.post_reposts FOR EACH ROW EXECUTE FUNCTION public.bump_post_counter('reposts_count');
CREATE TRIGGER post_views_count AFTER INSERT OR DELETE ON public.post_views FOR EACH ROW EXECUTE FUNCTION public.bump_post_counter('views_count');
CREATE TRIGGER post_comments_count AFTER INSERT OR DELETE ON public.post_comments FOR EACH ROW EXECUTE FUNCTION public.bump_post_counter('comments_count');

CREATE OR REPLACE FUNCTION public.record_post_view(_post_id uuid, _seconds numeric) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF auth.uid() IS NULL OR _seconds < 3 THEN RETURN false; END IF;
  INSERT INTO public.post_views(post_id, user_id) VALUES (_post_id, auth.uid())
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END $$;
REVOKE EXECUTE ON FUNCTION public.record_post_view(uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_post_view(uuid, numeric) TO authenticated;