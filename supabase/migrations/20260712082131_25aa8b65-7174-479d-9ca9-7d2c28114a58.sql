
-- Chat channels and messages
CREATE TYPE public.channel_scope AS ENUM ('general','staff','custom');

CREATE TABLE public.chat_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  scope public.channel_scope NOT NULL DEFAULT 'custom',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX chat_channels_team_scope_unique ON public.chat_channels(team_id, scope) WHERE scope IN ('general','staff');
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_channels TO authenticated;
GRANT ALL ON public.chat_channels TO service_role;
ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "channels visible to team members"
  ON public.chat_channels FOR SELECT TO authenticated
  USING (
    public.is_team_member(team_id, auth.uid())
    AND (scope <> 'staff' OR public.is_team_manager(team_id, auth.uid()))
  );
CREATE POLICY "managers create channels"
  ON public.chat_channels FOR INSERT TO authenticated
  WITH CHECK (public.is_team_manager(team_id, auth.uid()));
CREATE POLICY "managers update channels"
  ON public.chat_channels FOR UPDATE TO authenticated
  USING (public.is_team_manager(team_id, auth.uid()))
  WITH CHECK (public.is_team_manager(team_id, auth.uid()));
CREATE POLICY "managers delete channels"
  ON public.chat_channels FOR DELETE TO authenticated
  USING (public.is_team_manager(team_id, auth.uid()) AND scope = 'custom');

CREATE TRIGGER trg_chat_channels_updated_at
  BEFORE UPDATE ON public.chat_channels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contenido text NOT NULL,
  reply_to_id uuid REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  edited boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_channel_created_idx ON public.chat_messages(channel_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages visible if channel visible"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chat_channels c
    WHERE c.id = channel_id
      AND public.is_team_member(c.team_id, auth.uid())
      AND (c.scope <> 'staff' OR public.is_team_manager(c.team_id, auth.uid()))
  ));
CREATE POLICY "members send messages"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chat_channels c
      WHERE c.id = channel_id
        AND public.is_team_member(c.team_id, auth.uid())
        AND (c.scope <> 'staff' OR public.is_team_manager(c.team_id, auth.uid()))
    )
  );
CREATE POLICY "authors edit own messages"
  ON public.chat_messages FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "authors or managers delete"
  ON public.chat_messages FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.chat_channels c WHERE c.id = channel_id AND public.is_team_manager(c.team_id, auth.uid()))
  );

CREATE TRIGGER trg_chat_messages_updated_at
  BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Auto-create General channel on team creation
CREATE OR REPLACE FUNCTION public.create_default_channels()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.chat_channels (team_id, nombre, scope, created_by)
  VALUES (NEW.id, 'General', 'general', NEW.owner_id),
         (NEW.id, 'Staff', 'staff', NEW.owner_id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_teams_default_channels
  AFTER INSERT ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.create_default_channels();

-- Backfill for existing teams
INSERT INTO public.chat_channels (team_id, nombre, scope, created_by)
SELECT t.id, 'General', 'general', t.owner_id FROM public.teams t
WHERE NOT EXISTS (SELECT 1 FROM public.chat_channels c WHERE c.team_id = t.id AND c.scope = 'general');
INSERT INTO public.chat_channels (team_id, nombre, scope, created_by)
SELECT t.id, 'Staff', 'staff', t.owner_id FROM public.teams t
WHERE NOT EXISTS (SELECT 1 FROM public.chat_channels c WHERE c.team_id = t.id AND c.scope = 'staff');
