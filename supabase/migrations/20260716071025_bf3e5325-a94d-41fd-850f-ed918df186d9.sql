CREATE OR REPLACE FUNCTION public.is_team_manager(_team_id uuid, _user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.teams WHERE id = _team_id AND owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id AND user_id = _user_id
      AND status = 'activo' AND role IN ('capitan', 'co_capitan', 'entrenador', 'delegado')
  );
$function$;