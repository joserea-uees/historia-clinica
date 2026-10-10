# Plan maestro: historia clínica digital

**Fecha:** 9 de octubre de 2026  
**Estado:** fundamento técnico y primera iteración de autenticación implementados; módulos clínicos y controles de producción pendientes
**Prioridad actual:** terminar autorización/auditoría y empezar pacientes e historia; después, frontend y factibilidad de identidad externa.

## 1. Propósito y supuestos

Construir una plataforma para que profesionales de distintas especialidades encuentren con rapidez la información necesaria durante una consulta y registren la evolución del paciente de forma clara, trazable y segura. El backend debe ofrecer un contrato estable para un frontend posterior.

Supuestos de trabajo, sujetos a validación con los primeros usuarios:

- El producto se desplegará inicialmente en Ecuador, por la referencia a cédula y SRI.
- La primera versión atenderá consulta ambulatoria de consultorios y centros pequeños. Hospitalización, emergencias, facturación, agenda y telemedicina quedan fuera del primer alcance.
- Cada consultorio o centro es una **organización** con datos aislados. Un paciente puede existir en más de una organización, sin compartir su historia automáticamente.
- El médico es el usuario principal; personal autorizado puede apoyar en admisión o carga documental con permisos limitados.
- Debe funcionar aunque no exista acceso a una fuente gubernamental de identidad. La consulta externa será una ayuda para completar datos, nunca un requisito para atender.
- El sistema registrará atención clínica, pero **no tomará decisiones médicas automáticas** ni sustituirá la revisión del profesional.

### Resultado esperado de la primera entrega

Un médico autorizado puede localizar o crear un paciente, revisar antecedentes y alertas, abrir una consulta, registrar notas, diagnósticos, tratamientos y resultados, cerrarla y consultar una línea de tiempo íntegra. Las acciones quedan atribuidas a una persona, fecha y organización, con controles de acceso y auditoría.

## 2. Enfoque recomendado

| Alternativa | Ventaja | Riesgo/costo | Decisión |
| --- | --- | --- | --- |
| Monolito modular con API REST y PostgreSQL | Entrega rápida, transacciones simples, límites internos claros | Requiere disciplina para mantener módulos separados | **Recomendado para el núcleo clínico** |
| Microservicios para todos los dominios | Escala y despliegue independiente por dominio | Complejidad operativa, consistencia distribuida y mayor costo desde el inicio | Posponer |
| Backend genérico basado en formularios dinámicos | Permite añadir campos pronto | Debilita validación, búsquedas clínicas y trazabilidad si todo se guarda como JSON | Usar solo para extensiones de especialidad |

**Propuesta tecnológica inicial:** NestJS con TypeScript, PostgreSQL, migraciones versionadas, API REST documentada con OpenAPI, almacenamiento privado compatible con S3 para adjuntos y Docker. Docker Compose levantará localmente la API y PostgreSQL; los archivos de configuración distinguirán claramente desarrollo y producción. Confirmar versiones y biblioteca de persistencia al iniciar la implementación; esta decisión no depende de un proveedor de nube. Un trabajador asíncrono y Redis se incorporarán únicamente cuando exista un caso real de procesamiento en segundo plano.

El contenedor de PostgreSQL no expondrá el puerto a Internet. En desarrollo se podrá publicar solo en `localhost`; en producción la base quedará en una red privada y aceptará conexiones únicamente desde la API y tareas administrativas autorizadas. El backend usará credenciales privadas desde el servidor. Las claves privadas no se incluirán en la imagen Docker, el repositorio ni el bundle del frontend.

### Convención de nombres en PostgreSQL

