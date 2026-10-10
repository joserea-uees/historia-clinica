import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SolicitudAutenticada } from './tipos-autenticacion';

export const RUTA_PUBLICA = 'rutaPublica';
export const ORGANIZACION_REQUERIDA = 'organizacionRequerida';

export const Publica = () => SetMetadata(RUTA_PUBLICA, true);
export const RequiereOrganizacion = () => SetMetadata(ORGANIZACION_REQUERIDA, true);
export const UsuarioActual = createParamDecorator(
  (_dato: unknown, contexto: ExecutionContext) => contexto.switchToHttp().getRequest<SolicitudAutenticada>().usuario,
);
