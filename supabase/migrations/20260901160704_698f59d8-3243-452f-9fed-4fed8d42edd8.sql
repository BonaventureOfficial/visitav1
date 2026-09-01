
-- 1. VisitaCEO becomes admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('dcc07b7a-9776-4030-983b-411864e46bf6', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- 2. Verification badges
CREATE TABLE IF NOT EXISTS public.profile_verifications (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier text NOT NULL DEFAULT 'platinum',
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.profile_verifications TO anon;
GRANT SELECT ON public.profile_verifications TO authenticated;
GRANT ALL ON public.profile_verifications TO service_role;

ALTER TABLE public.profile_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Verifications readable by everyone"
  ON public.profile_verifications FOR SELECT USING (true);

CREATE POLICY "Admins manage verifications"
  ON public.profile_verifications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.touch_profile_verifications()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profile_verifications_updated
BEFORE UPDATE ON public.profile_verifications
FOR EACH ROW EXECUTE FUNCTION public.touch_profile_verifications();

ALTER TABLE public.profile_verifications
  ADD CONSTRAINT profile_verifications_tier_check
  CHECK (tier IN ('platinum','gold','blue'));

-- 3. Platinum for VisitaCEO
INSERT INTO public.profile_verifications (user_id, tier, granted_by)
VALUES ('dcc07b7a-9776-4030-983b-411864e46bf6', 'platinum', 'dcc07b7a-9776-4030-983b-411864e46bf6')
ON CONFLICT (user_id) DO UPDATE SET tier = 'platinum', updated_at = now();

-- 4. Admin moderation powers
CREATE POLICY "Admins can delete any video"
  ON public.videos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update any video"
  ON public.videos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete any comment"
  ON public.video_comments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
