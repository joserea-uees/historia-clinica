# Backend de historia clínica

Base inicial del backend modular con NestJS, TypeScript, PostgreSQL y Docker Compose.

## Requisitos

- Docker Desktop con Docker Compose.
- Node.js 24 o superior y npm 11 o superior para ejecutar la API fuera de Docker.

## Preparar desarrollo local

1. Copia `.env.example` como `.env`.
2. Cambia las tres contraseñas de desarrollo por valores aleatorios distintos. El archivo `.env` está excluido de Git y del contexto Docker.
3. Instala dependencias con `npm ci`.
4. Levanta PostgreSQL: `docker compose up -d db`.
5. Espera a que `docker compose ps` muestre `db` como healthy.
6. Aplica las migraciones con `docker compose --profile tools run --rm migrate`.
7. Configura temporalmente `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD` en `.env` (contraseña única de al menos 14 caracteres), y crea el primer usuario con `docker compose --profile tools run --rm bootstrap-admin`. El comando solo funciona si todavía no existen usuarios; luego elimina esas dos variables del archivo local.
8. Levanta la API con `docker compose up --build -d api`.

La API queda disponible en `http://localhost:3000/api/v1/health`; el endpoint `/api/v1/health/ready` consulta PostgreSQL. En desarrollo, PostgreSQL se publica solo en `127.0.0.1:5433` (configurable con `DB_HOST_PORT`).

## Autenticación inicial

- `POST /api/v1/auth/login` recibe `{ "correo": "...", "clave": "..." }`. Devuelve identidad mínima y crea cookies `hc_session` (`HttpOnly`) y `hc_csrf` (legible por el frontend).
- Para `POST`, `PUT`, `PATCH` y `DELETE` autenticados, el frontend debe enviar el valor de `hc_csrf` también como `X-CSRF-Token`.
- `GET /api/v1/auth/me` consulta la sesión; `GET /api/v1/auth/organizations` lista las organizaciones con membresía vigente.
- `POST /api/v1/auth/select-organization` recibe `{ "idOrganizacion": "UUID" }`; el servidor valida la membresía antes de guardar la organización en la sesión.
- `POST /api/v1/auth/logout` revoca la sesión y elimina sus cookies.
- Las sesiones duran 12 horas. Los tokens de sesión y CSRF se almacenan como hashes; las contraseñas usan Argon2id.
- No existe registro público. El comando bootstrap crea la organización inicial y un administrador, y rechaza su ejecución cuando ya hay usuarios.

Las cookies requieren que el navegador mande credenciales (`credentials: 'include'`) y que `FRONTEND_ORIGIN` incluya el origen exacto del frontend. HTTPS y cookie `Secure` se aplican al configurar `NODE_ENV=production` detrás de un proxy TLS.

Para detener los servicios sin borrar datos: `docker compose down`. El volumen se elimina solo con una acción explícita como `docker compose down -v`.

## Base de datos

Las migraciones SQL están en `database/migrations`. Las tablas y columnas usan nombres en español camelCase entre comillas dobles. El usuario `app_runtime` no es propietario de las tablas y queda sujeto a RLS; `app_migrator` se reserva para migraciones.

Las consultas clínicas deben usar `DatabaseService.withTenantTransaction(idUsuario, idOrganizacion, ...)`, que fija ambos contextos RLS como locales a la transacción. Las rutas clínicas deben marcarse con `@RequireOrganization()`; el guard vuelve a validar la membresía activa. Las tablas `persona` y `membresia` tienen RLS forzado y `organizacion` limita la lectura a membresías del usuario autenticado.

Este módulo no completa todavía los 20 controles de seguridad ni la autorización granular por rol, MFA, auditoría clínica, cifrado de campos, defensas contra bots, política completa de sesiones, seguridad de archivos, monitorización de consultas, escaneo de imagen y despliegue TLS. No se deben cargar historias clínicas reales ni desplegarlo en producción hasta completar y revisar esos controles.

## Alcance de esta base

Incluye estructura NestJS, configuración, health checks, PostgreSQL en contenedor, roles separados, tablas iniciales y RLS para membresías/personas. Autenticación, permisos clínicos completos, auditoría de negocio, consultas, documentos, integración de identidad y endurecimiento de producción se desarrollarán en siguientes entregas.
