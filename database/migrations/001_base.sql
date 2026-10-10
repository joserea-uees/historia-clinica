CREATE TABLE "organizacion" (
  "idOrganizacion" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "nombre" varchar(160) NOT NULL,
  "fechaCreacion" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "usuario" (
  "idUsuario" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "correo" varchar(254) NOT NULL UNIQUE,
  "hashClave" text NOT NULL,
  "activo" boolean NOT NULL DEFAULT true,
  "fechaCreacion" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "membresia" (
  "idMembresia" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "idOrganizacion" uuid NOT NULL REFERENCES "organizacion" ("idOrganizacion"),
  "idUsuario" uuid NOT NULL REFERENCES "usuario" ("idUsuario"),
  "rol" varchar(32) NOT NULL CHECK ("rol" IN ('medico', 'asistente', 'administrador')),
  "activa" boolean NOT NULL DEFAULT true,
  "fechaCreacion" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("idOrganizacion", "idUsuario")
);

CREATE TABLE "persona" (
  "idPersona" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "idOrganizacion" uuid NOT NULL REFERENCES "organizacion" ("idOrganizacion"),
  "tipoIdentificacion" varchar(24),
  "numeroIdentificacion" varchar(32),
  "nombres" varchar(160) NOT NULL,
  "apellidos" varchar(160) NOT NULL,
  "fechaNacimiento" date,
  "sexoBiologico" varchar(32),
  "telefono" varchar(32),
  "correo" varchar(254),
  "fechaCreacion" timestamptz NOT NULL DEFAULT now(),
  "fechaActualizacion" timestamptz NOT NULL DEFAULT now(),
  CHECK (
    ("tipoIdentificacion" IS NULL AND "numeroIdentificacion" IS NULL)
    OR ("tipoIdentificacion" IS NOT NULL AND "numeroIdentificacion" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "uq_persona_identificacion_organizacion"
  ON "persona" ("idOrganizacion", "tipoIdentificacion", "numeroIdentificacion")
  WHERE "numeroIdentificacion" IS NOT NULL;

CREATE INDEX "ix_persona_busqueda_nombre"
  ON "persona" ("idOrganizacion", lower("apellidos"), lower("nombres"));

CREATE INDEX "ix_membresia_usuario_organizacion"
  ON "membresia" ("idUsuario", "idOrganizacion")
  WHERE "activa" = true;

GRANT SELECT, INSERT, UPDATE, DELETE ON "organizacion", "usuario", "membresia", "persona" TO app_runtime;
GRANT SELECT ON "migracionAplicada" TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON "organizacion", "usuario", "membresia", "persona" TO app_migrator;
GRANT SELECT, INSERT, UPDATE, DELETE ON "migracionAplicada" TO app_migrator;
