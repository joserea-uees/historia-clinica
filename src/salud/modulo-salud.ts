import { Module } from '@nestjs/common';
import { ControladorSalud } from './controlador-salud';

@Module({ controllers: [ControladorSalud] })
export class ModuloSalud {}
