-- 1. Revoke EXECUTE on internal SECURITY DEFINER helpers (used only inside policies)
REVOKE EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_team_manager(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_access_channel(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_view_profile(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.join_channel_by_token(text) FROM PUBLIC, anon;

-- 2. Time-box invitation-based profile visibility to pending invitations only
CREATE OR REPLACE FUNCTION public.can_view_profile(_target uuid, _viewer uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
        WHERE i.status = 'pendiente'
          AND (
            (i.invited_user_id = _target AND (
               i.invited_by = _viewer
               OR public.is_team_manager(i.team_id, _viewer)
             ))
            OR (i.invited_user_id = _viewer AND i.invited_by = _target)
          )
      )
    )
$function$;

REVOKE EXECUTE ON FUNCTION public.can_view_profile(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- 3. Avatars: only related users can read
DROP POLICY IF EXISTS "avatars_read" ON storage.objects;
CREATE POLICY "avatars_read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars'
  AND public.can_view_profile(((storage.foldername(name))[1])::uuid, auth.uid())
);

-- 4. Team logos: writes by owner folder or team managers on team folder; reads authenticated only
DROP POLICY IF EXISTS "team_logos_read" ON storage.objects;
CREATE POLICY "team_logos_read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'team-logos');

DROP POLICY IF EXISTS "team_logos_insert_own" ON storage.objects;
CREATE POLICY "team_logos_insert_own" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'team-logos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_team_manager(((storage.foldername(name))[1])::uuid, auth.uid())
  )
);

DROP POLICY IF EXISTS "team_logos_update_own" ON storage.objects;
CREATE POLICY "team_logos_update_own" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'team-logos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_team_manager(((storage.foldername(name))[1])::uuid, auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'team-logos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_team_manager(((storage.foldername(name))[1])::uuid, auth.uid())
  )
);

DROP POLICY IF EXISTS "team_logos_delete_own" ON storage.objects;
CREATE POLICY "team_logos_delete_own" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'team-logos'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.is_team_manager(((storage.foldername(name))[1])::uuid, auth.uid())
  )
);