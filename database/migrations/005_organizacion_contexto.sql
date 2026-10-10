DROP POLICY "pol_organizacion_por_membresia" ON "organizacion";
CREATE POLICY "pol_organizacion_por_membresia"
  ON "organizacion"
  USING (
    (
      NULLIF(current_setting('app.idOrganizacion', true), '') IS NULL
      OR "idOrganizacion" = NULLIF(current_setting('app.idOrganizacion', true), '')::uuid
    )
    AND EXISTS (
      SELECT 1 FROM "membresia" m
      WHERE m."idOrganizacion" = "organizacion"."idOrganizacion"
        AND m."idUsuario" = NULLIF(current_setting('app.idUsuario', true), '')::uuid
        AND m."activa" = true
    )
  )
  WITH CHECK (
    NULLIF(current_setting('app.idUsuario', true), '') IS NULL
    AND NOT EXISTS (SELECT 1 FROM "usuario")
  );
