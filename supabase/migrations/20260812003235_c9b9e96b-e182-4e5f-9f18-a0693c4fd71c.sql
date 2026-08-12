
-- ============ ROLES ============
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============ EVENTS ============
CREATE TABLE IF NOT EXISTS public.video_events (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  video_id uuid NOT NULL REFERENCES public.videos(id) ON DELETE CASCADE,
  creator_id uuid,
  category text,
  event_type text NOT NULL,
  watch_ms integer NOT NULL DEFAULT 0,
  position_ms integer NOT NULL DEFAULT 0,
  duration_ms integer NOT NULL DEFAULT 0,
  completion numeric NOT NULL DEFAULT 0,
  session_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_video_events_video_time ON public.video_events (video_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_events_user_time ON public.video_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_events_type_time ON public.video_events (event_type, created_at DESC);
GRANT SELECT ON public.video_events TO authenticated;
GRANT ALL ON public.video_events TO service_role;
ALTER TABLE public.video_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own events" ON public.video_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all events" ON public.video_events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============ AGGREGATES ============
CREATE TABLE IF NOT EXISTS public.video_stats (
  video_id uuid PRIMARY KEY REFERENCES public.videos(id) ON DELETE CASCADE,
  impressions integer NOT NULL DEFAULT 0,
  watch_seconds bigint NOT NULL DEFAULT 0,
  completions integer NOT NULL DEFAULT 0,
  replays integer NOT NULL DEFAULT 0,
  skips integer NOT NULL DEFAULT 0,
  negatives integer NOT NULL DEFAULT 0,
  follows_gained integer NOT NULL DEFAULT 0,
  avg_completion numeric NOT NULL DEFAULT 0,
  watch_seconds_24h bigint NOT NULL DEFAULT 0,
  watch_seconds_prev_24h bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.video_stats TO anon, authenticated;
GRANT ALL ON public.video_stats TO service_role;
ALTER TABLE public.video_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Video stats readable" ON public.video_stats FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.creator_stats (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  videos_count integer NOT NULL DEFAULT 0,
  followers integer NOT NULL DEFAULT 0,
  avg_completion numeric NOT NULL DEFAULT 0,
  quality_score numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.creator_stats TO anon, authenticated;
GRANT ALL ON public.creator_stats TO service_role;
ALTER TABLE public.creator_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Creator stats readable" ON public.creator_stats FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.video_scores (
  video_id uuid PRIMARY KEY REFERENCES public.videos(id) ON DELETE CASCADE,
  quality_score numeric NOT NULL DEFAULT 0,
  trending_score numeric NOT NULL DEFAULT 0,
  freshness numeric NOT NULL DEFAULT 0,
  exploration_boost numeric NOT NULL DEFAULT 0,
  final_score numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.video_scores TO anon, authenticated;
GRANT ALL ON public.video_scores TO service_role;
ALTER TABLE public.video_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Video scores readable" ON public.video_scores FOR SELECT USING (true);
CREATE INDEX IF NOT EXISTS idx_video_scores_final ON public.video_scores (final_score DESC);

CREATE TABLE IF NOT EXISTS public.user_affinity (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  score numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category)
);
GRANT SELECT ON public.user_affinity TO authenticated;
GRANT ALL ON public.user_affinity TO service_role;
ALTER TABLE public.user_affinity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own affinity" ON public.user_affinity FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.user_negative_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id uuid REFERENCES public.videos(id) ON DELETE CASCADE,
  creator_id uuid,
  kind text NOT NULL DEFAULT 'not_interested',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_negative_user_video ON public.user_negative_feedback (user_id, video_id, kind);
GRANT SELECT, INSERT, DELETE ON public.user_negative_feedback TO authenticated;
GRANT ALL ON public.user_negative_feedback TO service_role;
ALTER TABLE public.user_negative_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own negatives" ON public.user_negative_feedback FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ EVENT INGESTION (server validated) ============
CREATE OR REPLACE FUNCTION public.record_video_event(
  _video_id uuid, _event_type text, _watch_ms integer DEFAULT 0,
  _position_ms integer DEFAULT 0, _duration_ms integer DEFAULT 0, _session_id text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v RECORD; uid uuid := auth.uid(); comp numeric := 0; w integer;
BEGIN
  IF _event_type NOT IN ('impression','watch','complete','skip','replay','like','comment','share','follow','not_interested','hide') THEN
    RAISE EXCEPTION 'invalid event type';
  END IF;
  SELECT id, user_id, category, duration_seconds INTO v FROM public.videos WHERE id = _video_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown video'; END IF;

  -- clamp client-supplied numbers (never trusted)
  w := LEAST(GREATEST(COALESCE(_watch_ms,0),0), 4*3600*1000);
  IF COALESCE(v.duration_seconds,0) > 0 THEN
    w := LEAST(w, v.duration_seconds * 1000);
    comp := ROUND(LEAST(1.0, w::numeric / (v.duration_seconds * 1000))::numeric, 4);
  END IF;

  -- basic anti-spam: max 240 events per user per hour
  IF uid IS NOT NULL AND (
    SELECT count(*) FROM public.video_events e
    WHERE e.user_id = uid AND e.created_at > now() - interval '1 hour') > 240 THEN
    RETURN;
  END IF;

  INSERT INTO public.video_events (user_id, video_id, creator_id, category, event_type, watch_ms, position_ms, duration_ms, completion, session_id)
  VALUES (uid, _video_id, v.user_id, v.category, _event_type, w, GREATEST(COALESCE(_position_ms,0),0), GREATEST(COALESCE(_duration_ms,0),0), comp, _session_id);

  IF uid IS NOT NULL AND v.category IS NOT NULL THEN
    INSERT INTO public.user_affinity (user_id, category, score, updated_at)
    VALUES (uid, v.category,
      CASE _event_type
        WHEN 'watch' THEN LEAST(w/60000.0, 3)
        WHEN 'complete' THEN 3 WHEN 'replay' THEN 2 WHEN 'like' THEN 2
        WHEN 'comment' THEN 2 WHEN 'share' THEN 3 WHEN 'follow' THEN 4
        WHEN 'skip' THEN -1 WHEN 'not_interested' THEN -5 WHEN 'hide' THEN -5
        ELSE 0 END, now())
    ON CONFLICT (user_id, category) DO UPDATE
      SET score = GREATEST(-50, LEAST(200, public.user_affinity.score * 0.999 + EXCLUDED.score)),
          updated_at = now();
  END IF;

  IF _event_type IN ('not_interested','hide') AND uid IS NOT NULL THEN
    INSERT INTO public.user_negative_feedback (user_id, video_id, creator_id, kind)
    VALUES (uid, _video_id, v.user_id, _event_type) ON CONFLICT DO NOTHING;
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.record_video_event(uuid,text,integer,integer,integer,text) FROM public;
GRANT EXECUTE ON FUNCTION public.record_video_event(uuid,text,integer,integer,integer,text) TO authenticated, service_role;

-- ============ SUPAV: server validated only ============
DROP POLICY IF EXISTS "Users insert own supavs" ON public.video_supavs;

CREATE OR REPLACE FUNCTION public.award_supav(_video_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE uid uuid := auth.uid(); dk date := (now() AT TIME ZONE 'utc')::date;
        watched_ms bigint; acct_age interval; dh text;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'auth'); END IF;
  IF EXISTS (SELECT 1 FROM public.video_supavs WHERE user_id = uid AND day_key = dk) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_today');
  END IF;
  IF EXISTS (SELECT 1 FROM public.videos WHERE id = _video_id AND user_id = uid) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'self');
  END IF;
  SELECT now() - created_at INTO acct_age FROM auth.users WHERE id = uid;
  IF acct_age IS NULL OR acct_age < interval '1 hour' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'account_too_new');
  END IF;
  SELECT COALESCE(MAX(watch_ms),0) INTO watched_ms FROM public.video_events
   WHERE user_id = uid AND video_id = _video_id AND event_type IN ('watch','complete')
     AND created_at > now() - interval '24 hours';
  IF watched_ms < 60000 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_enough_watch');
  END IF;
  dh := encode(extensions.digest(uid::text || ':' || _video_id::text || ':' || dk::text, 'sha256'), 'hex');
  INSERT INTO public.video_supavs (user_id, video_id, day_key, day_hash) VALUES (uid, _video_id, dk, dh);
  RETURN jsonb_build_object('ok', true);
END; $$;
REVOKE ALL ON FUNCTION public.award_supav(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.award_supav(uuid) TO authenticated, service_role;

-- ============ SCORE RECOMPUTE ============
CREATE OR REPLACE FUNCTION public.recompute_ranking()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.video_stats AS s (video_id, impressions, watch_seconds, completions, replays, skips, negatives, follows_gained, avg_completion, watch_seconds_24h, watch_seconds_prev_24h, updated_at)
  SELECT v.id,
    COALESCE(SUM((e.event_type='impression')::int),0),
    COALESCE(SUM(CASE WHEN e.event_type IN ('watch','complete') THEN e.watch_ms ELSE 0 END),0)/1000,
    COALESCE(SUM((e.event_type='complete')::int),0),
    COALESCE(SUM((e.event_type='replay')::int),0),
    COALESCE(SUM((e.event_type='skip')::int),0),
    COALESCE(SUM((e.event_type IN ('not_interested','hide'))::int),0),
    COALESCE(SUM((e.event_type='follow')::int),0),
    COALESCE(AVG(NULLIF(e.completion,0)),0),
    COALESCE(SUM(CASE WHEN e.created_at > now() - interval '24 hours' AND e.event_type IN ('watch','complete') THEN e.watch_ms ELSE 0 END),0)/1000,
    COALESCE(SUM(CASE WHEN e.created_at BETWEEN now() - interval '48 hours' AND now() - interval '24 hours' AND e.event_type IN ('watch','complete') THEN e.watch_ms ELSE 0 END),0)/1000,
    now()
  FROM public.videos v LEFT JOIN public.video_events e ON e.video_id = v.id
  GROUP BY v.id
  ON CONFLICT (video_id) DO UPDATE SET
    impressions = EXCLUDED.impressions, watch_seconds = EXCLUDED.watch_seconds,
    completions = EXCLUDED.completions, replays = EXCLUDED.replays, skips = EXCLUDED.skips,
    negatives = EXCLUDED.negatives, follows_gained = EXCLUDED.follows_gained,
    avg_completion = EXCLUDED.avg_completion, watch_seconds_24h = EXCLUDED.watch_seconds_24h,
    watch_seconds_prev_24h = EXCLUDED.watch_seconds_prev_24h, updated_at = now();

  INSERT INTO public.creator_stats AS c (user_id, videos_count, followers, avg_completion, quality_score, updated_at)
  SELECT v.user_id, count(*),
    COALESCE((SELECT count(*) FROM public.follows f WHERE f.following_id = v.user_id),0),
    COALESCE(AVG(st.avg_completion),0),
    LEAST(100, COALESCE(AVG(st.avg_completion),0)*50
      + LEAST(30, COALESCE((SELECT count(*) FROM public.follows f WHERE f.following_id = v.user_id),0)::numeric/10)
      + LEAST(20, COALESCE(SUM(st.watch_seconds),0)::numeric/36000)),
    now()
  FROM public.videos v LEFT JOIN public.video_stats st ON st.video_id = v.id
  WHERE v.user_id IS NOT NULL
  GROUP BY v.user_id
  ON CONFLICT (user_id) DO UPDATE SET
    videos_count = EXCLUDED.videos_count, followers = EXCLUDED.followers,
    avg_completion = EXCLUDED.avg_completion, quality_score = EXCLUDED.quality_score, updated_at = now();

  INSERT INTO public.video_scores AS vs (video_id, quality_score, trending_score, freshness, exploration_boost, final_score, updated_at)
  SELECT v.id,
    q.quality, q.trending, q.fresh, q.explore,
    (q.quality * 0.45 + q.trending * 0.25 + q.fresh * 0.15 + q.explore * 0.15),
    now()
  FROM public.videos v
  CROSS JOIN LATERAL (
    SELECT
      LEAST(100, GREATEST(0,
        COALESCE(st.avg_completion,0)*40
        + LEAST(20, COALESCE(st.watch_seconds,0)::numeric/3600)
        + LEAST(10, v.likes::numeric/5)
        + LEAST(10, v.comments_count::numeric/2)
        + LEAST(10, v.shares::numeric)
        + LEAST(15, v.supav_count::numeric*3)
        + LEAST(10, COALESCE(st.follows_gained,0)::numeric*2)
        + LEAST(10, COALESCE(st.replays,0)::numeric)
        + COALESCE(cs.quality_score,0)*0.1
        - LEAST(30, COALESCE(st.skips,0)::numeric*1.5)
        - LEAST(40, COALESCE(st.negatives,0)::numeric*5)
      )) AS quality,
      LEAST(100, GREATEST(0,
        (COALESCE(st.watch_seconds_24h,0) - COALESCE(st.watch_seconds_prev_24h,0))::numeric
        / GREATEST(1, COALESCE(st.watch_seconds_prev_24h,0))::numeric * 25
        + LEAST(50, COALESCE(st.watch_seconds_24h,0)::numeric/600)
      )) AS trending,
      GREATEST(0, 100 * exp(-EXTRACT(EPOCH FROM (now() - v.created_at))/172800.0)) AS fresh,
      CASE WHEN COALESCE(st.impressions,0) < 200 AND v.created_at > now() - interval '7 days'
           THEN 100 - LEAST(90, COALESCE(st.impressions,0)::numeric/2) ELSE 0 END AS explore
    FROM (SELECT 1) dummy
    LEFT JOIN public.video_stats st ON st.video_id = v.id
    LEFT JOIN public.creator_stats cs ON cs.user_id = v.user_id
  ) q
  ON CONFLICT (video_id) DO UPDATE SET
    quality_score = EXCLUDED.quality_score, trending_score = EXCLUDED.trending_score,
    freshness = EXCLUDED.freshness, exploration_boost = EXCLUDED.exploration_boost,
    final_score = EXCLUDED.final_score, updated_at = now();
END; $$;
REVOKE ALL ON FUNCTION public.recompute_ranking() FROM public;
GRANT EXECUTE ON FUNCTION public.recompute_ranking() TO service_role;

-- ============ RANKED FEED ============
CREATE OR REPLACE FUNCTION public.get_ranked_feed(_user_id uuid, _is_reel boolean DEFAULT false, _limit integer DEFAULT 30)
RETURNS TABLE (
  id uuid, user_id uuid, title text, description text, category text,
  thumbnail_url text, video_url text, views integer, likes integer,
  comments_count integer, shares integer, supav_count integer,
  channel_name text, created_at timestamptz, duration_seconds integer,
  is_reel boolean, score numeric
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT v.*, COALESCE(vs.final_score, 0) AS s,
      COALESCE((SELECT a.score FROM public.user_affinity a WHERE a.user_id = _user_id AND a.category = v.category), 0) AS aff,
      CASE WHEN _user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.follows f WHERE f.follower_id = _user_id AND f.following_id = v.user_id) THEN 25 ELSE 0 END AS follow_boost,
      CASE WHEN _user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.video_events e WHERE e.user_id = _user_id AND e.video_id = v.id
          AND e.event_type IN ('watch','complete','skip') AND e.created_at > now() - interval '7 days') THEN 40 ELSE 0 END AS seen_penalty
    FROM public.videos v
    LEFT JOIN public.video_scores vs ON vs.video_id = v.id
    WHERE v.is_reel = _is_reel
      AND (_user_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.user_negative_feedback n
        WHERE n.user_id = _user_id AND (n.video_id = v.id OR (n.creator_id IS NOT NULL AND n.creator_id = v.user_id))))
  ), scored AS (
    SELECT b.*, (b.s + LEAST(40, b.aff * 1.5) + b.follow_boost - b.seen_penalty
                 + random() * 8) AS raw_score
    FROM base b
  ), diversified AS (
    SELECT sc.*,
      raw_score
        - 12 * (row_number() OVER (PARTITION BY sc.user_id ORDER BY raw_score DESC) - 1)
        - 6 * (row_number() OVER (PARTITION BY sc.category ORDER BY raw_score DESC) - 1) AS final_rank_score
    FROM scored sc
  )
  SELECT id, user_id, title, description, category, thumbnail_url, video_url, views, likes,
         comments_count, shares, supav_count, channel_name, created_at, duration_seconds, is_reel,
         final_rank_score
  FROM diversified
  ORDER BY final_rank_score DESC
  LIMIT GREATEST(1, LEAST(_limit, 100));
$$;
REVOKE ALL ON FUNCTION public.get_ranked_feed(uuid, boolean, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_ranked_feed(uuid, boolean, integer) TO anon, authenticated, service_role;
