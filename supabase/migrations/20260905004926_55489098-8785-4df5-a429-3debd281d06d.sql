DROP FUNCTION IF EXISTS public.get_ranked_feed(uuid, boolean, integer);

CREATE OR REPLACE FUNCTION public.get_ranked_feed(
  _user_id uuid,
  _is_reel boolean DEFAULT false,
  _limit integer DEFAULT 30,
  _seed integer DEFAULT 0,
  _page integer DEFAULT 0,
  _cursor_score numeric DEFAULT NULL,
  _cursor_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid, user_id uuid, title text, description text, category text,
  thumbnail_url text, video_url text, views integer, likes integer,
  comments_count integer, shares integer, supav_count integer, channel_name text,
  created_at timestamp with time zone, duration_seconds integer, is_reel boolean, score numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
WITH
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
-- --- candidate pools: bounded, index-backed, widened with scroll depth
p_quality AS (
  SELECT video_id FROM public.video_scores
  WHERE is_reel = _is_reel ORDER BY final_score DESC
  LIMIT 120 * (GREATEST(0, LEAST(COALESCE(_page, 0), 7)) + 1)
),
p_trending AS (
  SELECT video_id FROM public.video_scores
  WHERE is_reel = _is_reel ORDER BY trending_score DESC
  LIMIT 100 * (GREATEST(0, LEAST(COALESCE(_page, 0), 7)) + 1)
),
p_explore AS (
  SELECT video_id FROM public.video_scores
  WHERE is_reel = _is_reel AND exploration_boost > 0
  ORDER BY exploration_boost DESC
  LIMIT 60 * (GREATEST(0, LEAST(COALESCE(_page, 0), 7)) + 1)
),
p_fresh AS (
  SELECT v.id AS video_id FROM public.videos v
  WHERE v.is_reel = _is_reel ORDER BY v.created_at DESC
  LIMIT 80 * (GREATEST(0, LEAST(COALESCE(_page, 0), 7)) + 1)
),
p_popular AS (
  SELECT v.id AS video_id FROM public.videos v
  WHERE v.is_reel = _is_reel ORDER BY v.views DESC
  LIMIT 60 * (GREATEST(0, LEAST(COALESCE(_page, 0), 7)) + 1)
),
p_follow AS (
  SELECT v.id AS video_id FROM public.videos v
  JOIN followed fo ON fo.following_id = v.user_id
  WHERE v.is_reel = _is_reel ORDER BY v.created_at DESC
  LIMIT 80 * (GREATEST(0, LEAST(COALESCE(_page, 0), 7)) + 1)
),
p_affinity AS (
  SELECT v.id AS video_id FROM public.videos v
  JOIN top_cats c ON c.category = v.category
  WHERE v.is_reel = _is_reel ORDER BY v.created_at DESC
  LIMIT 80 * (GREATEST(0, LEAST(COALESCE(_page, 0), 7)) + 1)
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
scored AS (
  SELECT v.id, v.user_id, v.title, v.description, v.category, v.thumbnail_url,
         v.video_url, v.views, v.likes, v.comments_count, v.shares, v.supav_count,
         v.channel_name, v.created_at, v.duration_seconds, v.is_reel,
         (
           COALESCE(vs.final_score, 0)
           + LEAST(40, COALESCE(af.score, 0) * 1.5)
           + CASE WHEN fo.following_id IS NOT NULL THEN 25 ELSE 0 END
           - CASE WHEN s.video_id IS NOT NULL THEN 40 ELSE 0 END
           + (('x' || substr(md5(v.id::text || ':' || COALESCE(_seed, 0)::text), 1, 8))::bit(32)::bigint
              % 8000)::numeric / 1000.0
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
diversified AS (
  SELECT sc.*,
    round(
      raw_score
        - 12 * (row_number() OVER (PARTITION BY sc.user_id ORDER BY raw_score DESC, sc.id DESC) - 1)
        - 6  * (row_number() OVER (PARTITION BY sc.category ORDER BY raw_score DESC, sc.id DESC) - 1)
    , 6) AS final_rank_score
  FROM scored sc
)
SELECT id, user_id, title, description, category, thumbnail_url, video_url, views, likes,
       comments_count, shares, supav_count, channel_name, created_at, duration_seconds,
       is_reel, final_rank_score
FROM diversified
WHERE _cursor_score IS NULL
   OR (final_rank_score, id) < (_cursor_score, COALESCE(_cursor_id, '00000000-0000-0000-0000-000000000000'::uuid))
ORDER BY final_rank_score DESC, id DESC
LIMIT GREATEST(1, LEAST(_limit, 100));
$function$;

REVOKE ALL ON FUNCTION public.get_ranked_feed(uuid, boolean, integer, integer, integer, numeric, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ranked_feed(uuid, boolean, integer, integer, integer, numeric, uuid) TO anon, authenticated, service_role;

-- Batched creator metadata: one round-trip instead of one query per card
CREATE OR REPLACE FUNCTION public.get_creator_meta(_owner_ids uuid[])
RETURNS TABLE(
  user_id uuid, channel_name text, avatar_url text, bio text,
  joined_at timestamp with time zone, tier text, followers integer, is_following boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.id, p.channel_name, p.avatar_url, p.bio, p.created_at,
         pv.tier,
         COALESCE(cs.followers, 0)::integer,
         (auth.uid() IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.follows f
            WHERE f.follower_id = auth.uid() AND f.following_id = p.id
         )) AS is_following
  FROM public.profiles p
  LEFT JOIN public.profile_verifications pv ON pv.user_id = p.id
  LEFT JOIN public.creator_stats cs ON cs.user_id = p.id
  WHERE p.id = ANY(COALESCE(_owner_ids, '{}'::uuid[]))
  LIMIT 200;
$function$;

REVOKE ALL ON FUNCTION public.get_creator_meta(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_creator_meta(uuid[]) TO anon, authenticated, service_role;