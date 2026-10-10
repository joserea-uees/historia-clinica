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
7. Levanta la API con `docker compose up --build -d api`.

La API queda disponible en `http://localhost:3000/api/v1/health`; el endpoint `/api/v1/health/ready` consulta PostgreSQL. En desarrollo, PostgreSQL se publica solo en `127.0.0.1:5433` (configurable con `DB_HOST_PORT`).

Para detener los servicios sin borrar datos: `docker compose down`. El volumen se elimina solo con una acción explícita como `docker compose down -v`.

## Base de datos

Las migraciones SQL están en `database/migrations`. Las tablas y columnas usan nombres en español camelCase entre comillas dobles. El usuario `app_runtime` no es propietario de las tablas y queda sujeto a RLS; `app_migrator` se reserva para migraciones.

El contexto RLS `app.idOrganizacion` debe fijarse con `SET LOCAL` dentro de la misma transacción que realiza la consulta. La API todavía no tiene autenticación funcional ni flujo de autorización de membresías; por ello no se deben cargar datos clínicos reales ni desplegar esta base como servicio productivo.

## Alcance de esta base

Incluye estructura NestJS, configuración, health checks, PostgreSQL en contenedor, roles separados, tablas iniciales y RLS para membresías/personas. Autenticación, permisos clínicos completos, auditoría de negocio, consultas, documentos, integración de identidad y endurecimiento de producción se desarrollarán en siguientes entregas.
