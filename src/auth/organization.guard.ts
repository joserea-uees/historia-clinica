import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseService } from '../database/database.service';
import { ORGANIZATION_REQUIRED } from './auth.decorators';
import { SolicitudAutenticada } from './auth.types';

@Injectable()
export class OrganizationGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly database: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(ORGANIZATION_REQUIRED, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest<SolicitudAutenticada>();
    const user = request.usuario;
    const organizationId = user?.idOrganizacionActiva;
    if (!user || !organizationId) throw new ForbiddenException('Selecciona una organización activa.');

    const membership = await this.database.withUserTransaction(user.idUsuario, async (client) =>
      client.query(
        `SELECT 1 FROM "membresia"
         WHERE "idUsuario" = $1 AND "idOrganizacion" = $2 AND "activa" = true`,
        [user.idUsuario, organizationId],
      ),
    );
    if (!membership.rowCount) throw new ForbiddenException('No tienes acceso a la organización activa.');
    return true;
  }
}
