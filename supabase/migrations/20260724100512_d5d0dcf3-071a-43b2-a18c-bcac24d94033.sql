
-- 1. Notifications: remove permissive INSERT policy (triggers use SECURITY DEFINER as postgres and bypass RLS)
DROP POLICY IF EXISTS notifications_insert_any ON public.notifications;

-- 2. Profiles: restrict SELECT to self, teammates, and invitation counterparts
CREATE OR REPLACE FUNCTION public.can_view_profile(_target uuid, _viewer uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _viewer IS NOT NULL AND (
      _target = _viewer
      OR EXISTS (
        SELECT 1
        FROM public.team_members a
        JOIN public.team_members b ON a.team_id = b.team_id
        WHERE a.user_id = _viewer AND a.status = 'activo'
          AND b.user_id = _target AND b.status = 'activo'
      )
      OR EXISTS (
        SELECT 1 FROM public.team_invitations i
        WHERE (i.invited_user_id = _target AND (
                 i.invited_by = _viewer
                 OR public.is_team_manager(i.team_id, _viewer)
               ))
           OR (i.invited_user_id = _viewer AND i.invited_by = _target)
      )
    )
$$;

REVOKE EXECUTE ON FUNCTION public.can_view_profile(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_profile(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS profiles_select_own_or_authenticated ON public.profiles;
CREATE POLICY profiles_select_visible ON public.profiles
  FOR SELECT TO authenticated
  USING (public.can_view_profile(id, auth.uid()));

-- 3. Teams discovery: only show teams with open registration
DROP POLICY IF EXISTS teams_select_discovery ON public.teams;
CREATE POLICY teams_select_discovery ON public.teams
  FOR SELECT TO authenticated
  USING (inscripciones_abiertas = true);

-- 4. Revoke EXECUTE on SECURITY DEFINER helpers not meant to be user-callable.
-- Keep: has_role, is_team_member, is_team_manager, can_access_channel (used by RLS),
--       join_channel_by_token (called via RPC), can_view_profile (used by RLS).
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_owner_as_capitan() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_default_channels() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_join_request() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.send_event_reminders() FROM PUBLIC, anon, authenticated;
