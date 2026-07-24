
ALTER TABLE public.chat_channels ADD COLUMN IF NOT EXISTS invite_token text UNIQUE;

CREATE OR REPLACE FUNCTION public.join_channel_by_token(_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _channel_id uuid;
  _team_id uuid;
  _scope text;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  SELECT id, team_id, scope::text INTO _channel_id, _team_id, _scope
    FROM public.chat_channels WHERE invite_token = _token;
  IF _channel_id IS NULL THEN
    RAISE EXCEPTION 'invalid_token';
  END IF;
  IF NOT public.is_team_member(_team_id, _uid) THEN
    RAISE EXCEPTION 'not_team_member';
  END IF;
  IF _scope = 'custom' THEN
    INSERT INTO public.chat_channel_members (channel_id, user_id)
    VALUES (_channel_id, _uid)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN _channel_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_channel_by_token(text) TO authenticated;
