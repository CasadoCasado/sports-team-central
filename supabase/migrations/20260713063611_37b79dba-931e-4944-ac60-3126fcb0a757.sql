
-- Gallery
CREATE TABLE public.gallery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  uploader_id uuid NOT NULL,
  storage_path text NOT NULL,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gallery_items TO authenticated;
GRANT ALL ON public.gallery_items TO service_role;
ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gallery view team" ON public.gallery_items FOR SELECT TO authenticated
  USING (public.is_team_member(team_id, auth.uid()));
CREATE POLICY "gallery insert own" ON public.gallery_items FOR INSERT TO authenticated
  WITH CHECK (public.is_team_member(team_id, auth.uid()) AND uploader_id = auth.uid());
CREATE POLICY "gallery delete own or manager" ON public.gallery_items FOR DELETE TO authenticated
  USING (uploader_id = auth.uid() OR public.is_team_manager(team_id, auth.uid()));

-- Documents
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  uploader_id uuid NOT NULL,
  storage_path text NOT NULL,
  filename text NOT NULL,
  category text,
  size_bytes bigint,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docs view team" ON public.documents FOR SELECT TO authenticated
  USING (public.is_team_member(team_id, auth.uid()));
CREATE POLICY "docs insert manager" ON public.documents FOR INSERT TO authenticated
  WITH CHECK (public.is_team_manager(team_id, auth.uid()) AND uploader_id = auth.uid());
CREATE POLICY "docs delete manager" ON public.documents FOR DELETE TO authenticated
  USING (public.is_team_manager(team_id, auth.uid()));

-- Team fees (cuotas)
CREATE TABLE public.team_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  concepto text NOT NULL,
  amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_fees TO authenticated;
GRANT ALL ON public.team_fees TO service_role;
ALTER TABLE public.team_fees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fees view team" ON public.team_fees FOR SELECT TO authenticated
  USING (public.is_team_member(team_id, auth.uid()));
CREATE POLICY "fees manage manager" ON public.team_fees FOR ALL TO authenticated
  USING (public.is_team_manager(team_id, auth.uid()))
  WITH CHECK (public.is_team_manager(team_id, auth.uid()));
CREATE TRIGGER team_fees_updated BEFORE UPDATE ON public.team_fees
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.fee_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_id uuid NOT NULL REFERENCES public.team_fees(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pendiente',
  paid_at timestamptz,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fee_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_payments TO authenticated;
GRANT ALL ON public.fee_payments TO service_role;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fee_pay view team" ON public.fee_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_fees f WHERE f.id = fee_id AND public.is_team_member(f.team_id, auth.uid())));
CREATE POLICY "fee_pay manage manager" ON public.fee_payments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.team_fees f WHERE f.id = fee_id AND public.is_team_manager(f.team_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.team_fees f WHERE f.id = fee_id AND public.is_team_manager(f.team_id, auth.uid())));
CREATE POLICY "fee_pay update own" ON public.fee_payments FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER fee_payments_updated BEFORE UPDATE ON public.fee_payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
