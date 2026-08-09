CREATE TABLE public.member_identity (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  nationality text,
  birth_place text,
  birth_date date,
  gender text,
  marital_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_identity TO authenticated;
GRANT ALL ON public.member_identity TO service_role;

ALTER TABLE public.member_identity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own identity" ON public.member_identity
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Members insert own identity" ON public.member_identity
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Members update own identity" ON public.member_identity
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Members delete own identity" ON public.member_identity
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_member_identity()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_member_identity_updated
BEFORE UPDATE ON public.member_identity
FOR EACH ROW EXECUTE FUNCTION public.touch_member_identity();

CREATE OR REPLACE FUNCTION public.sync_videos_channel_name()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.channel_name IS DISTINCT FROM OLD.channel_name THEN
    UPDATE public.videos SET channel_name = NEW.channel_name WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_sync_videos_channel_name
AFTER UPDATE OF channel_name ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_videos_channel_name();

UPDATE public.videos v
SET channel_name = p.channel_name
FROM public.profiles p
WHERE v.user_id = p.id AND v.channel_name IS DISTINCT FROM p.channel_name;