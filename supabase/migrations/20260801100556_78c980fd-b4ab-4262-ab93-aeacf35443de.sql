GRANT EXECUTE ON FUNCTION public.can_view_profile(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_manager(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_channel(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.can_view_profile(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_team_manager(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_access_channel(uuid, uuid) FROM anon;