import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ServicioBaseDatos } from '../base-datos/servicio-base-datos';
import { ORGANIZACION_REQUERIDA } from './decoradores-autenticacion';
import { SolicitudAutenticada } from './tipos-autenticacion';

@Injectable()
export class GuardiaOrganizacion implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly servicioBaseDatos: ServicioBaseDatos) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const requerida = this.reflector.getAllAndOverride<boolean>(ORGANIZACION_REQUERIDA, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (!requerida) return true;

    const solicitud = contexto.switchToHttp().getRequest<SolicitudAutenticada>();
    const usuario = solicitud.usuario;
    const idOrganizacion = usuario?.idOrganizacionActiva;
    if (!usuario || !idOrganizacion) throw new ForbiddenException('Selecciona una organización activa.');

    const membresia = await this.servicioBaseDatos.conTransaccionDeUsuario(usuario.idUsuario, async (cliente) =>
      cliente.query(
        `SELECT 1 FROM "membresia"
         WHERE "idUsuario" = $1 AND "idOrganizacion" = $2 AND "activa" = true`,
        [usuario.idUsuario, idOrganizacion],
      ),
    );
    if (!membresia.rowCount) throw new ForbiddenException('No tienes acceso a la organización activa.');
    return true;
  }
}
