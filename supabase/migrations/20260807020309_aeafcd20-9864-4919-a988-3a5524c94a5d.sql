ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS channel_name_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS bio_updated_at timestamptz;

GRANT SELECT (id, channel_name, avatar_url, bio, channel_name_updated_at, bio_updated_at, created_at, updated_at) ON public.profiles TO anon, authenticated;
GRANT UPDATE (channel_name, avatar_url, bio, channel_name_updated_at, bio_updated_at, updated_at) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;