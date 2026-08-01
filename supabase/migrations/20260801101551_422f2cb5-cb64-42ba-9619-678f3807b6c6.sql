-- 1. Padel set winner helper: 1 = local, 2 = visitante, NULL = invalid/empty
CREATE OR REPLACE FUNCTION public.padel_set_winner(a integer, b integer)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN a IS NULL OR b IS NULL OR a = b THEN NULL
    WHEN greatest(a,b) = 6 AND least(a,b) <= 4 THEN CASE WHEN a > b THEN 1 ELSE 2 END
    WHEN greatest(a,b) = 7 AND least(a,b) IN (5,6) THEN CASE WHEN a > b THEN 1 ELSE 2 END
    ELSE NULL
  END
$$;

-- 2. Participation history (derived, never edited by hand)
CREATE TABLE public.match_participations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  pista integer,
  jugado boolean NOT NULL DEFAULT false,
  ganado boolean,
  event_ganado boolean,
  fecha timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

GRANT SELECT ON public.match_participations TO authenticated;
GRANT ALL ON public.match_participations TO service_role;

ALTER TABLE public.match_participations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view participations"
ON public.match_participations FOR SELECT TO authenticated
USING (public.is_team_member(team_id, auth.uid()));

CREATE INDEX idx_match_participations_user ON public.match_participations(user_id);
CREATE INDEX idx_match_participations_team ON public.match_participations(team_id);

