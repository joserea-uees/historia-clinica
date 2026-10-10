import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { Pool } from 'pg';
import { GRUPO_CONEXIONES_BD } from '../base-datos/proveedor-base-datos';
import { Publica } from '../autenticacion/decoradores-autenticacion';

@Controller({ path: 'salud', version: '1' })
@Publica()
export class ControladorSalud {
  constructor(@Inject(GRUPO_CONEXIONES_BD) private readonly grupoConexiones: Pool) {}

  @Get()
  estadoActivo(): { estado: 'ok' } {
    return { estado: 'ok' };
  }

  @Get('disponible')
  async comprobarDisponibilidad(): Promise<{ estado: 'disponible' }> {
    try {
      await this.grupoConexiones.query('SELECT 1');
      return { estado: 'disponible' };
    } catch {
      throw new ServiceUnavailableException({ estado: 'noDisponible' });
    }
  }
}
