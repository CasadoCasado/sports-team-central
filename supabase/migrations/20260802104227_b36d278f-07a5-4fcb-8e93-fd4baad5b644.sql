CREATE OR REPLACE FUNCTION public.validate_match_result_scores()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ev_deporte TEXT;
BEGIN
  SELECT t.deporte INTO ev_deporte
  FROM public.events e
  JOIN public.teams t ON t.id = e.team_id
  WHERE e.id = NEW.event_id;

  IF ev_deporte = 'padel' THEN
    IF COALESCE(NEW.set1_local, 0) > 7 OR COALESCE(NEW.set1_visitante, 0) > 7
       OR COALESCE(NEW.set2_local, 0) > 7 OR COALESCE(NEW.set2_visitante, 0) > 7
       OR COALESCE(NEW.set3_local, 0) > 7 OR COALESCE(NEW.set3_visitante, 0) > 7
    THEN
      RAISE EXCEPTION 'padel_set_max_7';
    END IF;

    IF (NEW.set1_local IS NOT NULL AND NEW.set1_local < 0)
       OR (NEW.set1_visitante IS NOT NULL AND NEW.set1_visitante < 0)
       OR (NEW.set2_local IS NOT NULL AND NEW.set2_local < 0)
       OR (NEW.set2_visitante IS NOT NULL AND NEW.set2_visitante < 0)
       OR (NEW.set3_local IS NOT NULL AND NEW.set3_local < 0)
       OR (NEW.set3_visitante IS NOT NULL AND NEW.set3_visitante < 0)
    THEN
      RAISE EXCEPTION 'negative_set_score';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_match_result_scores ON public.match_results;
CREATE TRIGGER trg_validate_match_result_scores
BEFORE INSERT OR UPDATE ON public.match_results
FOR EACH ROW
EXECUTE FUNCTION public.validate_match_result_scores();