-- 3. Recalculate an event's global result + participations
CREATE OR REPLACE FUNCTION public.recalc_event_result(_event_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ev record;
  is_padel boolean;
  r record;
  s1 integer; s2 integer; s3 integer;
  local_sets integer; visit_sets integer;
  court_winner integer;
  local_courts integer := 0;
  visit_courts integer := 0;
  played_courts integer := 0;
  team_is_local boolean;
  team_courts integer;
  rival_courts integer;
  ev_won boolean;
BEGIN
  SELECT e.id, e.team_id, e.tipo, e.es_local, e.fecha_inicio, t.deporte
    INTO ev
  FROM public.events e JOIN public.teams t ON t.id = e.team_id
  WHERE e.id = _event_id;
  IF NOT FOUND OR ev.tipo <> 'partido' THEN RETURN; END IF;

  is_padel := ev.deporte = 'padel';
  team_is_local := COALESCE(ev.es_local, true);

  FOR r IN SELECT * FROM public.match_results WHERE event_id = _event_id ORDER BY pista LOOP
    court_winner := NULL;
    IF is_padel THEN
      s1 := public.padel_set_winner(r.set1_local, r.set1_visitante);
      s2 := public.padel_set_winner(r.set2_local, r.set2_visitante);
      s3 := public.padel_set_winner(r.set3_local, r.set3_visitante);
      local_sets := (CASE WHEN s1 = 1 THEN 1 ELSE 0 END) + (CASE WHEN s2 = 1 THEN 1 ELSE 0 END) + (CASE WHEN s3 = 1 THEN 1 ELSE 0 END);
      visit_sets := (CASE WHEN s1 = 2 THEN 1 ELSE 0 END) + (CASE WHEN s2 = 2 THEN 1 ELSE 0 END) + (CASE WHEN s3 = 2 THEN 1 ELSE 0 END);
      IF local_sets >= 2 THEN court_winner := 1;
      ELSIF visit_sets >= 2 THEN court_winner := 2;
      END IF;
    ELSE
      IF r.set1_local IS NOT NULL AND r.set1_visitante IS NOT NULL AND r.set1_local <> r.set1_visitante THEN
        court_winner := CASE WHEN r.set1_local > r.set1_visitante THEN 1 ELSE 2 END;
      END IF;
    END IF;

    IF court_winner = 1 THEN local_courts := local_courts + 1; played_courts := played_courts + 1;
    ELSIF court_winner = 2 THEN visit_courts := visit_courts + 1; played_courts := played_courts + 1;
    END IF;
  END LOOP;

  UPDATE public.events
     SET resultado_local = CASE WHEN played_courts = 0 THEN NULL ELSE local_courts END,
         resultado_visitante = CASE WHEN played_courts = 0 THEN NULL ELSE visit_courts END,
         updated_at = now()
   WHERE id = _event_id;

  team_courts := CASE WHEN team_is_local THEN local_courts ELSE visit_courts END;
  rival_courts := CASE WHEN team_is_local THEN visit_courts ELSE local_courts END;
  ev_won := CASE WHEN played_courts = 0 THEN NULL ELSE team_courts > rival_courts END;

  DELETE FROM public.match_participations WHERE event_id = _event_id;

  INSERT INTO public.match_participations (event_id, team_id, user_id, pista, jugado, ganado, event_ganado, fecha)
  SELECT _event_id, ev.team_id, resp.user_id, resp.padel_pista,
         played_courts > 0,
         CASE WHEN played_courts = 0 THEN NULL ELSE ev_won END,
         ev_won,
         ev.fecha_inicio
  FROM public.event_responses resp
  WHERE resp.event_id = _event_id
    AND resp.es_convocado = true
    AND (NOT is_padel OR resp.padel_pista IS NOT NULL);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.recalc_event_result(uuid) FROM anon, authenticated;

-- 4. Triggers keeping everything in sync
CREATE OR REPLACE FUNCTION public.trg_recalc_from_match_results()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recalc_event_result(COALESCE(NEW.event_id, OLD.event_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER match_results_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.match_results
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_from_match_results();

CREATE OR REPLACE FUNCTION public.trg_recalc_from_responses()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recalc_event_result(COALESCE(NEW.event_id, OLD.event_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER event_responses_recalc
AFTER INSERT OR UPDATE OF es_convocado, padel_pista OR DELETE ON public.event_responses
FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_from_responses();

-- 5. Derived statistics views
CREATE OR REPLACE VIEW public.player_match_stats
WITH (security_invoker = on) AS
SELECT
  p.user_id,
  p.team_id,
  count(*)::int AS convocado,
  count(*) FILTER (WHERE p.jugado)::int AS disputados,
  count(*) FILTER (WHERE p.ganado IS TRUE)::int AS victorias,
  count(*) FILTER (WHERE p.ganado IS FALSE)::int AS derrotas,
  CASE WHEN count(*) FILTER (WHERE p.jugado) = 0 THEN 0
       ELSE round(100.0 * count(*) FILTER (WHERE p.ganado IS TRUE) / count(*) FILTER (WHERE p.jugado))::int
  END AS win_pct,
  max(p.fecha) AS ultima_convocatoria,
  max(p.fecha) FILTER (WHERE p.jugado) AS ultimo_partido
FROM public.match_participations p
GROUP BY p.user_id, p.team_id;

GRANT SELECT ON public.player_match_stats TO authenticated;

CREATE OR REPLACE VIEW public.team_match_stats
WITH (security_invoker = on) AS
WITH played AS (
  SELECT e.team_id, e.id, e.fecha_inicio,
         CASE WHEN COALESCE(e.es_local, true) THEN e.resultado_local ELSE e.resultado_visitante END AS pistas_ganadas,
         CASE WHEN COALESCE(e.es_local, true) THEN e.resultado_visitante ELSE e.resultado_local END AS pistas_perdidas
  FROM public.events e
  WHERE e.tipo = 'partido' AND e.resultado_local IS NOT NULL AND e.resultado_visitante IS NOT NULL
),
flagged AS (
  SELECT team_id, id, fecha_inicio, pistas_ganadas, pistas_perdidas,
         (pistas_ganadas > pistas_perdidas) AS ganado
  FROM played
),
streaks AS (
  SELECT team_id,
         (array_agg(ganado ORDER BY fecha_inicio DESC))[1] AS last_won,
         array_agg(ganado ORDER BY fecha_inicio DESC) AS seq
  FROM flagged GROUP BY team_id
)
SELECT
  f.team_id,
  count(*)::int AS jugados,
  count(*) FILTER (WHERE f.ganado)::int AS ganados,
  count(*) FILTER (WHERE NOT f.ganado)::int AS perdidos,
  round(100.0 * count(*) FILTER (WHERE f.ganado) / count(*))::int AS win_pct,
  sum(f.pistas_ganadas)::int AS pistas_ganadas,
  sum(f.pistas_perdidas)::int AS pistas_perdidas,
  (sum(f.pistas_ganadas) - sum(f.pistas_perdidas))::int AS diferencia_pistas,
  s.last_won AS racha_victorias,
  (SELECT count(*) FROM unnest(s.seq) WITH ORDINALITY AS u(v, ord)
    WHERE u.ord <= COALESCE((SELECT min(ord2) - 1 FROM unnest(s.seq) WITH ORDINALITY AS z(v2, ord2) WHERE z.v2 IS DISTINCT FROM s.last_won), array_length(s.seq, 1))
  )::int AS racha
FROM flagged f
JOIN streaks s ON s.team_id = f.team_id
GROUP BY f.team_id, s.last_won, s.seq;

GRANT SELECT ON public.team_match_stats TO authenticated;