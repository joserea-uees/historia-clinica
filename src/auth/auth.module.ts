import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthenticationGuard } from './authentication.guard';
import { OrganizationGuard } from './organization.guard';

@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthenticationGuard, OrganizationGuard],
  exports: [AuthenticationGuard, OrganizationGuard],
})
export class AuthModule {}
