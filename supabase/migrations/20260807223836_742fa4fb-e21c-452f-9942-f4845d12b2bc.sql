CREATE OR REPLACE FUNCTION public.notify_event_callup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  team_name TEXT;
  m RECORD;
BEGIN
  IF NEW.requiere_convocatoria IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  IF NEW.tipo NOT IN ('entrenamiento', 'partido', 'torneo') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.requiere_convocatoria, false) = true THEN
    RETURN NEW;
  END IF;

  SELECT nombre INTO team_name FROM public.teams WHERE id = NEW.team_id;

  FOR m IN
    SELECT user_id FROM public.team_members
     WHERE team_id = NEW.team_id AND status = 'activo'
       AND user_id <> NEW.created_by
  LOOP
    INSERT INTO public.notifications (user_id, tipo, titulo, cuerpo, link, data, read)
    VALUES (
      m.user_id,
      'event_callup',
      'Nueva convocatoria: ' || NEW.titulo,
      COALESCE(team_name, 'Tu equipo')
        || ' · ' || to_char(NEW.fecha_inicio AT TIME ZONE 'Europe/Madrid', 'DD/MM HH24:MI')
        || COALESCE(' · ' || NEW.ubicacion, ''),
      '/eventos/' || NEW.id::text,
      jsonb_build_object('event_id', NEW.id, 'tipo', NEW.tipo::text),
      false
    );
  END LOOP;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_event_callup() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_event_callup ON public.events;
CREATE TRIGGER trg_notify_event_callup
AFTER INSERT OR UPDATE OF requiere_convocatoria ON public.events
FOR EACH ROW EXECUTE FUNCTION public.notify_event_callup();