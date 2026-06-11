REVOKE EXECUTE ON FUNCTION public.bump_video_comments() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_video_shares() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_video_views() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_video_likes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;