# Backend Foundation Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Crear la primera base ejecutable del backend de historia clínica, con API NestJS, Docker Compose y PostgreSQL con nombres españoles camelCase y políticas RLS.

**Architecture:** Monolito modular NestJS con endpoints versionados. PostgreSQL se ejecuta en contenedor dentro de una red privada de Compose y solo la API recibe credenciales privadas; el esquema se aplica con migraciones SQL y el rol de aplicación queda sujeto a RLS.

**Tech Stack:** Node.js 24, TypeScript, NestJS, PostgreSQL, Docker Compose, SQL versionado, Helmet, class-validator.

**Spec:** `PLAN_BACKEND_HISTORIA_CLINICA.md`, secciones 2–5 y 7.

## Global Constraints

- Los nombres de tablas y columnas serán descriptivos, en español y en camelCase con inicial minúscula.
- Los identificadores camelCase de PostgreSQL se escriben entre comillas dobles en SQL.
- PostgreSQL no expone su puerto a Internet; en desarrollo, solo a `localhost`.
- Las credenciales privadas de la base permanecen del lado del servidor y nunca se incluyen en frontend, Git ni imágenes Docker.
- El rol de runtime no es propietario de tablas ni tiene `BYPASSRLS`.
- Docker Compose de desarrollo incluye API, PostgreSQL con healthcheck y volumen persistente.

## Review Focus

- `idOrganizacion` ausente o incorrecto: RLS deniega el acceso a filas de otra organización.
- Contexto de organización que permanece en una conexión reutilizada: transacciones usan `SET LOCAL` y no filtran el contexto al siguiente usuario.
- Credenciales de desarrollo incompletas: API falla con mensaje seguro y no expone secretos.
- Puerto de PostgreSQL publicado externamente: Compose lo limita a loopback.
- Rutas y cuerpos malformados: validación global responde 400 y no persiste cambios.

---

### Task 1: API NestJS con configuración segura básica

**Files:**
- Create: `package.json`, `tsconfig.json`, `nest-cli.json`, `.gitignore`, `.dockerignore`, `.env.example`
- Create: `src/main.ts`, `src/app.module.ts`, `src/health/health.module.ts`, `src/health/health.controller.ts`
- Create: `src/config/environment.ts`

**Interfaces:**
- Produces: `GET /api/v1/health` → `{ status: "ok" }`; `GET /api/v1/health/ready` comprueba conectividad con PostgreSQL.

- [x] Crear el módulo de salud con rutas versionadas y configurar Helmet, CORS por allowlist, límite básico de solicitudes y `ValidationPipe` global con `whitelist`, `forbidNonWhitelisted` y `transform`.
- [x] Añadir lectura tipada de variables de entorno sin valores secretos por defecto en producción.
- [x] Crear scripts `start:dev`, `build`, `start:prod` y `migration:run`.
- [x] Verificar compilación con `npm run build`.

### Task 2: Contenedores y conexión PostgreSQL

**Files:**
- Create: `Dockerfile`, `compose.yaml`
- Create: `src/database/database.module.ts`, `src/database/database.provider.ts`
- Modify: `.env.example`, `.gitignore`, `package.json`

**Interfaces:**
- Consumes: configuración validada de Task 1.
- Produces: proveedor PostgreSQL con pool `pg`; readiness comprueba `SELECT 1`.

- [x] Definir servicio `db` con volumen, healthcheck y puerto ligado a `127.0.0.1`.
- [x] Definir servicio `api` que espera el healthcheck de `db`, no contiene secretos en la imagen y corre como usuario sin privilegios.
- [x] Validar `docker compose config` y `npm run build`.

### Task 3: Esquema base y Row Level Security

**Files:**
- Create: `database/migrations/001_base.sql`, `database/migrations/002_rls.sql`
- Create: `database/migrations/run-migrations.ts`, `database/roles.sql`
- Modify: `package.json`, `src/database/database.module.ts`

**Interfaces:**
- Produces: tablas `"organizacion"`, `"usuario"`, `"membresia"` y `"persona"` con UUID, timestamps y nombres camelCase; transacción que establece contexto mediante `SET LOCAL app.idOrganizacion`.

- [x] Crear rol propietario de migraciones separado del rol de runtime.
- [x] Crear esquema base e índices con identificadores en español camelCase y entre comillas.
- [x] Habilitar y forzar RLS en las tablas con alcance de organización; crear políticas con `current_setting('app.idOrganizacion', true)`.
- [x] Ejecutar migraciones solo después de comprobar que el usuario de conexión es el rol de migraciones.
- [x] Confirmar compilación y arranque completo con Compose; comprobar políticas y roles con comandos SQL bajo el rol de runtime.

### Task 4: Guía local de ejecución

**Files:**
- Create: `README.md`
- Modify: `PLAN_BACKEND_HISTORIA_CLINICA.md`

- [x] Documentar requisitos, copia de `.env.example`, arranque con Compose, health endpoints, migraciones y parada preservando el volumen.
- [x] Registrar que autenticación funcional, módulos clínicos, archivos, integración de identidad y los demás controles pendientes se entregarán en tareas posteriores; el esqueleto no se presenta como listo para producción clínica.
