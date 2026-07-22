
ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.team_invitations
  ADD CONSTRAINT team_invitations_invited_user_id_profiles_fkey
  FOREIGN KEY (invited_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.team_invitations
  ADD CONSTRAINT team_invitations_invited_by_profiles_fkey
  FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE CASCADE;
