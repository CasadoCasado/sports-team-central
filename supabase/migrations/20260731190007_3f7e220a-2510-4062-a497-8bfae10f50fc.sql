CREATE OR REPLACE FUNCTION public.validate_event_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reg RECORD;
BEGIN
  IF NEW.registration_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT team_id, status INTO reg
    FROM public.competition_registrations
   WHERE id = NEW.registration_id;

  IF reg IS NULL THEN
    RAISE EXCEPTION 'invalid_registration';
  END IF;

  IF reg.team_id <> NEW.team_id THEN
    RAISE EXCEPTION 'registration_team_mismatch';
  END IF;

  IF reg.status NOT IN ('abierta', 'activa') THEN
    RAISE EXCEPTION 'registration_not_active';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_event_registration_trg ON public.events;
CREATE TRIGGER validate_event_registration_trg
BEFORE INSERT OR UPDATE OF registration_id, team_id ON public.events
FOR EACH ROW EXECUTE FUNCTION public.validate_event_registration();

REVOKE EXECUTE ON FUNCTION public.validate_event_registration() FROM PUBLIC, anon, authenticated;