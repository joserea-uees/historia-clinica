import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Pool } from 'pg';
import { GRUPO_CONEXIONES_BD } from '../base-datos/proveedor-base-datos';
import { RUTA_PUBLICA } from './decoradores-autenticacion';
import { SolicitudAutenticada } from './tipos-autenticacion';

const COOKIE_SESION = 'hc_sesion';
const COOKIE_TOKEN_ANTIFALSIFICACION = 'hc_antifalsificacion';
const METODOS_CON_CAMBIOS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class GuardiaAutenticacion implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(GRUPO_CONEXIONES_BD) private readonly grupoConexiones: Pool,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const esPublica = this.reflector.getAllAndOverride<boolean>(RUTA_PUBLICA, [
      contexto.getHandler(),
      contexto.getClass(),
    ]);
    if (esPublica) return true;

    const solicitud = contexto.switchToHttp().getRequest<SolicitudAutenticada & {
      cookies?: Record<string, string | undefined>;
      headers: Record<string, string | string[] | undefined>;
    }>();
    const tokenSesion = solicitud.cookies?.[COOKIE_SESION];
    if (!tokenSesion || tokenSesion.length > 200) throw new UnauthorizedException('Autenticación requerida.');

    const hashSesion = createHash('sha256').update(tokenSesion).digest('hex');
    const consultaSesion = await this.grupoConexiones.query<{
      idUsuario: string;
      correo: string;
      hashCsrf: string;
      idOrganizacionActiva: string | null;
    }>(
      `SELECT s."idUsuario", u."correo", s."hashCsrf", s."idOrganizacionActiva"
       FROM "sesionUsuario" s
       JOIN "usuario" u ON u."idUsuario" = s."idUsuario"
       WHERE s."hashToken" = $1 AND s."fechaRevocacion" IS NULL
         AND s."fechaExpiracion" > now() AND u."activo" = true`,
      [hashSesion],
    );
    const sesion = consultaSesion.rows[0];
    if (!sesion) throw new UnauthorizedException('Sesión inválida o vencida.');

    if (METODOS_CON_CAMBIOS.has(solicitud.method)) {
      const tokenCookie = solicitud.cookies?.[COOKIE_TOKEN_ANTIFALSIFICACION];
      const valorCabecera = solicitud.headers['x-token-antifalsificacion'];
      const tokenCabecera = Array.isArray(valorCabecera) ? valorCabecera[0] : valorCabecera;
      if (!tokenCookie || tokenCookie !== tokenCabecera || tokenCookie.length > 200) {
        throw new ForbiddenException('Token antifalsificación inválido.');
      }
      const hashRecibido = createHash('sha256').update(tokenCookie).digest();
      const hashEsperado = Buffer.from(sesion.hashCsrf, 'hex');
      if (hashRecibido.length !== hashEsperado.length || !timingSafeEqual(hashRecibido, hashEsperado)) {
        throw new ForbiddenException('Token antifalsificación inválido.');
      }
    }

    solicitud.usuario = {
      idUsuario: sesion.idUsuario,
      correo: sesion.correo,
      hashSesion,
      idOrganizacionActiva: sesion.idOrganizacionActiva,
    };
    await this.grupoConexiones.query(
      `UPDATE "sesionUsuario" SET "ultimoAcceso" = now()
       WHERE "hashToken" = $1 AND "ultimoAcceso" < now() - interval '5 minutes'`,
      [hashSesion],
    );
    return true;
  }
}
