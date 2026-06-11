CREATE TABLE IF NOT EXISTS public.video_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT video_comments_body_length CHECK (char_length(trim(body)) BETWEEN 1 AND 500)
);

GRANT SELECT ON public.video_comments TO anon;
GRANT SELECT, INSERT, DELETE ON public.video_comments TO authenticated;
GRANT ALL ON public.video_comments TO service_role;

ALTER TABLE public.video_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.video_comments;
CREATE POLICY "Comments are viewable by everyone"
ON public.video_comments
FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Users comment as themselves" ON public.video_comments;
CREATE POLICY "Users comment as themselves"
ON public.video_comments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete their own comments" ON public.video_comments;
CREATE POLICY "Users delete their own comments"
ON public.video_comments
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS video_comments_video_created_idx ON public.video_comments(video_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.video_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.video_shares TO anon;
GRANT SELECT, INSERT ON public.video_shares TO authenticated;
GRANT ALL ON public.video_shares TO service_role;

ALTER TABLE public.video_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shares are viewable by everyone" ON public.video_shares;
CREATE POLICY "Shares are viewable by everyone"
ON public.video_shares
FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Users share as themselves" ON public.video_shares;
CREATE POLICY "Users share as themselves"
ON public.video_shares
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS video_shares_video_created_idx ON public.video_shares(video_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.bump_video_comments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.videos SET comments_count = comments_count + 1 WHERE id = NEW.video_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.videos SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.video_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS on_video_comment_count ON public.video_comments;
CREATE TRIGGER on_video_comment_count
AFTER INSERT OR DELETE ON public.video_comments
FOR EACH ROW EXECUTE FUNCTION public.bump_video_comments();

CREATE OR REPLACE FUNCTION public.bump_video_shares()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.videos SET shares = shares + 1 WHERE id = NEW.video_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_video_share_count ON public.video_shares;
CREATE TRIGGER on_video_share_count
AFTER INSERT ON public.video_shares
FOR EACH ROW EXECUTE FUNCTION public.bump_video_shares();

DROP TRIGGER IF EXISTS on_video_view_count ON public.video_views;
CREATE TRIGGER on_video_view_count
AFTER INSERT ON public.video_views
FOR EACH ROW EXECUTE FUNCTION public.bump_video_views();

DROP TRIGGER IF EXISTS on_video_like_count ON public.video_likes;
CREATE TRIGGER on_video_like_count
AFTER INSERT OR DELETE ON public.video_likes
FOR EACH ROW EXECUTE FUNCTION public.bump_video_likes();