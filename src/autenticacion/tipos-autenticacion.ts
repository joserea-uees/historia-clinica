import { Request } from 'express';

export interface UsuarioAutenticado {
  idUsuario: string;
  correo: string;
  hashSesion: string;
  idOrganizacionActiva: string | null;
}

export type SolicitudAutenticada = Request & { usuario?: UsuarioAutenticado };
