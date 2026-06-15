# Bitácora de Desarrollo - Módulo DDR

## Estado actual
- **Fecha inicio:** 2026-06-14
- **Estado:** En progreso
- **Desarrollador:** Dev 2 (Backend Core)

## Lo que ya existe (Emily - commit 6028605)

### Modelos KYC (app/models.py)
- ✅ `UserRole` enum (ADMIN, OFICIAL_CUMPLIMIENTO, ANALISTA_DDR, GERENTE_CUMPLIMIENTO, COMITE_CUMPLIMIENTO, AUDITOR)
- ✅ `ClientType` enum (NATURAL, JURIDICA)
- ✅ `RiskLevel` enum (BAJO, MEDIO, ALTO, MUY_ALTO)
- ✅ `KYCStatus` enum (BORRADOR, PENDIENTE, EN_REVISION, APROBADO, RECHAZADO, DDR_INICIADO)
- ✅ `DocumentoTipo` enum (10 tipos de documentos)
- ✅ `DocumentoEstado` enum (PENDIENTE, VALIDADO, RECHAZADO)
- ✅ `PersonaNatural` + `PersonaNaturalBase` + `PersonaNaturalCreate` + `PersonaNaturalPublic`
- ✅ `PersonaJuridica` + `PersonaJuridicaBase` + `PersonaJuridicaCreate` + `PersonaJuridicaPublic`
- ✅ `BeneficiarioFinal` + `BeneficiarioFinalBase` + `BeneficiarioFinalCreate` + `BeneficiarioFinalPublic`
- ✅ `DocumentoKYC` + `DocumentoKYCPublic`
- ✅ `ExpedienteKYC` + `ExpedienteKYCCreate` + `ExpedienteKYCUpdate` + `ExpedienteKYCPublic` + `ExpedientesKYCPublic`
- ✅ `FactorRiesgo` + `RiesgoResult` + `ListaCoincidencia` + `ListasResult`

### Motor de riesgo (app/kyc_risk.py)
- ✅ Implementado con pesos diferentes al spec:
  - PEP: 30 (spec dice 40)
  - Familiar PEP: 20 (no está en spec)
  - Antecedentes: 25 (no está en spec)
  - País extranjero: 10 (spec dice 20 por país alto riesgo)
  - Ingresos >10k: 5 (spec dice 15 por rangos 25k-50k, 50k+)
  - Accionistas anónimos: 25 (está en spec)
  - País alto riesgo GAFI: 30 (está en spec)
  - País constitución extranjero: 10 (está en spec)
  - Beneficiarios PEP: 15 c/u, max 60 (spec dice 15 c/u, max 45)
- ⚠️ **NECESITA AJUSTE** según spec del task plan

### Endpoints clientes (app/api/routes/clientes.py)
- ✅ `POST /clientes/` - Crear expediente
- ✅ `GET /clientes/` - Listar con filtros y paginación
- ✅ `GET /clientes/{id}` - Detalle expediente
- ✅ `PATCH /clientes/{id}` - Actualizar estado
- ✅ `POST /clientes/{id}/documentos` - Subir documento
- ✅ `DELETE /clientes/{id}/documentos/{doc_id}` - Eliminar documento
- ✅ `POST /clientes/{id}/evaluar-riesgo` - Recalcular riesgo
- ✅ `GET /clientes/{id}/verificar-listas` - Stub de verificación

### CRUD (app/crud.py)
- ✅ `generar_codigo_expediente()` - Código secuencial KYC-2026-0001
- ✅ `create_expediente()` - Crear con personas, beneficiarios, riesgo
- ✅ `get_expediente()` - Obtener por ID
- ✅ `recalcular_riesgo_expediente()` - Recalcular riesgo

### Dependencias (app/api/deps.py)
- ✅ `require_roles()` - Control de acceso por rol

### Migración
- ✅ `804feedfad7a_add_kyc_tables.py` - Tablas KYC

## Pendiente (lo que me corresponde a mí)

### Tarea 1 - Corregir motor de riesgo
- [x] Ajustar pesos según spec:
  - PEP: 40 ✅
  - País alto riesgo GAFI: 20 ✅
  - Ingresos 25k-50k o 50k+: 15 ✅
