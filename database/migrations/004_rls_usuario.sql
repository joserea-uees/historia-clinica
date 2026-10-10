DROP POLICY "pol_membresia_por_organizacion" ON "membresia";
CREATE POLICY "pol_membresia_por_usuario_y_organizacion"
  ON "membresia"
  USING (
    "idUsuario" = NULLIF(current_setting('app.idUsuario', true), '')::uuid
    AND (
      NULLIF(current_setting('app.idOrganizacion', true), '') IS NULL
      OR "idOrganizacion" = NULLIF(current_setting('app.idOrganizacion', true), '')::uuid
    )
  )
  WITH CHECK (
    "idUsuario" = NULLIF(current_setting('app.idUsuario', true), '')::uuid
    AND (
      NULLIF(current_setting('app.idOrganizacion', true), '') IS NULL
      OR "idOrganizacion" = NULLIF(current_setting('app.idOrganizacion', true), '')::uuid
    )
  );

DROP POLICY "pol_persona_por_organizacion" ON "persona";
CREATE POLICY "pol_persona_por_membresia_usuario"
  ON "persona"
  USING (
    "idOrganizacion" = NULLIF(current_setting('app.idOrganizacion', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM "membresia" m
      WHERE m."idOrganizacion" = "persona"."idOrganizacion"
        AND m."idUsuario" = NULLIF(current_setting('app.idUsuario', true), '')::uuid
        AND m."activa" = true
    )
  )
  WITH CHECK (
    "idOrganizacion" = NULLIF(current_setting('app.idOrganizacion', true), '')::uuid
    AND EXISTS (
      SELECT 1 FROM "membresia" m
      WHERE m."idOrganizacion" = "persona"."idOrganizacion"
        AND m."idUsuario" = NULLIF(current_setting('app.idUsuario', true), '')::uuid
        AND m."activa" = true
    )
  );

ALTER TABLE "organizacion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizacion" FORCE ROW LEVEL SECURITY;
CREATE POLICY "pol_organizacion_por_membresia"
  ON "organizacion"
  USING (
    EXISTS (
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
