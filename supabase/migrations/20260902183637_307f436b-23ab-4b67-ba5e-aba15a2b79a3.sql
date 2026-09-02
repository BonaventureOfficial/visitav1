-- Search: trigram index for channel name autocomplete
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_profiles_channel_name_trgm
  ON public.profiles USING gin (channel_name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles (created_at DESC);

-- Feed / gallery / category browsing (keyset friendly)
CREATE INDEX IF NOT EXISTS idx_videos_user_created ON public.videos (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_user_reel_created ON public.videos (user_id, is_reel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_category_reel_created ON public.videos (category, is_reel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_created_id ON public.videos (created_at DESC, id DESC);

-- Engagement lookups by video
CREATE INDEX IF NOT EXISTS idx_video_likes_video ON public.video_likes (video_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_likes_user_created ON public.video_likes (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_views_video ON public.video_views (video_id, view_date DESC);
CREATE INDEX IF NOT EXISTS idx_video_views_user_created ON public.video_views (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_comments_user_created ON public.video_comments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user ON public.comment_likes (user_id);
CREATE INDEX IF NOT EXISTS idx_video_shares_user_created ON public.video_shares (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_supavs_user_day ON public.video_supavs (user_id, day_key DESC);

-- Ranking engine hot paths
CREATE INDEX IF NOT EXISTS idx_video_events_user_video_time
  ON public.video_events (user_id, video_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_events_creator_time
  ON public.video_events (creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_events_category_time
  ON public.video_events (category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_scores_updated ON public.video_scores (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_stats_watch24 ON public.video_stats (watch_seconds_24h DESC);
CREATE INDEX IF NOT EXISTS idx_creator_stats_quality ON public.creator_stats (quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_creator_stats_followers ON public.creator_stats (followers DESC);
CREATE INDEX IF NOT EXISTS idx_user_affinity_user_score ON public.user_affinity (user_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_user_negative_user ON public.user_negative_feedback (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_negative_creator ON public.user_negative_feedback (user_id, creator_id);
CREATE INDEX IF NOT EXISTS idx_profile_verifications_tier ON public.profile_verifications (tier);