ALTER TABLE public.official_competitions
  ADD COLUMN IF NOT EXISTS reglas text,
  ADD COLUMN IF NOT EXISTS inscripciones_abiertas boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS temporada_actual text;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS registration_id uuid REFERENCES public.competition_registrations(id) ON DELETE SET NULL;

CREATE POLICY "Admins manage official competitions"
  ON public.official_competitions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage official categories"
  ON public.official_competition_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage official divisions"
  ON public.official_competition_divisions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.official_competitions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.official_competition_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.official_competition_divisions TO authenticated;
GRANT ALL ON public.official_competitions TO service_role;
GRANT ALL ON public.official_competition_categories TO service_role;
GRANT ALL ON public.official_competition_divisions TO service_role;