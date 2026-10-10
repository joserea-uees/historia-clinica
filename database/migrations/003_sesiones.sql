CREATE TABLE "sesionUsuario" (
  "hashToken" char(64) PRIMARY KEY,
  "idUsuario" uuid NOT NULL REFERENCES "usuario" ("idUsuario") ON DELETE CASCADE,
  "hashCsrf" char(64) NOT NULL,
  "idOrganizacionActiva" uuid REFERENCES "organizacion" ("idOrganizacion") ON DELETE SET NULL,
  "fechaExpiracion" timestamptz NOT NULL,
  "fechaRevocacion" timestamptz,
  "fechaCreacion" timestamptz NOT NULL DEFAULT now(),
  "ultimoAcceso" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "ix_sesionUsuario_usuario_expiracion"
  ON "sesionUsuario" ("idUsuario", "fechaExpiracion")
  WHERE "fechaRevocacion" IS NULL;

CREATE UNIQUE INDEX "uq_usuario_correo_normalizado" ON "usuario" (lower("correo"));
CREATE INDEX "ix_membresia_usuario_activa" ON "membresia" ("idUsuario", "idOrganizacion") WHERE "activa" = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON "sesionUsuario" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON "sesionUsuario" TO app_migrator;
