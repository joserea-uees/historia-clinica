import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { IsEmail, IsString, MaxLength, MinLength, IsUUID } from 'class-validator';
import { ServicioAutenticacion } from './servicio-autenticacion';
import { UsuarioActual, Publica } from './decoradores-autenticacion';
import { UsuarioAutenticado } from './tipos-autenticacion';

class IniciarSesionDto {
  @IsEmail()
  @MaxLength(254)
  correo!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  clave!: string;
}

class SeleccionarOrganizacionDto {
  @IsUUID('4')
  idOrganizacion!: string;
}

@Controller({ path: 'autenticacion', version: '1' })
export class ControladorAutenticacion {
  constructor(private readonly servicioAutenticacion: ServicioAutenticacion) {}

  @Publica()
  @Post('iniciar-sesion')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  iniciarSesion(
    @Body() datos: IniciarSesionDto,
    @Res({ passthrough: true }) respuesta: Response,
  ): Promise<{ idUsuario: string; correo: string }> {
    return this.servicioAutenticacion.iniciarSesion(datos.correo, datos.clave, respuesta);
  }

  @Get('sesion')
  obtenerSesionActual(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.servicioAutenticacion.obtenerSesionActual(usuario);
  }

  @Post('cerrar-sesion')
  @HttpCode(200)
  cerrarSesion(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Res({ passthrough: true }) respuesta: Response,
  ) {
    return this.servicioAutenticacion.cerrarSesion(usuario, respuesta);
  }

  @Get('organizaciones')
  listarOrganizaciones(@UsuarioActual() usuario: UsuarioAutenticado) {
    return this.servicioAutenticacion.listarOrganizaciones(usuario);
  }

  @Post('seleccionar-organizacion')
  seleccionarOrganizacion(
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Body() datos: SeleccionarOrganizacionDto,
  ) {
    return this.servicioAutenticacion.seleccionarOrganizacion(usuario, datos.idOrganizacion);
  }
}
