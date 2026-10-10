import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import * as analizadorDeCookies from 'cookie-parser';
import { NextFunction, Request, Response } from 'express';
import { ModuloAplicacion } from './modulo-aplicacion';

async function iniciarServidor(): Promise<void> {
  const aplicacion = await NestFactory.create(ModuloAplicacion, { bufferLogs: true });
  const origenPermitido = process.env.FRONTEND_ORIGIN;

  aplicacion.use(helmet());
  aplicacion.use(analizadorDeCookies());
  aplicacion.use((_solicitud: Request, respuesta: Response, siguiente: NextFunction) => {
    respuesta.setHeader('Cache-Control', 'no-store');
    siguiente();
  });
  aplicacion.enableCors({
    origin: origenPermitido ? origenPermitido.split(',').map((origen) => origen.trim()) : false,
    credentials: true,
  });
  aplicacion.enableVersioning({ type: VersioningType.URI });
  aplicacion.setGlobalPrefix('api');
  aplicacion.enableShutdownHooks();
  aplicacion.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  await aplicacion.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}

void iniciarServidor();
