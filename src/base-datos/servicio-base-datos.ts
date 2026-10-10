import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { GRUPO_CONEXIONES_BD } from './proveedor-base-datos';

@Injectable()
export class ServicioBaseDatos {
  constructor(@Inject(GRUPO_CONEXIONES_BD) private readonly grupoConexiones: Pool) {}

  async conTransaccionDeUsuario<T>(
    idUsuario: string,
    operacion: (cliente: PoolClient) => Promise<T>,
  ): Promise<T> {
    this.exigirUuid(idUsuario, 'idUsuario');
    return this.conContexto({ idUsuario }, operacion);
  }

  async conTransaccionDeOrganizacion<T>(
    idUsuario: string,
    idOrganizacion: string,
    operacion: (cliente: PoolClient) => Promise<T>,
  ): Promise<T> {
    this.exigirUuid(idUsuario, 'idUsuario');
    this.exigirUuid(idOrganizacion, 'idOrganizacion');
    return this.conContexto({ idUsuario, idOrganizacion }, operacion);
  }

  private exigirUuid(valor: string, nombre: string): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor)) {
      throw new BadRequestException(`${nombre} debe ser un UUID válido.`);
    }
  }

  private async conContexto<T>(
    contexto: { idUsuario: string; idOrganizacion?: string },
    operacion: (cliente: PoolClient) => Promise<T>,
  ): Promise<T> {
    const cliente = await this.grupoConexiones.connect();
    try {
      await cliente.query('BEGIN');
      await cliente.query("SELECT set_config('app.idUsuario', $1, true)", [contexto.idUsuario]);
      if (contexto.idOrganizacion) {
        await cliente.query("SELECT set_config('app.idOrganizacion', $1, true)", [contexto.idOrganizacion]);
      }
      const resultado = await operacion(cliente);
      await cliente.query('COMMIT');
      return resultado;
    } catch (error) {
      await cliente.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      cliente.release();
    }
  }
}
