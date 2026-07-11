
-- Enums
CREATE TYPE public.event_type AS ENUM ('entrenamiento', 'partido', 'reunion', 'otro');
CREATE TYPE public.competition_type AS ENUM ('liga', 'copa', 'torneo', 'amistoso');
CREATE TYPE public.response_status AS ENUM ('convocado', 'confirmado', 'rechazado', 'duda');

-- Competitions
CREATE TABLE public.competitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo public.competition_type NOT NULL DEFAULT 'liga',
  temporada TEXT,
  descripcion TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitions TO authenticated;
GRANT ALL ON public.competitions TO service_role;
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team members view competitions" ON public.competitions FOR SELECT TO authenticated USING (public.is_team_member(team_id, auth.uid()));
CREATE POLICY "team managers manage competitions" ON public.competitions FOR ALL TO authenticated USING (public.is_team_manager(team_id, auth.uid())) WITH CHECK (public.is_team_manager(team_id, auth.uid()));
CREATE TRIGGER competitions_set_updated_at BEFORE UPDATE ON public.competitions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX competitions_team_id_idx ON public.competitions(team_id);

-- Events
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  competition_id UUID REFERENCES public.competitions(id) ON DELETE SET NULL,
  tipo public.event_type NOT NULL DEFAULT 'entrenamiento',
  titulo TEXT NOT NULL,
  descripcion TEXT,
  fecha_inicio TIMESTAMPTZ NOT NULL,
  fecha_fin TIMESTAMPTZ,
  ubicacion TEXT,
  rival TEXT,
  es_local BOOLEAN,
  resultado_local INT,
  resultado_visitante INT,
  requiere_convocatoria BOOLEAN NOT NULL DEFAULT false,
  convocatoria_cierra_en TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team members view events" ON public.events FOR SELECT TO authenticated USING (public.is_team_member(team_id, auth.uid()));
CREATE POLICY "team managers manage events" ON public.events FOR ALL TO authenticated USING (public.is_team_manager(team_id, auth.uid())) WITH CHECK (public.is_team_manager(team_id, auth.uid()));
CREATE TRIGGER events_set_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX events_team_id_fecha_idx ON public.events(team_id, fecha_inicio);
CREATE INDEX events_competition_id_idx ON public.events(competition_id);

-- Event responses (convocatorias)
CREATE TABLE public.event_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status public.response_status NOT NULL DEFAULT 'convocado',
  notas TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_responses TO authenticated;
GRANT ALL ON public.event_responses TO service_role;
ALTER TABLE public.event_responses ENABLE ROW LEVEL SECURITY;
-- Team members can view responses of events belonging to their team
CREATE POLICY "team members view event responses" ON public.event_responses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND public.is_team_member(e.team_id, auth.uid())));
-- Team managers manage all responses (create convocatoria, edit)
CREATE POLICY "team managers manage event responses" ON public.event_responses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND public.is_team_manager(e.team_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND public.is_team_manager(e.team_id, auth.uid())));
-- Players can update only their own response
CREATE POLICY "players update own response" ON public.event_responses FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER event_responses_set_updated_at BEFORE UPDATE ON public.event_responses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX event_responses_event_idx ON public.event_responses(event_id);
CREATE INDEX event_responses_user_idx ON public.event_responses(user_id);

-- Lineups
CREATE TABLE public.lineups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL UNIQUE REFERENCES public.events(id) ON DELETE CASCADE,
  formacion TEXT,
  notas TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lineups TO authenticated;
GRANT ALL ON public.lineups TO service_role;
ALTER TABLE public.lineups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team members view lineups" ON public.lineups FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND public.is_team_member(e.team_id, auth.uid())));
CREATE POLICY "team managers manage lineups" ON public.lineups FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND public.is_team_manager(e.team_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND public.is_team_manager(e.team_id, auth.uid())));
CREATE TRIGGER lineups_set_updated_at BEFORE UPDATE ON public.lineups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Lineup positions
CREATE TABLE public.lineup_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lineup_id UUID NOT NULL REFERENCES public.lineups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  posicion TEXT,
  es_titular BOOLEAN NOT NULL DEFAULT true,
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lineup_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lineup_positions TO authenticated;
GRANT ALL ON public.lineup_positions TO service_role;
ALTER TABLE public.lineup_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "team members view lineup positions" ON public.lineup_positions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.lineups l JOIN public.events e ON e.id = l.event_id
    WHERE l.id = lineup_id AND public.is_team_member(e.team_id, auth.uid())
  ));
CREATE POLICY "team managers manage lineup positions" ON public.lineup_positions FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.lineups l JOIN public.events e ON e.id = l.event_id
    WHERE l.id = lineup_id AND public.is_team_manager(e.team_id, auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.lineups l JOIN public.events e ON e.id = l.event_id
    WHERE l.id = lineup_id AND public.is_team_manager(e.team_id, auth.uid())
  ));
CREATE INDEX lineup_positions_lineup_idx ON public.lineup_positions(lineup_id);
