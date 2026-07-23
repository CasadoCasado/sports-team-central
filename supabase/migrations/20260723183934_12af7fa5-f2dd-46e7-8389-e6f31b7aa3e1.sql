
-- 1. Members table for custom channels
CREATE TABLE public.chat_channel_members (
  channel_id UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (channel_id, user_id)
);
CREATE INDEX chat_channel_members_user_idx ON public.chat_channel_members(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_channel_members TO authenticated;
GRANT ALL ON public.chat_channel_members TO service_role;

ALTER TABLE public.chat_channel_members ENABLE ROW LEVEL SECURITY;

-- 2. Access helper (security definer, avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.can_access_channel(_channel_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_channels c
    WHERE c.id = _channel_id
      AND public.is_team_member(c.team_id, _user_id)
      AND (
        c.scope = 'general'
        OR (c.scope = 'staff' AND public.is_team_manager(c.team_id, _user_id))
        OR (c.scope = 'custom' AND (
              public.is_team_manager(c.team_id, _user_id)
              OR EXISTS (
                SELECT 1 FROM public.chat_channel_members m
                WHERE m.channel_id = c.id AND m.user_id = _user_id
              )
            ))
      )
  );
$$;

-- 3. Policies on chat_channel_members
CREATE POLICY "channel members visible to channel viewers"
  ON public.chat_channel_members FOR SELECT
  TO authenticated
  USING (public.can_access_channel(channel_id, auth.uid()));

CREATE POLICY "managers add channel members"
  ON public.chat_channel_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_channels c
      WHERE c.id = channel_id
        AND public.is_team_manager(c.team_id, auth.uid())
    )
  );

CREATE POLICY "managers remove channel members"
  ON public.chat_channel_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_channels c
      WHERE c.id = channel_id
        AND public.is_team_manager(c.team_id, auth.uid())
    )
  );

-- 4. Rewrite chat_channels SELECT policy to include custom-channel membership
DROP POLICY IF EXISTS "channels visible to team members" ON public.chat_channels;
CREATE POLICY "channels visible to team members"
  ON public.chat_channels FOR SELECT
  TO authenticated
  USING (
    is_team_member(team_id, auth.uid())
    AND (
      scope = 'general'
      OR (scope = 'staff' AND is_team_manager(team_id, auth.uid()))
      OR (scope = 'custom' AND (
            is_team_manager(team_id, auth.uid())
            OR EXISTS (
              SELECT 1 FROM public.chat_channel_members m
              WHERE m.channel_id = chat_channels.id AND m.user_id = auth.uid()
            )
          ))
    )
  );

-- 5. Rewrite chat_messages policies to respect custom-channel membership
DROP POLICY IF EXISTS "messages visible if channel visible" ON public.chat_messages;
CREATE POLICY "messages visible if channel visible"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (public.can_access_channel(channel_id, auth.uid()));

DROP POLICY IF EXISTS "members send messages" ON public.chat_messages;
CREATE POLICY "members send messages"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.can_access_channel(channel_id, auth.uid())
  );
