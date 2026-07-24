
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reminder_hours integer[] NOT NULL DEFAULT ARRAY[24]::integer[];

CREATE TABLE IF NOT EXISTS public.event_reminders_sent (
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hours_before integer NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id, hours_before)
);

GRANT SELECT ON public.event_reminders_sent TO authenticated;
GRANT ALL ON public.event_reminders_sent TO service_role;

ALTER TABLE public.event_reminders_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reminders_select_own" ON public.event_reminders_sent
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.send_event_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer := 0;
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      e.id AS event_id,
      e.titulo,
      e.tipo::text AS tipo,
      e.fecha_inicio,
      e.ubicacion,
      tm.user_id,
      h AS hours_before
    FROM public.events e
    JOIN public.team_members tm
      ON tm.team_id = e.team_id AND tm.status = 'activo'
    JOIN public.profiles p ON p.id = tm.user_id
    CROSS JOIN LATERAL unnest(p.reminder_hours) AS h
    WHERE e.tipo IN ('entrenamiento','partido')
      AND e.fecha_inicio > now()
      AND e.fecha_inicio <= now() + make_interval(hours => h)
      AND NOT EXISTS (
        SELECT 1 FROM public.event_reminders_sent s
        WHERE s.event_id = e.id AND s.user_id = tm.user_id AND s.hours_before = h
      )
  LOOP
    INSERT INTO public.notifications (user_id, tipo, titulo, cuerpo, link, data)
    VALUES (
      r.user_id,
      'event_reminder',
      'Recordatorio: ' || r.titulo,
      CASE
        WHEN r.hours_before >= 24 THEN 'En ' || (r.hours_before / 24) || 'd'
        ELSE 'En ' || r.hours_before || 'h'
      END
      || COALESCE(' · ' || r.ubicacion, '')
      || ' · ' || to_char(r.fecha_inicio AT TIME ZONE 'Europe/Madrid', 'DD/MM HH24:MI'),
      '/eventos/' || r.event_id::text,
      jsonb_build_object('event_id', r.event_id, 'tipo', r.tipo, 'hours_before', r.hours_before)
    );
    INSERT INTO public.event_reminders_sent (event_id, user_id, hours_before)
    VALUES (r.event_id, r.user_id, r.hours_before);
    inserted_count := inserted_count + 1;
  END LOOP;
  RETURN inserted_count;
END;
$$;

CREATE EXTENSION IF NOT EXISTS pg_cron;
