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
import { DATABASE_POOL } from '../database/database.provider';
import { PUBLIC_ROUTE } from './auth.decorators';
import { SolicitudAutenticada } from './auth.types';

const SESSION_COOKIE = 'hc_session';
const CSRF_COOKIE = 'hc_csrf';
const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class AuthenticationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(DATABASE_POOL) private readonly database: Pool,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<SolicitudAutenticada & {
      cookies?: Record<string, string | undefined>;
      headers: Record<string, string | string[] | undefined>;
    }>();
    const token = request.cookies?.[SESSION_COOKIE];
    if (!token || token.length > 200) throw new UnauthorizedException('Autenticación requerida.');

    const hashSesion = createHash('sha256').update(token).digest('hex');
    const result = await this.database.query<{
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
    const session = result.rows[0];
    if (!session) throw new UnauthorizedException('Sesión inválida o vencida.');

    if (UNSAFE_METHODS.has(request.method)) {
      const cookieToken = request.cookies?.[CSRF_COOKIE];
      const header = request.headers['x-csrf-token'];
      const headerToken = Array.isArray(header) ? header[0] : header;
      if (!cookieToken || cookieToken !== headerToken || cookieToken.length > 200) {
        throw new ForbiddenException('Token CSRF inválido.');
      }
      const suppliedHash = createHash('sha256').update(cookieToken).digest();
      const expectedHash = Buffer.from(session.hashCsrf, 'hex');
      if (suppliedHash.length !== expectedHash.length || !timingSafeEqual(suppliedHash, expectedHash)) {
        throw new ForbiddenException('Token CSRF inválido.');
      }
    }

    request.usuario = {
      idUsuario: session.idUsuario,
      correo: session.correo,
      hashSesion,
      idOrganizacionActiva: session.idOrganizacionActiva,
    };
    await this.database.query(
      `UPDATE "sesionUsuario" SET "ultimoAcceso" = now()
       WHERE "hashToken" = $1 AND "ultimoAcceso" < now() - interval '5 minutes'`,
      [hashSesion],
    );
    return true;
  }
}
