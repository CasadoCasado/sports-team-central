
CREATE TABLE public.match_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  pista integer NOT NULL DEFAULT 1,
  set1_local integer,
  set1_visitante integer,
  set2_local integer,
  set2_visitante integer,
  set3_local integer,
  set3_visitante integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, pista)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_results TO authenticated;
GRANT ALL ON public.match_results TO service_role;

ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "match_results_select_members" ON public.match_results
  FOR SELECT TO authenticated
  USING (public.is_team_member((SELECT team_id FROM public.events WHERE id = event_id), auth.uid()));

CREATE POLICY "match_results_manage_managers" ON public.match_results
  FOR ALL TO authenticated
  USING (public.is_team_manager((SELECT team_id FROM public.events WHERE id = event_id), auth.uid()))
  WITH CHECK (public.is_team_manager((SELECT team_id FROM public.events WHERE id = event_id), auth.uid()));

CREATE TRIGGER match_results_set_updated_at
  BEFORE UPDATE ON public.match_results
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
