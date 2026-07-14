
-- Add team_invitations to realtime so managers see requests instantly
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_invitations;

-- Trigger: notify team managers when a join request is submitted
CREATE OR REPLACE FUNCTION public.notify_join_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  team_name TEXT;
  requester_name TEXT;
  mgr RECORD;
BEGIN
  IF NEW.es_solicitud = true AND NEW.status = 'pendiente' THEN
    SELECT nombre INTO team_name FROM public.teams WHERE id = NEW.team_id;
    SELECT COALESCE(NULLIF(TRIM(CONCAT(nombre,' ',apellidos)), ''), email)
      INTO requester_name FROM public.profiles WHERE id = NEW.invited_user_id;

    FOR mgr IN
      SELECT DISTINCT user_id FROM (
        SELECT owner_id AS user_id FROM public.teams WHERE id = NEW.team_id
        UNION
        SELECT user_id FROM public.team_members
         WHERE team_id = NEW.team_id AND status = 'activo'
           AND role IN ('capitan','entrenador','delegado')
      ) m
    LOOP
      INSERT INTO public.notifications (user_id, tipo, titulo, cuerpo, read)
      VALUES (
        mgr.user_id,
        'join_request',
        'Nueva solicitud de unión',
        COALESCE(requester_name,'Un usuario') || ' quiere unirse a ' || COALESCE(team_name,'tu equipo'),
        false
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_join_request ON public.team_invitations;
CREATE TRIGGER trg_notify_join_request
AFTER INSERT ON public.team_invitations
FOR EACH ROW EXECUTE FUNCTION public.notify_join_request();
