-- ==== ENUMS ====
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.team_role AS ENUM ('capitan', 'entrenador', 'delegado', 'jugador');
CREATE TYPE public.member_status AS ENUM ('pendiente', 'activo', 'expulsado');
CREATE TYPE public.invitation_status AS ENUM ('pendiente', 'aceptada', 'rechazada');
CREATE TYPE public.preferred_role AS ENUM ('capitan', 'jugador');

-- ==== PROFILES ====
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL DEFAULT '',
  apellidos TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  telefono TEXT,
  avatar_url TEXT,
  ciudad TEXT,
  posicion TEXT,
  mano_dominante TEXT,
  nivel TEXT,
  descripcion TEXT,
  fecha_nacimiento DATE,
  idioma TEXT NOT NULL DEFAULT 'es',
  preferred_role public.preferred_role,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own_or_authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ==== USER ROLES ====
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_roles_select_own" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- ==== TEAMS ====
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  logo_url TEXT,
  descripcion TEXT,
  deporte TEXT,
  categoria TEXT,
  ciudad TEXT,
  color_primario TEXT,
  color_secundario TEXT,
  instalacion TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- ==== TEAM MEMBERS ====
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.team_role NOT NULL DEFAULT 'jugador',
  status public.member_status NOT NULL DEFAULT 'activo',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Helper functions to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.is_team_member(_team_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id AND user_id = _user_id AND status = 'activo'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_manager(_team_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams WHERE id = _team_id AND owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id AND user_id = _user_id
      AND status = 'activo' AND role IN ('capitan', 'entrenador', 'delegado')
  );
$$;

-- TEAMS policies
CREATE POLICY "teams_select_members" ON public.teams
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_team_member(id, auth.uid()));
CREATE POLICY "teams_insert_own" ON public.teams
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "teams_update_manager" ON public.teams
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_team_manager(id, auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_team_manager(id, auth.uid()));
CREATE POLICY "teams_delete_owner" ON public.teams
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- TEAM MEMBERS policies
CREATE POLICY "members_select_team" ON public.team_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_team_member(team_id, auth.uid()) OR public.is_team_manager(team_id, auth.uid()));
CREATE POLICY "members_insert_manager_or_self" ON public.team_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_team_manager(team_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "members_update_manager" ON public.team_members
  FOR UPDATE TO authenticated
  USING (public.is_team_manager(team_id, auth.uid()) OR user_id = auth.uid())
  WITH CHECK (public.is_team_manager(team_id, auth.uid()) OR user_id = auth.uid());
CREATE POLICY "members_delete_manager" ON public.team_members
  FOR DELETE TO authenticated
  USING (public.is_team_manager(team_id, auth.uid()) OR user_id = auth.uid());

-- Auto-add owner as capitan member on team creation
CREATE OR REPLACE FUNCTION public.add_owner_as_capitan()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.team_members (team_id, user_id, role, status)
  VALUES (NEW.id, NEW.owner_id, 'capitan', 'activo')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_add_owner_as_capitan
  AFTER INSERT ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.add_owner_as_capitan();

-- ==== TEAM INVITATIONS ====
CREATE TABLE public.team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  invited_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.team_role NOT NULL DEFAULT 'jugador',
  status public.invitation_status NOT NULL DEFAULT 'pendiente',
  mensaje TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  UNIQUE (team_id, invited_user_id, status)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_invitations TO authenticated;
GRANT ALL ON public.team_invitations TO service_role;
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invitations_select_relevant" ON public.team_invitations
  FOR SELECT TO authenticated
  USING (invited_user_id = auth.uid() OR invited_by = auth.uid() OR public.is_team_manager(team_id, auth.uid()));
CREATE POLICY "invitations_insert_manager" ON public.team_invitations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_team_manager(team_id, auth.uid()) AND invited_by = auth.uid());
CREATE POLICY "invitations_update_relevant" ON public.team_invitations
  FOR UPDATE TO authenticated
  USING (invited_user_id = auth.uid() OR public.is_team_manager(team_id, auth.uid()))
  WITH CHECK (invited_user_id = auth.uid() OR public.is_team_manager(team_id, auth.uid()));
CREATE POLICY "invitations_delete_manager" ON public.team_invitations
  FOR DELETE TO authenticated
  USING (invited_by = auth.uid() OR public.is_team_manager(team_id, auth.uid()));

-- ==== NOTIFICATIONS ====
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  cuerpo TEXT,
  link TEXT,
  data JSONB,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notifications_insert_any" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notifications_delete_own" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ==== HANDLE NEW USER ====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nombre, apellidos)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'apellidos', NEW.raw_user_meta_data->>'last_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==== UPDATED_AT TRIGGERS ====
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_teams_updated BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();