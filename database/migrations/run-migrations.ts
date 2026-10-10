import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';

async function runMigrations(): Promise<void> {
  const connectionString = process.env.DATABASE_MIGRATION_URL;
  if (!connectionString) {
    throw new Error('DATABASE_MIGRATION_URL es obligatorio para ejecutar migraciones.');
  }

  const pool = new Pool({ connectionString, application_name: 'historia-clinica-migrator' });
  try {
    const roleResult = await pool.query<{ current_user: string }>('SELECT current_user');
    if (roleResult.rows[0]?.current_user !== 'app_migrator') {
      throw new Error('Las migraciones deben ejecutarse con el rol app_migrator.');
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS "migracionAplicada" (
        "nombreArchivo" varchar(200) PRIMARY KEY,
        "fechaAplicacion" timestamptz NOT NULL DEFAULT now()
      )
    `);

    const migrationDirectory = join(process.cwd(), 'database', 'migrations');
    const files = (await readdir(migrationDirectory))
      .filter((file) => /^\d+_[a-z0-9_]+\.sql$/.test(file))
      .sort();

    for (const file of files) {
      const alreadyApplied = await pool.query(
        'SELECT 1 FROM "migracionAplicada" WHERE "nombreArchivo" = $1',
        [file],
      );
      if (alreadyApplied.rowCount) continue;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(await readFile(join(migrationDirectory, file), 'utf8'));
        await client.query(
          'INSERT INTO "migracionAplicada" ("nombreArchivo") VALUES ($1)',
          [file],
        );
        await client.query('COMMIT');
        process.stdout.write(`Migración aplicada: ${file}\n`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  } finally {
    await pool.end();
  }
}

runMigrations().catch((error: unknown) => {
  process.stderr.write(`Falló la ejecución de migraciones: ${String(error)}\n`);
  process.exitCode = 1;
});