Los nombres de tablas y columnas serán descriptivos, en español y en camelCase con inicial minúscula. Ejemplos: `"persona"`, `"consultaMedica"`, `"antecedenteMedico"`, `"idPersona"`, `"fechaCreacion"`, `"idOrganizacion"`. Las migraciones SQL deben escribirlos siempre entre comillas dobles para que PostgreSQL preserve mayúsculas; todos los índices, llaves foráneas y consultas deben seguir la misma convención. Los nombres de tablas también serán en español, sin abreviaturas ambiguas. Los nombres de clases y variables TypeScript pueden seguir la convención idiomática del lenguaje y mapearse a estos nombres en la capa de persistencia.

Docker Compose de desarrollo incluirá API, PostgreSQL con healthcheck y volumen persistente. El repositorio tendrá `.env.example`, `.gitignore`, `.dockerignore`, Dockerfile multi-stage y un comando explícito para ejecutar migraciones; ningún archivo `.env` con valores reales se versionará. La imagen de producción correrá como usuario sin privilegios, con dependencias mínimas y secretos inyectados al arrancar.

La integración con entidades externas sí merece un **servicio adaptador separado** cuando haya acceso oficial: tiene credenciales, disponibilidad, costos, políticas y ciclos de cambio distintos del núcleo clínico. Antes de ese momento bastará un contrato de integración y un proveedor simulado para desarrollo.

```text
Frontend médico (posterior)
         |
         v
API clínica / autenticación / autorización
         |
         +-- Pacientes e identidad local
         +-- Historia longitudinal y consultas
         +-- Configuración de especialidad
         +-- Documentos y resultados
         +-- Auditoría
         |
         +-- PostgreSQL + almacenamiento privado de archivos
         |
         +-- Puerto de verificación de identidad
                       |
                       +-- Adaptador externo (fase posterior, si se autoriza)
```

## 3. Límites del dominio y modelo de datos

Se recomienda separar los siguientes módulos dentro del backend:

| Módulo | Responsabilidad | Entidades principales |
| --- | --- | --- |
| Organizaciones y acceso | Centros, profesionales, membresías, roles y permisos | `"organizacion"`, `"usuario"`, `"membresia"`, `"rol"` |
| Pacientes | Identidad local, contactos y búsqueda con control de duplicados | `"persona"`, `"identificadorPersona"`, `"contacto"` |
| Historia longitudinal | Antecedentes, alergias, problemas activos e historial farmacológico | `"antecedenteMedico"`, `"alergia"`, `"diagnostico"`, `"medicacionDeclarada"` |
| Consultas | Apertura, borrador, cierre y enmiendas clínicas | `"consultaMedica"`, `"notaClinica"`, `"enmiendaConsulta"` |
| Plan de atención | Diagnósticos, indicaciones, tratamientos y prescripciones | `"diagnosticoConsulta"`, `"planAtencion"`, `"prescripcion"` |
| Resultados y archivos | Metadatos, mediciones, informes y adjuntos | `"resultadoMedicion"`, `"informeDiagnostico"`, `"documentoClinico"` |
| Especialidades | Plantillas versionadas y respuestas complementarias | `"especialidad"`, `"plantillaFormulario"`, `"respuestaFormulario"` |
| Auditoría | Acceso y cambios relevantes | `"eventoAuditoria"` |

Reglas de modelado:

