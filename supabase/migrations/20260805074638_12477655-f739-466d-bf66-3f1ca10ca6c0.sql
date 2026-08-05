CREATE OR REPLACE FUNCTION public.validate_team_sport()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.deporte IS NULL OR NEW.deporte = '' THEN
    NEW.deporte := 'padel';
  END IF;
  IF NEW.deporte <> 'padel' THEN
    RAISE EXCEPTION 'sport_not_allowed: only padel teams are supported'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_team_sport ON public.teams;
CREATE TRIGGER trg_validate_team_sport
BEFORE INSERT OR UPDATE OF deporte ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.validate_team_sport();