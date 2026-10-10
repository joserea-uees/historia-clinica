import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { IsEmail, IsString, MaxLength, MinLength, IsUUID } from 'class-validator';
import { AuthService } from './auth.service';
import { CurrentUser, Public } from './auth.decorators';
import { UsuarioAutenticado } from './auth.types';

class LoginDto {
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

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ idUsuario: string; correo: string }> {
    return this.auth.login(body.correo, body.clave, response);
  }

  @Get('me')
  current(@CurrentUser() user: UsuarioAutenticado) {
    return this.auth.current(user);
  }

  @Post('logout')
  @HttpCode(200)
  logout(
    @CurrentUser() user: UsuarioAutenticado,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.auth.logout(user, response);
  }

  @Get('organizations')
  organizations(@CurrentUser() user: UsuarioAutenticado) {
    return this.auth.organizations(user);
  }

  @Post('select-organization')
  selectOrganization(
    @CurrentUser() user: UsuarioAutenticado,
    @Body() body: SeleccionarOrganizacionDto,
  ) {
    return this.auth.selectOrganization(user, body.idOrganizacion);
  }
}
