
-- 1) Denormalized routing columns on video_scores for cheap candidate pools
ALTER TABLE public.video_scores
  ADD COLUMN IF NOT EXISTS is_reel boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS category text;

UPDATE public.video_scores vs
SET is_reel = v.is_reel, created_at = v.created_at, user_id = v.user_id, category = v.category
FROM public.videos v WHERE v.id = vs.video_id;

CREATE INDEX IF NOT EXISTS idx_video_scores_reel_final ON public.video_scores (is_reel, final_score DESC);
CREATE INDEX IF NOT EXISTS idx_video_scores_reel_trending ON public.video_scores (is_reel, trending_score DESC);
CREATE INDEX IF NOT EXISTS idx_video_scores_reel_explore ON public.video_scores (is_reel, exploration_boost DESC);
CREATE INDEX IF NOT EXISTS idx_videos_reel_views ON public.videos (is_reel, views DESC);
CREATE INDEX IF NOT EXISTS idx_video_events_created ON public.video_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_events_user_video_type ON public.video_events (user_id, video_id, event_type);

-- keep denormalized columns in sync
CREATE OR REPLACE FUNCTION public.sync_video_scores_meta()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.video_scores (video_id, is_reel, created_at, user_id, category, exploration_boost, freshness, final_score)
  VALUES (NEW.id, NEW.is_reel, NEW.created_at, NEW.user_id, NEW.category, 100, 100, 30)
  ON CONFLICT (video_id) DO UPDATE
    SET is_reel = EXCLUDED.is_reel, created_at = EXCLUDED.created_at,
        user_id = EXCLUDED.user_id, category = EXCLUDED.category;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_video_scores_meta ON public.videos;
CREATE TRIGGER trg_sync_video_scores_meta
AFTER INSERT OR UPDATE OF is_reel, category, user_id ON public.videos
FOR EACH ROW EXECUTE FUNCTION public.sync_video_scores_meta();

-- make sure every existing video has a score row
INSERT INTO public.video_scores (video_id, is_reel, created_at, user_id, category, exploration_boost, freshness, final_score)
SELECT v.id, v.is_reel, v.created_at, v.user_id, v.category, 100, 100, 30
FROM public.videos v
ON CONFLICT (video_id) DO NOTHING;

