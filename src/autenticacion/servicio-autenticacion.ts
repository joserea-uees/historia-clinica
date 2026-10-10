import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { Response } from 'express';
import { Pool } from 'pg';
import { GRUPO_CONEXIONES_BD } from '../base-datos/proveedor-base-datos';
import { ServicioBaseDatos } from '../base-datos/servicio-base-datos';
import { UsuarioAutenticado } from './tipos-autenticacion';

const COOKIE_SESION = 'hc_sesion';
const COOKIE_TOKEN_ANTIFALSIFICACION = 'hc_antifalsificacion';
const DURACION_SESION_MS = 12 * 60 * 60 * 1000;
const OPCIONES_ARGON: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

const calcularHash = (valor: string): string => createHash('sha256').update(valor).digest('hex');

@Injectable()
export class ServicioAutenticacion {
  constructor(
    @Inject(GRUPO_CONEXIONES_BD) private readonly grupoConexiones: Pool,
    private readonly servicioBaseDatos: ServicioBaseDatos,
    private readonly configuracion: ConfigService,
  ) {}

  async iniciarSesion(
    correoRecibido: string,
    clave: string,
    respuesta: Response,
  ): Promise<{ idUsuario: string; correo: string }> {
    const correo = correoRecibido.trim().toLowerCase();
    const consultaUsuario = await this.grupoConexiones.query<{
      idUsuario: string;
      correo: string;
      hashClave: string;
      activo: boolean;
    }>(
      `SELECT "idUsuario", "correo", "hashClave", "activo"
       FROM "usuario" WHERE lower("correo") = $1 LIMIT 1`,
      [correo],
    );
    const usuario = consultaUsuario.rows[0];
    const hashClaveVerificar = usuario?.hashClave ?? await this.obtenerHashFicticio();
    let claveValida = false;
    try {
      claveValida = await argon2.verify(hashClaveVerificar, clave);
    } catch {
      claveValida = false;
    }
    if (!usuario || !usuario.activo || !claveValida) {
      throw new UnauthorizedException('Correo o contraseña incorrectos.');
    }

    const tokenSesion = randomBytes(32).toString('base64url');
    const tokenAntifalsificacion = randomBytes(32).toString('base64url');
    await this.grupoConexiones.query(
      `INSERT INTO "sesionUsuario" ("hashToken", "idUsuario", "hashCsrf", "fechaExpiracion")
       VALUES ($1, $2, $3, now() + interval '12 hours')`,
      [calcularHash(tokenSesion), usuario.idUsuario, calcularHash(tokenAntifalsificacion)],
    );
    this.establecerCookies(respuesta, tokenSesion, tokenAntifalsificacion);
    return { idUsuario: usuario.idUsuario, correo: usuario.correo };
  }

  async cerrarSesion(usuario: UsuarioAutenticado, respuesta: Response): Promise<{ estado: 'ok' }> {
    await this.grupoConexiones.query(
      `UPDATE "sesionUsuario" SET "fechaRevocacion" = now()
       WHERE "hashToken" = $1 AND "fechaRevocacion" IS NULL`,
      [usuario.hashSesion],
    );
    this.borrarCookies(respuesta);
    return { estado: 'ok' };
  }

  obtenerSesionActual(usuario: UsuarioAutenticado): {
    idUsuario: string;
    correo: string;
    idOrganizacionActiva: string | null;
  } {
    return {
      idUsuario: usuario.idUsuario,
      correo: usuario.correo,
      idOrganizacionActiva: usuario.idOrganizacionActiva,
    };
  }

  async listarOrganizaciones(usuario: UsuarioAutenticado): Promise<Array<{
    idOrganizacion: string;
    nombre: string;
    rol: string;
  }>> {
    return this.servicioBaseDatos.conTransaccionDeUsuario(usuario.idUsuario, async (cliente) => {
      const consultaOrganizaciones = await cliente.query<{
        idOrganizacion: string;
        nombre: string;
        rol: string;
      }>(
        `SELECT o."idOrganizacion", o."nombre", m."rol"
         FROM "membresia" m
         JOIN "organizacion" o ON o."idOrganizacion" = m."idOrganizacion"
         WHERE m."idUsuario" = $1 AND m."activa" = true
         ORDER BY o."nombre"`,
        [usuario.idUsuario],
      );
      return consultaOrganizaciones.rows;
    });
  }

  async seleccionarOrganizacion(
    usuario: UsuarioAutenticado,
    idOrganizacion: string,
  ): Promise<{ idOrganizacionActiva: string }> {
    const membresia = await this.servicioBaseDatos.conTransaccionDeUsuario(usuario.idUsuario, (cliente) =>
      cliente.query(
        `SELECT 1 FROM "membresia"
         WHERE "idUsuario" = $1 AND "idOrganizacion" = $2 AND "activa" = true`,
        [usuario.idUsuario, idOrganizacion],
      ),
    );
    if (!membresia.rowCount) throw new ForbiddenException('No tienes acceso a esa organización.');

    const sesionActualizada = await this.grupoConexiones.query(
      `UPDATE "sesionUsuario" SET "idOrganizacionActiva" = $1
       WHERE "hashToken" = $2 AND "idUsuario" = $3
         AND "fechaRevocacion" IS NULL AND "fechaExpiracion" > now()`,
      [idOrganizacion, usuario.hashSesion, usuario.idUsuario],
    );
    if (!sesionActualizada.rowCount) throw new UnauthorizedException('La sesión ya no está vigente.');
    return { idOrganizacionActiva: idOrganizacion };
  }

  private establecerCookies(respuesta: Response, tokenSesion: string, tokenAntifalsificacion: string): void {
    const opciones = this.obtenerOpcionesCookie();
    respuesta.cookie(COOKIE_SESION, tokenSesion, { ...opciones, httpOnly: true });
    respuesta.cookie(COOKIE_TOKEN_ANTIFALSIFICACION, tokenAntifalsificacion, { ...opciones, httpOnly: false });
  }

  private borrarCookies(respuesta: Response): void {
    const opciones = this.obtenerOpcionesCookie();
    respuesta.clearCookie(COOKIE_SESION, { ...opciones, httpOnly: true });
    respuesta.clearCookie(COOKIE_TOKEN_ANTIFALSIFICACION, { ...opciones, httpOnly: false });
  }

  private obtenerOpcionesCookie(): {
    path: string;
    secure: boolean;
    sameSite: 'lax';
    maxAge: number;
  } {
    return {
      path: '/api/v1',
      secure: this.configuracion.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      maxAge: DURACION_SESION_MS,
    };
  }

  private obtenerHashFicticio(): Promise<string> {
    return (ServicioAutenticacion.hashFicticio ??= argon2.hash('clave-ficticia-para-inicio-invalido', OPCIONES_ARGON));
  }

  private static hashFicticio: Promise<string> | undefined;
}