- [x] Agregar lista fija PAISES_ALTO_RIESGO ✅
- [ ] Agregar campo `proposito_relacion` a PersonaNatural (requiere migración)
- [x] Ajustar umbrales: ≤20 BAJO, ≤40 MEDIO, ≤70 ALTO, >70 MUY_ALTO ✅

### Tarea 2 - Modelos CasoDDR + CuestionarioEBR
- [x] Crear `EstadoCasoDDR` enum ✅
- [x] Crear modelo `CasoDDR` ✅
- [x] Crear modelo `CuestionarioEBR` ✅
- [x] Agregar relationship en ExpedienteKYC ✅
- [x] Crear schemas Pydantic ✅
- [x] Generar migración Alembic ✅ (69feb88c7960)

### Tarea 3 - Validaciones en create_expediente
- [x] Validar formato cédula panameña (regex) ✅
- [x] Validar mayoría de edad ✅

### Tarea 5 - Crear CasoDDR automáticamente
- [x] Lógica en crud.create_expediente() para crear caso cuando riesgo ALTO/MUY_ALTO ✅

### Tarea 6 - SHA-256 en documentos
- [x] Campo `hash_sha256` agregado a DocumentoKYC ✅ (en migración 69feb88c7960)
- [x] Calcular hash en upload (clientes.py + casos_ddr.py) ✅

### Tarea 7 - Router /casos-ddr
- [x] Crear `app/api/routes/casos_ddr.py` ✅
- [x] GET /casos-ddr (con filtro por rol) ✅
- [x] GET /casos-ddr/{id} ✅
- [x] PATCH /casos-ddr/{id}/asignar ✅
- [x] POST /casos-ddr/{id}/enviar-aprobacion ✅
- [x] Registrar en api/main.py ✅

### Tarea 8 - Endpoints Cuestionario EBR
- [x] GET /casos-ddr/{id}/cuestionario ✅
- [x] PATCH /casos-ddr/{id}/cuestionario ✅

### Tarea 9 - Documentos DDR
- [x] Campo `caso_ddr_id` agregado a DocumentoKYC ✅ (en migración 69feb88c7960)
- [x] POST /casos-ddr/{id}/documentos (upload) ✅
- [x] GET /casos-ddr/{id}/documentos (listado) ✅

## Completado
- [x] Clonar repositorio
- [x] Crear AGENTS.md
- [x] Levantar proyecto con Docker
- [x] Verificar backend funcional
- [x] Revisar cambios de Emily
- [x] Fix circular ref models.py — backend starts OK
- [x] Verificar endpoints DDR en OpenAPI
- [x] Corregir motor de riesgo (pesos + umbrales)
- [x] Agregar lista PAISES_ALTO_RIESGO
- [x] Modelos CasoDDR + CuestionarioEBR (con migración)
- [x] Router /casos-ddr (GET, PATCH asignar, POST enviar-aprobacion, GET/PATCH cuestionario)
- [x] Validación cédula panameña + mayoría de edad
- [x] Auto-crear CasoDDR para riesgo ALTO/MUY_ALTO
- [x] SHA-256 hash en upload de documentos
- [x] Endpoints documentos DDR (upload + list)
- [x] 34 tests backend (20 unit + 14 integration) - todos pasando
- [x] 25 tests E2E Playwright - todos pasando
- [x] Fix: Paginated interface (data/count vs items/total) — frontend <--> backend
- [x] Fix: Login error banner (onSettled reseteaba estado de error)
- [x] Fix: Usuario admin faltante en DB
- [x] Fix: StorageState vacío para tests de login/roles
- [x] Frontend reconstruido (docker compose up --build frontend)

## Dependencias Dev 3
| Componente | Estado |
|------------|--------|
| Tabla PepSimulado | Pendiente |
| Tabla ListaRestrictivaSimulada | Pendiente |
| Helper registrar_auditoria() | Pendiente |
| Endpoints /aprobar y /rechazar | Pendiente |

## Notas
- El frontend usa nginx con dist/ pre-construido — reconstruir con `docker compose up -d --build frontend` después de cambios
- Tests E2E requieren backend + frontend corriendo
- El formulario KYC paso 3 requiere documentos obligatorios (no se puede skip en tests)
- Labels del formulario KYC no tienen `for`/`id` — usar selectores por posición o placeholder
