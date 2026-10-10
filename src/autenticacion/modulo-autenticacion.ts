import { Module } from '@nestjs/common';
import { ControladorAutenticacion } from './controlador-autenticacion';
import { ServicioAutenticacion } from './servicio-autenticacion';
import { GuardiaAutenticacion } from './guardia-autenticacion';
import { GuardiaOrganizacion } from './guardia-organizacion';

@Module({
  controllers: [ControladorAutenticacion],
  providers: [ServicioAutenticacion, GuardiaAutenticacion, GuardiaOrganizacion],
  exports: [GuardiaAutenticacion, GuardiaOrganizacion],
})
export class ModuloAutenticacion {}
