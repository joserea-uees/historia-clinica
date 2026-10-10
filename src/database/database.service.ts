import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { DATABASE_POOL } from './database.provider';

@Injectable()
export class DatabaseService {
  constructor(@Inject(DATABASE_POOL) private readonly pool: Pool) {}

  async withUserTransaction<T>(
    userId: string,
    operation: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    this.assertUuid(userId, 'idUsuario');
    return this.withContext({ userId }, operation);
  }

  async withTenantTransaction<T>(
    userId: string,
    organizationId: string,
    operation: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    this.assertUuid(userId, 'idUsuario');
    this.assertUuid(organizationId, 'idOrganizacion');
    return this.withContext({ userId, organizationId }, operation);
  }

  private assertUuid(value: string, name: string): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new BadRequestException(`${name} debe ser un UUID válido.`);
    }
  }

  private async withContext<T>(
    context: { userId: string; organizationId?: string },
    operation: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.idUsuario', $1, true)", [context.userId]);
      if (context.organizationId) {
        await client.query("SELECT set_config('app.idOrganizacion', $1, true)", [context.organizationId]);
      }
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
