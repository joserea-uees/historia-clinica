import { Pool } from 'pg';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';

async function bootstrapAdmin(): Promise<void> {
  const connectionString = process.env.DATABASE_MIGRATION_URL;
  const emailInput = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  const organizationName = process.env.BOOTSTRAP_ORGANIZATION_NAME ?? 'Consultorio principal';

  if (!connectionString || !emailInput || !password) {
    throw new Error('Define DATABASE_MIGRATION_URL, BOOTSTRAP_ADMIN_EMAIL y BOOTSTRAP_ADMIN_PASSWORD.');
  }
  const email = emailInput.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL no tiene un formato válido.');
  }
  if (password.length < 14 || password.length > 128) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD debe tener entre 14 y 128 caracteres.');
  }
  if (!organizationName.trim() || organizationName.length > 160) {
    throw new Error('BOOTSTRAP_ORGANIZATION_NAME debe tener entre 1 y 160 caracteres.');
  }

  const pool = new Pool({ connectionString, application_name: 'historia-clinica-bootstrap-admin' });
  try {
    const role = await pool.query<{ current_user: string }>('SELECT current_user');
    if (role.rows[0]?.current_user !== 'app_migrator') {
      throw new Error('El bootstrap debe ejecutarse con el rol app_migrator.');
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT pg_advisory_xact_lock(hashtext('historia-clinica-bootstrap-admin'))");
      const existing = await client.query<{ total: string }>('SELECT count(*)::text AS total FROM "usuario"');
      if (existing.rows[0]?.total !== '0') {
        throw new Error('El bootstrap se permite únicamente cuando no existen usuarios.');
      }

      const idOrganizacion = randomUUID();
      await client.query(
        'INSERT INTO "organizacion" ("idOrganizacion", "nombre") VALUES ($1, $2)',
        [idOrganizacion, organizationName.trim()],
      );
      const user = await client.query<{ idUsuario: string }>(
        `INSERT INTO "usuario" ("correo", "hashClave") VALUES ($1, $2)
         RETURNING "idUsuario"`,
        [email, await argon2.hash(password, {
          type: argon2.argon2id,
          memoryCost: 19_456,
          timeCost: 2,
          parallelism: 1,
        })],
      );
      await client.query("SELECT set_config('app.idUsuario', $1, true)", [user.rows[0].idUsuario]);
      await client.query("SELECT set_config('app.idOrganizacion', $1, true)", [idOrganizacion]);
      await client.query(
        `INSERT INTO "membresia" ("idOrganizacion", "idUsuario", "rol")
         VALUES ($1, $2, 'administrador')`,
        [idOrganizacion, user.rows[0].idUsuario],
      );
      await client.query('COMMIT');
      process.stdout.write(`Administrador inicial creado para ${email}. Guarda la contraseña en un gestor seguro.\n`);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

bootstrapAdmin().catch((error: unknown) => {
  process.stderr.write(`Falló el alta inicial: ${error instanceof Error ? error.message : 'error inesperado'}\n`);
  process.exitCode = 1;
});
