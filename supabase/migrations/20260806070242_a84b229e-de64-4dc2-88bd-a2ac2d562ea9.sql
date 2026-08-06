-- 1) Restrict competition_registrations SELECT to team members/managers
DROP POLICY IF EXISTS "registrations readable" ON public.competition_registrations;
CREATE POLICY "registrations readable by team" ON public.competition_registrations
FOR SELECT TO authenticated
USING (public.is_team_member(team_id, auth.uid()) OR public.is_team_manager(team_id, auth.uid()));

-- 2) match_participations is system-maintained: explicitly read-only for clients
REVOKE INSERT, UPDATE, DELETE ON public.match_participations FROM authenticated, anon;
GRANT SELECT ON public.match_participations TO authenticated;
GRANT ALL ON public.match_participations TO service_role;
COMMENT ON TABLE public.match_participations IS 'System-maintained: rows are written only by recalc_event_result() triggers. No client write policies by design.';

-- 3) Revoke EXECUTE on internal SECURITY DEFINER functions from anon/authenticated
REVOKE ALL ON FUNCTION public.recalc_event_result(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_recalc_from_match_results() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_recalc_from_responses() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_match_result_scores() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_event_registration() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.send_event_reminders() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_join_request() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_default_channels() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_owner_as_capitan() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;