import { Global, Inject, Injectable, Module, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { ServicioBaseDatos } from './servicio-base-datos';
import { GRUPO_CONEXIONES_BD } from './proveedor-base-datos';

@Injectable()
class ServicioCierreBaseDatos implements OnModuleDestroy {
  constructor(@Inject(GRUPO_CONEXIONES_BD) private readonly grupoConexiones: Pool) {}

  async onModuleDestroy(): Promise<void> {
    await this.grupoConexiones.end();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: GRUPO_CONEXIONES_BD,
      useFactory: () =>
        new Pool({
          host: process.env.DB_HOST,
          port: Number(process.env.DB_PORT ?? 5432),
          database: process.env.DB_NAME,
          user: process.env.DB_RUNTIME_USER,
          password: process.env.DB_RUNTIME_PASSWORD,
          max: 10,
          connectionTimeoutMillis: 5_000,
          idleTimeoutMillis: 30_000,
          application_name: 'backend-historia-clinica-api',
      }),
    },
    ServicioCierreBaseDatos,
    ServicioBaseDatos,
  ],
  exports: [GRUPO_CONEXIONES_BD, ServicioBaseDatos],
})
export class ModuloBaseDatos {}
