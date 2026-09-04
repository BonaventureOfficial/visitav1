
REVOKE EXECUTE ON FUNCTION public.recompute_ranking(boolean, interval) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.recompute_ranking(boolean, interval) TO service_role;
REVOKE EXECUTE ON FUNCTION public.sync_video_scores_meta() FROM anon, authenticated, public;
DROP FUNCTION IF EXISTS public.recompute_ranking();
