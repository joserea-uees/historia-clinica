import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';

async function ejecutarMigraciones(): Promise<void> {
  const cadenaConexion = process.env.DATABASE_MIGRATION_URL;
  if (!cadenaConexion) {
    throw new Error('DATABASE_MIGRATION_URL es obligatorio para ejecutar migraciones.');
  }

  const grupoConexiones = new Pool({
    connectionString: cadenaConexion,
    application_name: 'historia-clinica-migrator',
  });
  try {
    const consultaRol = await grupoConexiones.query<{ usuarioActual: string }>(
      'SELECT current_user AS "usuarioActual"',
    );
    if (consultaRol.rows[0]?.usuarioActual !== 'app_migrator') {
      throw new Error('Las migraciones deben ejecutarse con el rol app_migrator.');
    }

    await grupoConexiones.query(`
      CREATE TABLE IF NOT EXISTS "migracionAplicada" (
        "nombreArchivo" varchar(200) PRIMARY KEY,
        "fechaAplicacion" timestamptz NOT NULL DEFAULT now()
      )
    `);

    const directorioMigraciones = join(process.cwd(), 'database', 'migrations');
    const archivosMigracion = (await readdir(directorioMigraciones))
      .filter((archivo) => /^\d+_[a-z0-9_]+\.sql$/.test(archivo))
      .sort();

    for (const archivo of archivosMigracion) {
      const yaAplicada = await grupoConexiones.query(
        'SELECT 1 FROM "migracionAplicada" WHERE "nombreArchivo" = $1',
        [archivo],
      );
      if (yaAplicada.rowCount) continue;

      const cliente = await grupoConexiones.connect();
      try {
        await cliente.query('BEGIN');
        await cliente.query(await readFile(join(directorioMigraciones, archivo), 'utf8'));
        await cliente.query(
          'INSERT INTO "migracionAplicada" ("nombreArchivo") VALUES ($1)',
          [archivo],
        );
        await cliente.query('COMMIT');
        process.stdout.write(`Migración aplicada: ${archivo}\n`);
      } catch (error) {
        await cliente.query('ROLLBACK');
        throw error;
      } finally {
        cliente.release();
      }
    }
  } finally {
    await grupoConexiones.end();
  }
}

ejecutarMigraciones().catch((error: unknown) => {
  process.stderr.write(`Falló la ejecución de migraciones: ${String(error)}\n`);
  process.exitCode = 1;
});