-- 2) Multi-stage feed: candidate generation -> ranking -> diversity
CREATE OR REPLACE FUNCTION public.get_ranked_feed(
  _user_id uuid,
  _is_reel boolean DEFAULT false,
  _limit integer DEFAULT 30
)
RETURNS TABLE(
  id uuid, user_id uuid, title text, description text, category text,
  thumbnail_url text, video_url text, views integer, likes integer,
  comments_count integer, shares integer, supav_count integer,
  channel_name text, created_at timestamptz, duration_seconds integer,
  is_reel boolean, score numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
WITH
-- --- seen set: loaded ONCE via (user_id, created_at) index
seen AS (
  SELECT DISTINCT e.video_id
  FROM public.video_events e
  WHERE _user_id IS NOT NULL
    AND e.user_id = _user_id
    AND e.created_at > now() - interval '7 days'
    AND e.event_type IN ('watch','complete','skip')
  LIMIT 3000
),
neg AS (
  SELECT n.video_id, n.creator_id
  FROM public.user_negative_feedback n
  WHERE _user_id IS NOT NULL AND n.user_id = _user_id
  LIMIT 2000
),
neg_videos AS (SELECT video_id FROM neg WHERE video_id IS NOT NULL),
neg_creators AS (SELECT DISTINCT creator_id FROM neg WHERE creator_id IS NOT NULL),
top_cats AS (
  SELECT a.category FROM public.user_affinity a
  WHERE _user_id IS NOT NULL AND a.user_id = _user_id AND a.score > 0
  ORDER BY a.score DESC LIMIT 4
),
followed AS (
  SELECT f.following_id FROM public.follows f
  WHERE _user_id IS NOT NULL AND f.follower_id = _user_id
  LIMIT 500
),
-- --- candidate pools (each strictly bounded and index-backed)
p_quality AS (
  SELECT video_id FROM public.video_scores
  WHERE is_reel = _is_reel ORDER BY final_score DESC LIMIT 120
),
p_trending AS (
  SELECT video_id FROM public.video_scores
  WHERE is_reel = _is_reel ORDER BY trending_score DESC LIMIT 100
),
p_explore AS (
  SELECT video_id FROM public.video_scores
  WHERE is_reel = _is_reel AND exploration_boost > 0
  ORDER BY exploration_boost DESC LIMIT 60
),
p_fresh AS (
  SELECT v.id AS video_id FROM public.videos v
  WHERE v.is_reel = _is_reel ORDER BY v.created_at DESC LIMIT 80
),
p_popular AS (
  SELECT v.id AS video_id FROM public.videos v
  WHERE v.is_reel = _is_reel ORDER BY v.views DESC LIMIT 60
),
p_follow AS (
  SELECT v.id AS video_id FROM public.videos v
  JOIN followed fo ON fo.following_id = v.user_id
  WHERE v.is_reel = _is_reel ORDER BY v.created_at DESC LIMIT 80
),
p_affinity AS (
  SELECT v.id AS video_id FROM public.videos v
  JOIN top_cats c ON c.category = v.category
  WHERE v.is_reel = _is_reel ORDER BY v.created_at DESC LIMIT 80
),
candidates AS (
  SELECT video_id FROM p_quality
  UNION SELECT video_id FROM p_trending
  UNION SELECT video_id FROM p_explore
  UNION SELECT video_id FROM p_fresh
  UNION SELECT video_id FROM p_popular
  UNION SELECT video_id FROM p_follow
  UNION SELECT video_id FROM p_affinity
),
-- --- ranking on the bounded candidate set only
scored AS (
  SELECT v.id, v.user_id, v.title, v.description, v.category, v.thumbnail_url,
         v.video_url, v.views, v.likes, v.comments_count, v.shares, v.supav_count,
         v.channel_name, v.created_at, v.duration_seconds, v.is_reel,
         (
           COALESCE(vs.final_score, 0)
           + LEAST(40, COALESCE(af.score, 0) * 1.5)
           + CASE WHEN fo.following_id IS NOT NULL THEN 25 ELSE 0 END
           - CASE WHEN s.video_id IS NOT NULL THEN 40 ELSE 0 END
           + random() * 8
         )::numeric AS raw_score
  FROM candidates c
  JOIN public.videos v ON v.id = c.video_id
  LEFT JOIN public.video_scores vs ON vs.video_id = v.id
  LEFT JOIN public.user_affinity af ON af.user_id = _user_id AND af.category = v.category
  LEFT JOIN followed fo ON fo.following_id = v.user_id
  LEFT JOIN seen s ON s.video_id = v.id
  WHERE NOT EXISTS (SELECT 1 FROM neg_videos nv WHERE nv.video_id = v.id)
    AND (v.user_id IS NULL OR NOT EXISTS (SELECT 1 FROM neg_creators nc WHERE nc.creator_id = v.user_id))
),
-- --- diversity re-ranking
diversified AS (
  SELECT sc.*,
    raw_score
      - 12 * (row_number() OVER (PARTITION BY sc.user_id ORDER BY raw_score DESC) - 1)
      - 6  * (row_number() OVER (PARTITION BY sc.category ORDER BY raw_score DESC) - 1) AS final_rank_score
  FROM scored sc
)
SELECT id, user_id, title, description, category, thumbnail_url, video_url, views, likes,
       comments_count, shares, supav_count, channel_name, created_at, duration_seconds,
       is_reel, final_rank_score
FROM diversified
ORDER BY final_rank_score DESC
LIMIT GREATEST(1, LEAST(_limit, 100));
$$;

-- 3) Incremental recompute
CREATE OR REPLACE FUNCTION public.recompute_ranking(_full boolean DEFAULT false, _window interval DEFAULT interval '48 hours')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n_targets int;
BEGIN
  CREATE TEMP TABLE _targets(video_id uuid PRIMARY KEY) ON COMMIT DROP;

  IF _full THEN
    INSERT INTO _targets SELECT id FROM public.videos;
  ELSE
    INSERT INTO _targets
      SELECT DISTINCT e.video_id FROM public.video_events e
      WHERE e.created_at > now() - _window
    ON CONFLICT DO NOTHING;
    -- always refresh recent videos (freshness/exploration decay)
    INSERT INTO _targets
      SELECT v.id FROM public.videos v WHERE v.created_at > now() - interval '7 days'
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT count(*) INTO n_targets FROM _targets;
  IF n_targets = 0 THEN RETURN; END IF;

  INSERT INTO public.video_stats AS s (video_id, impressions, watch_seconds, completions, replays, skips, negatives, follows_gained, avg_completion, watch_seconds_24h, watch_seconds_prev_24h, updated_at)
  SELECT t.video_id,
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
  FROM _targets t LEFT JOIN public.video_events e ON e.video_id = t.video_id
  GROUP BY t.video_id
  ON CONFLICT (video_id) DO UPDATE SET
    impressions = EXCLUDED.impressions, watch_seconds = EXCLUDED.watch_seconds,
    completions = EXCLUDED.completions, replays = EXCLUDED.replays, skips = EXCLUDED.skips,
    negatives = EXCLUDED.negatives, follows_gained = EXCLUDED.follows_gained,
    avg_completion = EXCLUDED.avg_completion, watch_seconds_24h = EXCLUDED.watch_seconds_24h,
    watch_seconds_prev_24h = EXCLUDED.watch_seconds_prev_24h, updated_at = now();

  -- creators touched by the targeted videos only
  INSERT INTO public.creator_stats AS c (user_id, videos_count, followers, avg_completion, quality_score, updated_at)
  SELECT v.user_id, count(*),
    COALESCE((SELECT count(*) FROM public.follows f WHERE f.following_id = v.user_id),0),
    COALESCE(AVG(st.avg_completion),0),
    LEAST(100, COALESCE(AVG(st.avg_completion),0)*50
      + LEAST(30, COALESCE((SELECT count(*) FROM public.follows f WHERE f.following_id = v.user_id),0)::numeric/10)
      + LEAST(20, COALESCE(SUM(st.watch_seconds),0)::numeric/36000)),
    now()
  FROM public.videos v
  LEFT JOIN public.video_stats st ON st.video_id = v.id
  WHERE v.user_id IS NOT NULL
    AND v.user_id IN (SELECT DISTINCT v2.user_id FROM public.videos v2 JOIN _targets t2 ON t2.video_id = v2.id WHERE v2.user_id IS NOT NULL)
  GROUP BY v.user_id
  ON CONFLICT (user_id) DO UPDATE SET
    videos_count = EXCLUDED.videos_count, followers = EXCLUDED.followers,
    avg_completion = EXCLUDED.avg_completion, quality_score = EXCLUDED.quality_score, updated_at = now();

  INSERT INTO public.video_scores AS vs (video_id, is_reel, created_at, user_id, category, quality_score, trending_score, freshness, exploration_boost, final_score, updated_at)
  SELECT v.id, v.is_reel, v.created_at, v.user_id, v.category,
    q.quality, q.trending, q.fresh, q.explore,
    (q.quality * 0.45 + q.trending * 0.25 + q.fresh * 0.15 + q.explore * 0.15),
    now()
  FROM public.videos v
  JOIN _targets t ON t.video_id = v.id
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
    is_reel = EXCLUDED.is_reel, created_at = EXCLUDED.created_at,
    user_id = EXCLUDED.user_id, category = EXCLUDED.category,
    quality_score = EXCLUDED.quality_score, trending_score = EXCLUDED.trending_score,
    freshness = EXCLUDED.freshness, exploration_boost = EXCLUDED.exploration_boost,
    final_score = EXCLUDED.final_score, updated_at = now();
