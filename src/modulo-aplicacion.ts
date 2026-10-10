import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';
import { ModuloBaseDatos } from './base-datos/modulo-base-datos';
import { ModuloSalud } from './salud/modulo-salud';
import { ModuloAutenticacion } from './autenticacion/modulo-autenticacion';
import { GuardiaAutenticacion } from './autenticacion/guardia-autenticacion';
import { GuardiaOrganizacion } from './autenticacion/guardia-organizacion';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
        PORT: Joi.number().port().default(3000),
        FRONTEND_ORIGIN: Joi.string().allow('').default(''),
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().port().default(5432),
        DB_NAME: Joi.string().required(),
        DB_RUNTIME_USER: Joi.string().required(),
        DB_RUNTIME_PASSWORD: Joi.string().min(16).required(),
      }),
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    ModuloBaseDatos,
    ModuloAutenticacion,
    ModuloSalud,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: GuardiaAutenticacion },
    { provide: APP_GUARD, useClass: GuardiaOrganizacion },
  ],
})
export class ModuloAplicacion {}
