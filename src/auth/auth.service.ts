import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { Response } from 'express';
import { Pool } from 'pg';
import { Inject } from '@nestjs/common';
import { DATABASE_POOL } from '../database/database.provider';
import { DatabaseService } from '../database/database.service';
import { UsuarioAutenticado } from './auth.types';

const SESSION_COOKIE = 'hc_session';
const CSRF_COOKIE = 'hc_csrf';
const SESSION_LIFETIME_MS = 12 * 60 * 60 * 1000;
const ARGON_OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

const digest = (value: string): string => createHash('sha256').update(value).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE_POOL) private readonly database: Pool,
    private readonly databaseService: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  async login(correoInput: string, clave: string, response: Response): Promise<{ idUsuario: string; correo: string }> {
    const correo = correoInput.trim().toLowerCase();
    const found = await this.database.query<{
      idUsuario: string;
      correo: string;
      hashClave: string;
      activo: boolean;
    }>(
      `SELECT "idUsuario", "correo", "hashClave", "activo"
       FROM "usuario" WHERE lower("correo") = $1 LIMIT 1`,
      [correo],
    );
    const user = found.rows[0];
    const hashToVerify = user?.hashClave ?? await this.dummyHash();
    let valid = false;
    try {
      valid = await argon2.verify(hashToVerify, clave);
    } catch {
      valid = false;
    }
    if (!user || !user.activo || !valid) {
      throw new UnauthorizedException('Correo o contraseña incorrectos.');
    }

    const sessionToken = randomBytes(32).toString('base64url');
    const csrfToken = randomBytes(32).toString('base64url');
    await this.database.query(
      `INSERT INTO "sesionUsuario" ("hashToken", "idUsuario", "hashCsrf", "fechaExpiracion")
       VALUES ($1, $2, $3, now() + interval '12 hours')`,
      [digest(sessionToken), user.idUsuario, digest(csrfToken)],
    );
    this.writeCookies(response, sessionToken, csrfToken);
    return { idUsuario: user.idUsuario, correo: user.correo };
  }

  async logout(user: UsuarioAutenticado, response: Response): Promise<{ status: 'ok' }> {
    await this.database.query(
      `UPDATE "sesionUsuario" SET "fechaRevocacion" = now()
       WHERE "hashToken" = $1 AND "fechaRevocacion" IS NULL`,
      [user.hashSesion],
    );
    this.clearCookies(response);
    return { status: 'ok' };
  }

  current(user: UsuarioAutenticado): {
    idUsuario: string;
    correo: string;
    idOrganizacionActiva: string | null;
  } {
    return {
      idUsuario: user.idUsuario,
      correo: user.correo,
      idOrganizacionActiva: user.idOrganizacionActiva,
    };
  }

  async organizations(user: UsuarioAutenticado): Promise<Array<{
    idOrganizacion: string;
    nombre: string;
    rol: string;
  }>> {
    return this.databaseService.withUserTransaction(user.idUsuario, async (client) => {
      const result = await client.query<{ idOrganizacion: string; nombre: string; rol: string }>(
        `SELECT o."idOrganizacion", o."nombre", m."rol"
         FROM "membresia" m
         JOIN "organizacion" o ON o."idOrganizacion" = m."idOrganizacion"
         WHERE m."idUsuario" = $1 AND m."activa" = true
         ORDER BY o."nombre"`,
        [user.idUsuario],
      );
      return result.rows;
    });
  }

  async selectOrganization(
    user: UsuarioAutenticado,
    idOrganizacion: string,
  ): Promise<{ idOrganizacionActiva: string }> {
    const membership = await this.databaseService.withUserTransaction(user.idUsuario, async (client) =>
      client.query(
        `SELECT 1 FROM "membresia"
         WHERE "idUsuario" = $1 AND "idOrganizacion" = $2 AND "activa" = true`,
        [user.idUsuario, idOrganizacion],
      ),
    );
    if (!membership.rowCount) throw new ForbiddenException('No tienes acceso a esa organización.');

    const changed = await this.database.query(
      `UPDATE "sesionUsuario" SET "idOrganizacionActiva" = $1
       WHERE "hashToken" = $2 AND "idUsuario" = $3
         AND "fechaRevocacion" IS NULL AND "fechaExpiracion" > now()`,
      [idOrganizacion, user.hashSesion, user.idUsuario],
    );
    if (!changed.rowCount) throw new UnauthorizedException('La sesión ya no está vigente.');
    return { idOrganizacionActiva: idOrganizacion };
  }

  private writeCookies(response: Response, sessionToken: string, csrfToken: string): void {
    const options = this.cookieOptions();
    response.cookie(SESSION_COOKIE, sessionToken, { ...options, httpOnly: true });
    response.cookie(CSRF_COOKIE, csrfToken, { ...options, httpOnly: false });
  }

  private clearCookies(response: Response): void {
    const options = this.cookieOptions();
    response.clearCookie(SESSION_COOKIE, { ...options, httpOnly: true });
    response.clearCookie(CSRF_COOKIE, { ...options, httpOnly: false });
  }

  private cookieOptions(): {
    path: string;
    secure: boolean;
    sameSite: 'lax';
    maxAge: number;
  } {
    return {
      path: '/api/v1',
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      maxAge: SESSION_LIFETIME_MS,
    };
  }

  private dummyHash(): Promise<string> {
    return (AuthService.dummyHash ??= argon2.hash('invalid-login-dummy-secret', ARGON_OPTIONS));
  }

  private static dummyHash: Promise<string> | undefined;
}
