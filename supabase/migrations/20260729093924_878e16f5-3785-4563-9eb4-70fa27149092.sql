
CREATE TABLE public.official_competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  nombre text NOT NULL,
  descripcion text,
  activa boolean NOT NULL DEFAULT true,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.official_competitions TO authenticated;
GRANT ALL ON public.official_competitions TO service_role;
ALTER TABLE public.official_competitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "official competitions readable" ON public.official_competitions
  FOR SELECT TO authenticated USING (true);

CREATE TABLE public.official_competition_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.official_competitions(id) ON DELETE CASCADE,
  code text NOT NULL,
  nombre text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, code)
);
GRANT SELECT ON public.official_competition_categories TO authenticated;
GRANT ALL ON public.official_competition_categories TO service_role;
ALTER TABLE public.official_competition_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "official categories readable" ON public.official_competition_categories
  FOR SELECT TO authenticated USING (true);

CREATE TABLE public.official_competition_divisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.official_competitions(id) ON DELETE CASCADE,
  code text NOT NULL,
  nombre text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, code)
);
GRANT SELECT ON public.official_competition_divisions TO authenticated;
GRANT ALL ON public.official_competition_divisions TO service_role;
ALTER TABLE public.official_competition_divisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "official divisions readable" ON public.official_competition_divisions
  FOR SELECT TO authenticated USING (true);

CREATE TYPE public.registration_status AS ENUM ('abierta', 'activa', 'cerrada', 'rechazada');

CREATE TABLE public.competition_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.official_competitions(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.official_competition_categories(id) ON DELETE RESTRICT,
  division_id uuid NOT NULL REFERENCES public.official_competition_divisions(id) ON DELETE RESTRICT,
  temporada text,
  status public.registration_status NOT NULL DEFAULT 'abierta',
  registered_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, team_id, temporada)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competition_registrations TO authenticated;
GRANT ALL ON public.competition_registrations TO service_role;
ALTER TABLE public.competition_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "registrations readable" ON public.competition_registrations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "managers insert registrations" ON public.competition_registrations
  FOR INSERT TO authenticated WITH CHECK (public.is_team_manager(team_id, auth.uid()));
CREATE POLICY "managers update registrations" ON public.competition_registrations
  FOR UPDATE TO authenticated USING (public.is_team_manager(team_id, auth.uid()))
  WITH CHECK (public.is_team_manager(team_id, auth.uid()));
CREATE POLICY "managers delete registrations" ON public.competition_registrations
  FOR DELETE TO authenticated USING (public.is_team_manager(team_id, auth.uid()));

CREATE TRIGGER set_official_competitions_updated_at BEFORE UPDATE ON public.official_competitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_competition_registrations_updated_at BEFORE UPDATE ON public.competition_registrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.official_competitions (code, nombre, descripcion, orden)
VALUES ('SNP', 'SNP', 'Circuito SNP', 1);

INSERT INTO public.official_competition_categories (competition_id, code, nombre, orden)
SELECT id, v.code, v.nombre, v.orden
FROM public.official_competitions c,
  (VALUES ('future','Future',1), ('500','500',2), ('1000','1000',3), ('grand_slam','Grand Slam',4)) AS v(code, nombre, orden)
WHERE c.code = 'SNP';

INSERT INTO public.official_competition_divisions (competition_id, code, nombre, orden)
SELECT id, v.code, v.nombre, v.orden
FROM public.official_competitions c,
  (VALUES ('div1','División 1',1), ('div2','División 2',2), ('div3','División 3',3), ('div4','División 4',4), ('div5','División 5',5)) AS v(code, nombre, orden)
WHERE c.code = 'SNP';
