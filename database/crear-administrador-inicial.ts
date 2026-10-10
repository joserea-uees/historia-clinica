import { Pool } from 'pg';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';

async function crearAdministradorInicial(): Promise<void> {
  const cadenaConexion = process.env.DATABASE_MIGRATION_URL;
  const correoRecibido = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const clave = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const nombreOrganizacion = process.env.BOOTSTRAP_ORGANIZATION_NAME ?? 'Consultorio principal';

  if (!cadenaConexion || !correoRecibido || !clave) {
    throw new Error('Define DATABASE_MIGRATION_URL, BOOTSTRAP_ADMIN_EMAIL y BOOTSTRAP_ADMIN_PASSWORD.');
  }
  const correo = correoRecibido.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || correo.length > 254) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL no tiene un formato válido.');
  }
  if (clave.length < 14 || clave.length > 128) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD debe tener entre 14 y 128 caracteres.');
  }
  if (!nombreOrganizacion.trim() || nombreOrganizacion.length > 160) {
    throw new Error('BOOTSTRAP_ORGANIZATION_NAME debe tener entre 1 y 160 caracteres.');
  }

  const grupoConexiones = new Pool({
    connectionString: cadenaConexion,
    application_name: 'historia-clinica-bootstrap-admin',
  });
  try {
    const consultaRol = await grupoConexiones.query<{ usuarioActual: string }>(
      'SELECT current_user AS "usuarioActual"',
    );
    if (consultaRol.rows[0]?.usuarioActual !== 'app_migrator') {
      throw new Error('El bootstrap debe ejecutarse con el rol app_migrator.');
    }
    const cliente = await grupoConexiones.connect();
    try {
      await cliente.query('BEGIN');
      await cliente.query("SELECT pg_advisory_xact_lock(hashtext('historia-clinica-bootstrap-admin'))");
      const consultaUsuarios = await cliente.query<{ total: string }>(
        'SELECT count(*)::text AS total FROM "usuario"',
      );
      if (consultaUsuarios.rows[0]?.total !== '0') {
        throw new Error('El bootstrap se permite únicamente cuando no existen usuarios.');
      }

      const idOrganizacion = randomUUID();
      await cliente.query(
        'INSERT INTO "organizacion" ("idOrganizacion", "nombre") VALUES ($1, $2)',
        [idOrganizacion, nombreOrganizacion.trim()],
      );
      const usuario = await cliente.query<{ idUsuario: string }>(
        `INSERT INTO "usuario" ("correo", "hashClave") VALUES ($1, $2)
         RETURNING "idUsuario"`,
        [correo, await argon2.hash(clave, {
          type: argon2.argon2id,
          memoryCost: 19_456,
          timeCost: 2,
          parallelism: 1,
        })],
      );
      await cliente.query("SELECT set_config('app.idUsuario', $1, true)", [usuario.rows[0].idUsuario]);
      await cliente.query("SELECT set_config('app.idOrganizacion', $1, true)", [idOrganizacion]);
      await cliente.query(
        `INSERT INTO "membresia" ("idOrganizacion", "idUsuario", "rol")
         VALUES ($1, $2, 'administrador')`,
        [idOrganizacion, usuario.rows[0].idUsuario],
      );
      await cliente.query('COMMIT');
      process.stdout.write(`Administrador inicial creado para ${correo}. Guarda la contraseña en un gestor seguro.\n`);
    } catch (error) {
      await cliente.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      cliente.release();
    }
  } finally {
    await grupoConexiones.end();
  }
}

crearAdministradorInicial().catch((error: unknown) => {
  process.stderr.write(`Falló el alta inicial: ${error instanceof Error ? error.message : 'error inesperado'}\n`);
  process.exitCode = 1;
});
