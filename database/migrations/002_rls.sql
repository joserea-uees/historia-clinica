ALTER TABLE "membresia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "membresia" FORCE ROW LEVEL SECURITY;

CREATE POLICY "pol_membresia_por_organizacion"
  ON "membresia"
  USING ("idOrganizacion" = NULLIF(current_setting('app.idOrganizacion', true), '')::uuid)
  WITH CHECK ("idOrganizacion" = NULLIF(current_setting('app.idOrganizacion', true), '')::uuid);

ALTER TABLE "persona" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "persona" FORCE ROW LEVEL SECURITY;

CREATE POLICY "pol_persona_por_organizacion"
  ON "persona"
  USING ("idOrganizacion" = NULLIF(current_setting('app.idOrganizacion', true), '')::uuid)
  WITH CHECK ("idOrganizacion" = NULLIF(current_setting('app.idOrganizacion', true), '')::uuid);