- Usar identificadores internos UUID con nombres como `"idPersona"` y `"idConsultaMedica"`. La cédula no será la clave primaria; el paciente puede tener pasaporte, otro documento o no tener identificación al momento de atención.
- Asociar todo dato clínico a `"idOrganizacion"` y `"idPersona"`; las consultas incluyen profesional responsable, fechas y estado. Índices y restricciones deben impedir duplicados de identificador **dentro de la organización**, según tipo y país.
- Guardar alergias, diagnósticos, medicaciones y resultados como registros estructurados con estado, fechas, autor, fuente y terminología/código cuando exista. Permitir texto clínico donde sea necesario, sin inventar códigos.
- Separar **medicación que el paciente declara tomar** de **prescripción emitida**. Separar **resultado de examen** de **archivo adjunto**.
- Tratar la consulta cerrada como registro clínico estable: correcciones mediante enmienda con motivo, autor y fecha, sin sobrescritura silenciosa. El borrador admite edición controlada.
- Mantener plantillas de especialidad versionadas y respuestas vinculadas a la versión usada. El núcleo común conserva los datos compartidos; campos adicionales pueden almacenarse en JSON validado por esquema, sin desplazar entidades clínicas esenciales a un campo genérico.
- Registrar fecha clínica y fecha de captura por separado cuando puedan diferir; almacenar marcas de tiempo en UTC y mostrar la zona local en la interfaz.
- Diseñar identificadores y códigos de modo que en el futuro puedan mapearse a recursos HL7 FHIR (por ejemplo `Patient`, `Encounter`, `Condition`, `Observation`, `MedicationRequest`, `DocumentReference`), sin prometer una API FHIR completa en el MVP.

### Flujo clínico principal

1. Profesional autenticado selecciona su organización.
2. Busca por nombre o documento. Si hay coincidencias, el sistema pide elegir o revisar un posible duplicado; no fusiona historias automáticamente.
3. Abre la ficha y ve una vista resumida: alertas de alergias, problemas activos, medicación, últimas consultas y resultados recientes.
4. Crea una consulta en borrador, registra motivo, anamnesis, examen, evaluación, diagnósticos y plan. Los apartados complementarios dependen de la especialidad y de una plantilla versionada.
5. Adjunta resultados o documentos con tipo, fecha, autor/fuente y relación con la consulta cuando aplique.
6. Revisa y cierra la consulta. Un cierre registra autor y fecha, e impide la edición directa posterior.
7. La línea de tiempo muestra consultas, cambios, resultados y enmiendas en orden cronológico.

## 4. Contrato de API previsto para el frontend

Definir OpenAPI antes de construir pantallas definitivas. Rutas orientativas bajo `/api/v1`:

| Operación | Uso |
| --- | --- |
| `GET /me`, `GET /organizations/current` | Contexto y permisos del usuario |
| `GET /patients?query=`, `POST /patients`, `GET /patients/{id}`, `PATCH /patients/{id}` | Búsqueda y datos demográficos |
| `GET /patients/{id}/summary`, `GET /patients/{id}/timeline` | Vista rápida y evolución |
| `GET/POST /patients/{id}/allergies`, `/conditions`, `/medications` | Historia longitudinal |
| `GET/POST /patients/{id}/encounters`, `GET/PATCH /encounters/{id}` | Consultas y borradores |
| `POST /encounters/{id}/close`, `POST /encounters/{id}/amendments` | Cierre y correcciones |
| `GET/POST /patients/{id}/observations`, `/documents` | Resultados y documentos |
| `GET /specialties`, `GET /form-templates?specialty=...` | Secciones configurables |
| `POST /identity-lookups` | Consulta externa opcional, condicionada a convenio |

Convenciones: paginación por cursor en listas extensas, filtros explícitos, formato de error uniforme con código estable y `request_id`, validación de entrada, control de concurrencia para borradores (versión/ETag), y respuestas sin datos sensibles innecesarios. El frontend deberá poder distinguir `no encontrado`, `sin acceso`, `temporalmente no disponible` y `dato pendiente de confirmación`.

## 5. Seguridad, privacidad y obligaciones previas al uso real

