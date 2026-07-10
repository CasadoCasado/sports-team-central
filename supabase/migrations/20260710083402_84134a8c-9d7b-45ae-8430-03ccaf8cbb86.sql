-- team-logos: cualquier autenticado puede ver; solo owner de la ruta userId/... puede subir/editar
CREATE POLICY "team_logos_read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'team-logos');
CREATE POLICY "team_logos_insert_own" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'team-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "team_logos_update_own" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'team-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "team_logos_delete_own" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'team-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "avatars_read" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY "avatars_insert_own" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars_update_own" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "avatars_delete_own" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);