END; $$;

-- 4) Stronger server-side abuse protection on event ingestion
CREATE OR REPLACE FUNCTION public.record_video_event(
  _video_id uuid, _event_type text, _watch_ms integer DEFAULT 0,
  _position_ms integer DEFAULT 0, _duration_ms integer DEFAULT 0, _session_id text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v RECORD; uid uuid := auth.uid(); comp numeric := 0; w integer; last_at timestamptz;
BEGIN
  IF _event_type NOT IN ('impression','watch','complete','skip','replay','like','comment','share','follow','not_interested','hide') THEN
    RAISE EXCEPTION 'invalid event type';
  END IF;
  SELECT id, user_id, category, duration_seconds INTO v FROM public.videos WHERE id = _video_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown video'; END IF;

  w := LEAST(GREATEST(COALESCE(_watch_ms,0),0), 4*3600*1000);
  IF COALESCE(v.duration_seconds,0) > 0 THEN
    w := LEAST(w, v.duration_seconds * 1000);
    comp := ROUND(LEAST(1.0, w::numeric / (v.duration_seconds * 1000))::numeric, 4);
  END IF;

  IF uid IS NOT NULL THEN
    -- global hourly rate limit
    IF (SELECT count(*) FROM public.video_events e
        WHERE e.user_id = uid AND e.created_at > now() - interval '1 hour') > 240 THEN
      RETURN;
    END IF;
    -- per-video/type debounce: ignore artificial repetitions
    SELECT max(e.created_at) INTO last_at FROM public.video_events e
     WHERE e.user_id = uid AND e.video_id = _video_id AND e.event_type = _event_type;
    IF last_at IS NOT NULL AND _event_type IN ('impression','skip','replay','like','share','follow') 
       AND last_at > now() - interval '30 seconds' THEN
      RETURN;
    END IF;
    IF last_at IS NOT NULL AND _event_type IN ('watch','complete') AND last_at > now() - interval '5 seconds' THEN
      RETURN;
    END IF;
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
