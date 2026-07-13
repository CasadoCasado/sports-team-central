
-- Files stored under path: <team_id>/<uuid>-<filename>
-- Gallery: any active team member can read/insert; owner or manager can delete
CREATE POLICY "gallery read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'team-gallery'
  AND public.is_team_member((storage.foldername(name))[1]::uuid, auth.uid())
);
CREATE POLICY "gallery upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'team-gallery'
  AND public.is_team_member((storage.foldername(name))[1]::uuid, auth.uid())
  AND owner = auth.uid()
);
CREATE POLICY "gallery delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'team-gallery'
  AND (owner = auth.uid() OR public.is_team_manager((storage.foldername(name))[1]::uuid, auth.uid()))
);

-- Documents: any active member reads; only managers upload/delete
CREATE POLICY "docs read" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'team-documents'
  AND public.is_team_member((storage.foldername(name))[1]::uuid, auth.uid())
);
CREATE POLICY "docs upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'team-documents'
  AND public.is_team_manager((storage.foldername(name))[1]::uuid, auth.uid())
  AND owner = auth.uid()
);
CREATE POLICY "docs delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'team-documents'
  AND public.is_team_manager((storage.foldername(name))[1]::uuid, auth.uid())
);
