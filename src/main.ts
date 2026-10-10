import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const allowedOrigin = process.env.FRONTEND_ORIGIN;

  app.use(helmet());
  app.enableCors({
    origin: allowedOrigin ? allowedOrigin.split(',').map((origin) => origin.trim()) : false,
    credentials: true,
  });
  app.enableVersioning({ type: VersioningType.URI });
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}

void bootstrap();
