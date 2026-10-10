import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { SolicitudAutenticada } from './auth.types';

export const PUBLIC_ROUTE = 'publicRoute';
export const ORGANIZATION_REQUIRED = 'organizationRequired';

export const Public = () => SetMetadata(PUBLIC_ROUTE, true);
export const RequireOrganization = () => SetMetadata(ORGANIZATION_REQUIRED, true);
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => context.switchToHttp().getRequest<SolicitudAutenticada>().usuario,
);
