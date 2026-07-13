
-- 1) Join requests: allow a user to request joining a team
ALTER TABLE public.team_invitations
  ADD COLUMN IF NOT EXISTS es_solicitud boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS invitations_insert_manager ON public.team_invitations;
CREATE POLICY invitations_insert_manager ON public.team_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    (is_team_manager(team_id, auth.uid()) AND invited_by = auth.uid() AND es_solicitud = false)
    OR
    (invited_by = auth.uid() AND invited_user_id = auth.uid() AND es_solicitud = true)
  );

DROP POLICY IF EXISTS invitations_update_relevant ON public.team_invitations;
CREATE POLICY invitations_update_relevant ON public.team_invitations
  FOR UPDATE TO authenticated
  USING (
    (es_solicitud = false AND (invited_user_id = auth.uid() OR is_team_manager(team_id, auth.uid())))
    OR
    (es_solicitud = true  AND is_team_manager(team_id, auth.uid()))
  )
  WITH CHECK (
    (es_solicitud = false AND (invited_user_id = auth.uid() OR is_team_manager(team_id, auth.uid())))
    OR
    (es_solicitud = true  AND is_team_manager(team_id, auth.uid()))
  );

-- 2) Team discovery: authenticated users can browse teams (for join requests)
CREATE POLICY teams_select_discovery ON public.teams
  FOR SELECT TO authenticated
  USING (true);

-- 3) Self-enroll to events + captain marks "convocado" + padel court
ALTER TABLE public.event_responses
  ADD COLUMN IF NOT EXISTS es_convocado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS padel_pista int;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS padel_num_pistas int;

-- Allow team members to self-insert their own response (self-signup)
CREATE POLICY responses_self_insert ON public.event_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = event_responses.event_id
        AND is_team_member(e.team_id, auth.uid())
    )
  );

-- Allow team members to delete their own response (un-signup) when not yet convocado
CREATE POLICY responses_self_delete ON public.event_responses
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND es_convocado = false);
