
-- Remove the security definer view
DROP VIEW IF EXISTS public.profiles_public;

-- Allow reading profile rows again, but only non-sensitive columns
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Profiles readable (non-sensitive columns)"
  ON public.profiles FOR SELECT
  USING (true);

-- Column-level: revoke SELECT on email from client roles
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (id, channel_name, avatar_url, created_at, updated_at) ON public.profiles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
