
-- profiles: restrict SELECT to owner; expose safe columns via view
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = on) AS
  SELECT id, channel_name, avatar_url FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- But security_invoker view requires SELECT policy on base for callers.
-- Add a policy that allows reading only non-sensitive columns via the view path.
-- Simpler: add a permissive SELECT policy allowing anyone to read rows,
-- but rely on view to restrict columns. Since RLS is row-level not column-level,
-- and we want email hidden, switch view to security_invoker=off (definer):
DROP VIEW public.profiles_public;
CREATE VIEW public.profiles_public AS
  SELECT id, channel_name, avatar_url FROM public.profiles;
ALTER VIEW public.profiles_public SET (security_invoker = off);
GRANT SELECT ON public.profiles_public TO anon, authenticated;

-- video_likes: owner-only SELECT
DROP POLICY IF EXISTS "Likes are viewable by everyone" ON public.video_likes;
CREATE POLICY "Users view their own likes"
  ON public.video_likes FOR SELECT
  USING (auth.uid() = user_id);

-- video_shares: owner-only SELECT
DROP POLICY IF EXISTS "Shares are viewable by everyone" ON public.video_shares;
CREATE POLICY "Users view their own shares"
  ON public.video_shares FOR SELECT
  USING (auth.uid() = user_id);

-- video_views: owner-only SELECT
DROP POLICY IF EXISTS "Views are viewable by everyone" ON public.video_views;
CREATE POLICY "Users view their own views"
  ON public.video_views FOR SELECT
  USING (auth.uid() = user_id);