Los datos de salud son datos sensibles según la Ley Orgánica de Protección de Datos Personales de Ecuador; las reglas de historia clínica exigen confidencialidad y acceso limitado a personal autorizado. Esto convierte la seguridad en requisito del MVP, no en una fase posterior. [Ley de Protección de Datos Personales](https://spdp.gob.ec/wp-content/uploads/2024/12/03.pdf.pdf), [Reglamento de información confidencial del Sistema Nacional de Salud](https://www.salud.gob.ec/wp-content/uploads/2022/09/A.M.-5216-Reglamento-de-informacion-confidencial-en-SNS.pdf).

Los veinte controles solicitados se convierten en requisitos de diseño y salida. Se aplicarán por defecto en NestJS, PostgreSQL, Docker y el pipeline; la etapa 1 no se considera terminada mientras los controles de autenticación, validación, aislamiento, secretos y configuración segura no estén implementados.

| N.º | Control | Aplicación prevista | Verificación de salida |
| --- | --- | --- | --- |
| 1 | Ocultar claves API | Secretos del servidor en variables inyectadas o gestor de secretos; nunca en frontend, respuestas, logs o imágenes Docker | Inspección del bundle y configuración de imagen; escaneo de secretos en CI |
| 2 | Eliminar secretos de Git | `.env` real ignorado; `.env.example` solo con valores ficticios; escaneo pre-commit/CI. Si un secreto ya se publicó, revocarlo y rotarlo; limpiar historial no reemplaza la rotación | Repositorio e historial escaneados; procedimiento de rotación documentado |
| 3 | Usar una clave pública de DB | La API y PostgreSQL se comunicarán con credenciales privadas que nunca salen del servidor. Si se adopta un proveedor que requiere clave publicable para el cliente, esa clave será solo identificador público con permisos mínimos y RLS; nunca será contraseña, secreto administrativo ni conexión directa irrestricta a PostgreSQL | Revisión de configuración que demuestra que el navegador no contiene credenciales privadas ni puede omitir la API |
| 4 | Activar RLS | Activar Row Level Security en todas las tablas con datos de organización/paciente. Políticas por `idOrganizacion` y usuario autenticado. El rol de runtime no será propietario de tablas ni tendrá `BYPASSRLS`; migraciones usarán rol separado. Establecer el contexto de organización con `SET LOCAL` dentro de cada transacción para evitar fuga entre conexiones del pool | Pruebas de aislamiento entre organizaciones, incluso con consultas SQL directas bajo el rol de runtime y con conexiones reutilizadas |
| 5 | Cifrar datos sensibles | TLS en tránsito, cifrado de almacenamiento y respaldos; cifrado a nivel de campo para identificadores/contactos cuando el diseño de búsqueda lo permita. Claves fuera de la DB, con política de acceso y rotación; índices de búsqueda sensibles deberán usar estrategia revisada (por ejemplo, HMAC con clave separada), no texto plano | Evidencia de cifrado, custodia de claves y prueba de recuperación |
| 6 | Forzar autenticación del servidor | Guards y validación de sesión/token en API; permisos calculados en servidor por usuario, rol y organización. El cliente no puede autodeclararse médico ni escoger permisos | Cada ruta privada rechaza llamadas sin sesión válida y verifica permiso del lado servidor |
| 7 | Restringir acceso a registros | Principio de menor privilegio; toda lectura/escritura de persona y consulta exige pertenencia activa a la organización y permiso concreto. Accesos excepcionales quedan auditados | Matriz rol-operación y casos de acceso permitido/denegado revisados |
| 8 | Bloquear manipulación de campos | DTOs con allowlist de campos; separar cambios demográficos, clínicos y administrativos; campos como `idOrganizacion`, autor, estado y auditoría los asigna el servidor, no el cuerpo enviado por el usuario | Solicitudes con campos protegidos añadidos o alterados son rechazadas/ignoradas según contrato y nunca elevan privilegios |
| 9 | Proteger cookies de sesión | Cookies `HttpOnly`, `Secure`, `SameSite` configurado según el flujo; protección CSRF para operaciones mutables si se usa autenticación por cookie; rotación y expiración de sesión | Cabeceras de cookie inspeccionadas y pruebas de sesión/CSRF |
| 10 | Hashear contraseñas | Argon2id con biblioteca mantenida y parámetros actualizables; nunca cifrado reversible ni almacenamiento/log de contraseñas | Revisión de esquema y flujo de registro/login; hashes verificados con herramienta estándar |
| 11 | Limitar intentos de inicio | Límite progresivo por cuenta e IP en login, recuperación y verificación; respuestas genéricas que no revelen si una cuenta existe; evitar bloqueos permanentes que faciliten denegación de servicio | Pruebas de umbral, ventana, bloqueo temporal y recuperación |
| 12 | Añadir protección contra bots | Rate limit y señales de riesgo; desafío accesible (CAPTCHA u opción equivalente) en registro, recuperación y actividad sospechosa, sin entorpecer cada consulta clínica | Simulación de abuso y revisión de accesibilidad del desafío |
| 13 | Monitorizar consultas de DB | Métricas de latencia, errores, pool y consultas lentas; habilitar `pg_stat_statements` donde corresponda; alertar sobre saturación. Logs sin nombres, cédulas, notas ni valores clínicos | Dashboard/alertas revisados y evidencia de que la instrumentación no registra PHI |
| 14 | Validar todas las entradas | Validación server-side de tipos, longitudes, formatos, rangos, enumeraciones y tamaños; normalización explícita de documentos y fechas; parámetros SQL | Contratos OpenAPI y validadores cubren parámetros, query, path, body y archivos |
| 15 | Escapar contenido del usuario | Consultas parametrizadas; texto plano por defecto; escape contextual en frontend al renderizar; si se permite texto enriquecido, sanitizador con allowlist. No ejecutar HTML suministrado | Revisión de puntos de renderizado y prueba de cargas XSS representativas |
| 16 | Restringir subida de archivos | Lista permitida de formatos, tamaño y cantidad; verificar MIME y firma del archivo; nombres generados por servidor; almacenamiento privado; antivirus cuando esté disponible; descarga con URL corta y autorización por paciente/organización | Archivos malformados, demasiado grandes o sin permiso se rechazan; objetos no son públicos |
| 17 | Limitar respuestas de API | DTOs de salida con campos permitidos, paginación obligatoria y tamaño máximo de página; evitar respuestas con datos de otras organizaciones o campos sensibles innecesarios | Revisión de OpenAPI y pruebas de paginación/proyección por rol |
| 18 | Añadir cabeceras de seguridad | HSTS en producción, CSP apropiada, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` y protección contra framing; configurar proxy de confianza explícitamente | Inspección de cabeceras en ambiente publicado |
| 19 | Forzar HTTPS | TLS en todo tráfico externo; redirigir HTTP a HTTPS en el proxy de entrada; HSTS después de validar dominio; cookies `Secure`; comunicación interna protegida según infraestructura | Escaneo de endpoints confirma HTTPS y ausencia de recursos/credenciales servidos por HTTP |
| 20 | Escanear dependencias | Lockfile obligatorio, análisis de vulnerabilidades de dependencias y secretos en CI, escaneo de imagen Docker, actualizaciones periódicas y proceso de priorización; generar SBOM para releases | Pipeline informa resultado y bloquea vulnerabilidades críticas según política acordada |

Controles adicionales para la historia clínica:

- Auditoría de accesos y cambios clínicos con actor, organización, persona, acción, fecha y correlación; sin guardar notas clínicas completas en logs. Acceso restringido a la auditoría.
- Copias de respaldo cifradas y prueba periódica de restauración; entornos de desarrollo y prueba con datos ficticios.
- Política documentada de retención, exportación, rectificación, incidentes y eliminación donde sea legalmente posible; revisar reglas exactas con asesoría jurídica y sanitaria antes de producción.
- Evaluar riesgos de privacidad, base jurídica aplicable, aviso al paciente y acuerdos con proveedores antes de tratar datos reales. Confirmar si corresponde delegado de protección de datos según escala y actividad.

**Hito de salida a producción:** revisión legal y clínica del flujo de historia, consentimientos/base jurídica, custodia, conservación, permisos profesionales y requisitos aplicables del Ministerio de Salud Pública. La [Agenda Digital de Salud 2023–2027](https://www.salud.gob.ec/wp-content/uploads/2023/06/Manual_Agenda_Digital_2023_Seg.pdf) cita los reglamentos de historia clínica electrónica y de historia clínica única; el detalle aplicable debe validarse para el tipo de establecimiento.

## 6. Microservicio de consulta por cédula: investigación y diseño

### Hallazgo que cambia el planteamiento

El [SRI describe el RUC](https://www.sri.gob.ec/registro-unico-de-contribuyentes-ruc) como registro de contribuyentes, no como padrón general de identidad. Por tanto, **no se debe asumir** que el SRI permite obtener los datos demográficos de cualquier paciente mediante su cédula, ni que exista una API pública oficial para este caso de uso. La [Dirección General de Registro Civil](https://www.registrocivil.gob.ec/wp-content/uploads/downloads/2023/02/Innovacion_servicios_gestion_identidad_personas_y_hechos_y_actos_civiles_medios_digitales.pdf) sí documenta servicios de validación/consulta demográfica por web service con solicitud, convenio y requisitos de confidencialidad. Este análisis distingue el propósito de ambas fuentes; no confirma aún que se otorgará acceso a este producto.

### Decisión propuesta

Nombrar la capacidad **verificación de identidad**, no “consulta SRI”. Hacer una fase de factibilidad antes de codificar un conector real:

1. Definir qué campos se necesitan para admitir a un paciente: por ejemplo, nombres, apellidos y fecha de nacimiento, sujetos a minimización. Evitar biometría y datos tributarios si no son necesarios para atención.
2. Consultar formalmente al SRI y al Registro Civil sobre fuente habilitada, finalidad permitida, contrato, costos, cuotas, autenticación, ambientes y condiciones de almacenamiento.
3. Obtener evaluación jurídica del uso de la fuente y documentar base legal/autorización, información al paciente y política de conservación de respuestas.
4. Probar el proveedor con un adaptador aislado, credenciales gestionadas como secretos y datos de prueba autorizados.
5. Activar la función solo cuando acceso y tratamiento estén confirmados; si no se consigue, mantener captura manual con validación local de formato y dígito verificador de cédula **sin afirmar que eso verifica la identidad**.

Contrato interno sugerido: `verifyIdentity(documentType, documentNumber, purpose, requesterContext) -> { status, fields, source, checkedAt, correlationId }`. Estados: `matched`, `not_found`, `unavailable`, `not_authorized`, `ambiguous`. El backend clínico consume este contrato sin conocer URLs ni credenciales del proveedor. La respuesta externa se muestra para **confirmación humana** antes de actualizar la ficha; se conserva la procedencia y no se sobrescriben silenciosamente datos clínicos o demográficos existentes.

Si el servicio externo falla, la consulta médica continúa. Aplicar tiempos de espera cortos, límites de llamadas, reintentos acotados, control de costos, auditoría de propósito y acceso, y no exponer el conector directamente al navegador. No basar una función de producción en scraping de portales o endpoints internos no documentados.

## 7. Hoja de ruta de implementación

Cada etapa debe terminar con software demostrable y criterios de salida. Las duraciones son **estimaciones orientativas para un equipo pequeño**, a revisar tras elegir alcance y equipo; no son compromisos de calendario.

| Etapa | Trabajo y entregable | Criterio de salida | Estimación |
| --- | --- | --- | --- |
| 0. Descubrimiento clínico y normativo | Entrevistar 2–3 especialidades, mapear formularios reales, roles, campos obligatorios, política de historia y amenazas; cerrar glosario y alcance MVP | Flujos aprobados por médicos piloto; decisiones legales abiertas registradas | 1–2 semanas |
| 1. Fundamentos | Crear proyecto Dockerizado, Compose local, PostgreSQL, migraciones con nombres españoles camelCase, CI, OpenAPI, autenticación, organizaciones, permisos, RLS, controles 1–20 y auditoría base | Pruebas de acceso entre organizaciones, escaneo de secretos/dependencias, cabeceras, configuración de cookies, validación y restauración de respaldo pasan | 3–4 semanas |
| 2. Pacientes e historia | Pacientes, documentos, búsqueda/duplicados, antecedentes, alergias, problemas y medicación declarada | Un médico puede crear y recuperar ficha completa sin mezclar organizaciones | 2–3 semanas |
| 3. Consultas | Borrador, diagnósticos, plan, prescripciones, cierre, enmiendas y línea de tiempo | Flujo completo de consulta y corrección con autoría verificable | 3–4 semanas |
| 4. Resultados y especialidades | Mediciones, informes, archivos seguros, plantillas versionadas; piloto con una especialidad general y una distinta | Ambas especialidades comparten núcleo y muestran sus campos propios sin migrar tablas por cada formulario | 2–3 semanas |
| 5. Preparación del frontend y piloto | Contrato OpenAPI congelado para MVP, datos ficticios, monitorización de DB, pruebas de carga básica, accesibilidad/uso del flujo, endurecimiento de contenedores y despliegue controlado | Escenarios clínicos y seguridad aprobados; observaciones del piloto priorizadas | 2–3 semanas |
| 6. Identidad externa | Factibilidad institucional/jurídica; luego adaptador y pruebas contractuales **si hay acceso oficial** | Búsqueda opcional con confirmación humana, auditoría y degradación segura | Variable; depende del convenio |

**Orden de dependencias:** 0 → 1 → 2 → 3 → 4 → 5. La investigación de la etapa 6 puede empezar en paralelo desde la etapa 0, pero su integración real no bloquea el MVP. El frontend puede iniciar wireframes y pruebas de usabilidad mientras se desarrolla la etapa 2; su conexión final debe partir del OpenAPI y los flujos estabilizados en 3–4.

### Primer lote de trabajo concreto

1. Validar el alcance con médicos de medicina general y otra especialidad elegida; recoger 3 casos de consulta completos por cada una.
2. Definir matriz de roles y permisos, responsable de datos por organización y política de acceso a historias.
3. Redactar diccionario de datos mínimo y estados de consulta; obtener revisión clínica.
4. Implementar la base NestJS, Docker Compose, PostgreSQL, esquema español camelCase y RLS.
5. Continuar con autenticación, permisos clínicos y módulos de pacientes e historia longitudinal antes de cargar datos reales.

### Estado de las entregas técnicas

Implementado: API NestJS, endpoints de salud/readiness, Docker Compose, PostgreSQL, migraciones versionadas, roles separados, validación global, Helmet, CORS por allowlist y limitación general de solicitudes. La autenticación ahora incluye login/logout, sesión opaca de 12 horas con hash, contraseñas Argon2id, cookies HttpOnly/SameSite, protección CSRF para métodos mutables, sesión actual, lista/selección de organizaciones y alta inicial de administrador sin registro público. Las migraciones 003/004 añaden sesiones, unicidad de correo normalizado y políticas RLS que exigen usuario autenticado y membresía vigente para datos de personas. Las instrucciones están en `README.md`.

Este avance es una base de autenticación y no habilita por sí solo el uso de datos reales. Faltan autorización granular por rol/acción, MFA, auditoría de accesos y cambios clínicos, cifrado de campos sensibles con gestión de claves, endurecimiento contra bots, expiración/invalidez por inactividad y administración de sesiones, monitorización de consultas, límites de respuesta, controles de archivos, TLS/HSTS en el entorno de despliegue, CI para secretos/dependencias/imagen, respaldo y restauración, y revisión legal/clínica. El bootstrap debe ejecutarse solo por un operador confiable y no debe quedar habilitado como un flujo habitual.

### Próximo incremento recomendado

1. Definir y persistir una matriz de permisos por rol, con rutas clínicas protegidas por `@RequireOrganization()` y validación de permisos de acción.
2. Implementar auditoría append-only de inicio/cierre de sesión, acceso a fichas y cambios, sin copiar notas clínicas a logs.
3. Implementar pacientes: alta, búsqueda paginada, detalle y actualización, siempre dentro de `withTenantTransaction`.
4. Añadir verificación de aislamiento entre organizaciones y casos de sesión/CSRF antes de ampliar el dominio clínico.
5. Después, desarrollar antecedentes y alergias; luego consultas y evolución.

## 8. Riesgos y decisiones pendientes

| Tema | Riesgo | Resolución propuesta |
| --- | --- | --- |
| Compartir pacientes entre médicos/centros | Acceso indebido o expectativas contradictorias de “historia única” | Aislamiento por organización en MVP; diseñar intercambio explícito en fase futura |
| Formularios de especialidad | Demasiada personalización dificulta búsqueda y mantenimiento | Núcleo clínico fijo + plantillas versionadas para extensiones |
| Identificación por cédula | Duplicados, pacientes extranjeros, menores sin documento, errores del proveedor | Identificador interno, varios tipos de documento y alta manual |
| Registro firmado/cerrado | Pérdida de trazabilidad por edición posterior | Estados y enmiendas auditables; validar requisitos de firma aplicables |
| Terminologías clínicas | Códigos incorrectos crean riesgo clínico | Comenzar con catálogos aprobados y texto complementario; definir ICD/CIE, LOINC, SNOMED según licencia y uso real |
| Fuente gubernamental | Acceso no concedido, costo o finalidad no autorizada | Factibilidad antes del desarrollo del conector; MVP independiente |
| Cumplimiento | Requisitos sanitarios y de datos pueden variar por tipo de prestador | Revisión legal y clínica antes del piloto con datos reales |

**Preguntas para cerrar el alcance:**

1. ¿El primer cliente será un médico independiente, un consultorio con varios profesionales o una red de centros?
2. ¿Qué dos especialidades participarán en el piloto y qué formularios usan hoy?
3. ¿Necesitan compartir historia entre organizaciones desde la primera versión o solo dentro de cada una?
4. ¿Qué país/jurisdicción y tipo de establecimiento tendrán en el primer despliegue?
5. ¿Qué datos exactos esperan obtener al ingresar la cédula y con qué fuente/convenio cuentan actualmente?

## 9. Referencias consultadas

- [SRI: Registro Único de Contribuyentes](https://www.sri.gob.ec/registro-unico-de-contribuyentes-ruc).
- [Registro Civil: requisitos para consulta de datos por web service](https://www.registrocivil.gob.ec/wp-content/uploads/downloads/2023/02/Innovacion_servicios_gestion_identidad_personas_y_hechos_y_actos_civiles_medios_digitales.pdf).
- [Superintendencia de Protección de Datos Personales: Ley Orgánica de Protección de Datos Personales](https://spdp.gob.ec/wp-content/uploads/2024/12/03.pdf.pdf).
- [Ministerio de Salud Pública: Reglamento de información confidencial en el Sistema Nacional de Salud](https://www.salud.gob.ec/wp-content/uploads/2022/09/A.M.-5216-Reglamento-de-informacion-confidencial-en-SNS.pdf).
- [Ministerio de Salud Pública: Agenda Digital de Salud 2023–2027](https://www.salud.gob.ec/wp-content/uploads/2023/06/Manual_Agenda_Digital_2023_Seg.pdf).
- [HL7 FHIR: Encounter](https://hl7.org/fhir/R5/encounter.html) y [DocumentReference](https://hl7.org/fhir/R5/documentreference.html), como referencia de interoperabilidad futura.

> Este documento es una propuesta de producto y arquitectura. Las conclusiones sobre fuente de identidad, custodia, firma, conservación y tratamiento de datos deben verificarse para la entidad operadora antes de usar información real.
