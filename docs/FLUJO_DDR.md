# Flujo DDR — Debida Diligencia Reforzada con segregación de funciones

## Principio

El flujo aplica el **principio de cuatro ojos**: ninguna persona controla el
proceso de punta a punta. Quien registra al cliente no lo investiga; quien
investiga no valida su propio trabajo; quien valida no toma la decisión final.

## Estados del caso DDR

```
ABIERTO ──asignar──▶ EN_REVISION ──enviar──▶ EN_REVISION_OFICIAL ──validar──▶ EN_APROBACION ──▶ APROBADO
                          ▲                        │                                        └──▶ RECHAZADO
                          └────────devolver────────┘
```

| Estado | Responsable | Acción disponible |
|---|---|---|
| `ABIERTO` | Oficial de Cumplimiento | Asignar analista (≠ registrador) |
| `EN_REVISION` | Analista asignado | Completar cuestionario EBR + documentos, enviar |
| `EN_REVISION_OFICIAL` | Oficial de Cumplimiento | Validar y escalar, o devolver con observaciones |
| `EN_APROBACION` | Gerente (ALTO) / Comité (MUY_ALTO) | Aprobar o rechazar |
| `APROBADO` / `RECHAZADO` | — | Cierre |

## Reglas que valida el backend

1. **El caso nace sin analista.** `create_expediente` abre el caso DDR con
   `analista_id = NULL` cuando el riesgo es ALTO o MUY_ALTO.
2. **Bloqueo de auto-asignación (409).** `PATCH /casos-ddr/{id}/asignar`
   rechaza al analista que registró el expediente.
3. **Solo el analista asignado envía (403).** `POST /enviar-aprobacion`
   verifica `caso.analista_id == current_user.id` y que el cuestionario EBR
   esté completo. El caso pasa a `EN_REVISION_OFICIAL` (no directo a
   aprobación) y limpia observaciones de devoluciones previas.
4. **Revisión del Oficial.** `POST /validar` (Oficial/Admin) escala a
   `EN_APROBACION` y registra `validado_por_id`. `POST /devolver`
   (observaciones mín. 10 caracteres) regresa a `EN_REVISION` y guarda
   `observaciones_oficial`, visibles para el analista.
5. **Decisión final por nivel.** Gerente de Cumplimiento aprueba/rechaza
   casos ALTO; Comité de Cumplimiento los MUY_ALTO. Rechazo exige
   observaciones (mín. 20 caracteres).
6. **Información completa para el revisor.** `GET /casos-ddr/{id}/expediente`
   expone el expediente KYC íntegro a los roles con acceso DDR
   (Oficial, Gerente, Comité, Auditor), sin depender de permisos del módulo KYC.
7. **Trazabilidad.** Toda transición se registra en la bitácora de auditoría
   (`registrar_auditoria`), incluida la subida de documentos con su autor.

## Pantallas del frontend

- **Casos DDR (lista):** filtros por estado (incluye "Revisión del Oficial")
  y por nivel ALTO / MUY_ALTO.
- **Detalle del caso:** cadena de revisión con el rol responsable de cada
  etapa, dossier completo del cliente (datos, banderas PEP / antecedentes /
  societarias, beneficiarios finales), respuestas del cuestionario EBR,
  documentos con hash SHA-256, y las acciones que correspondan al rol y
  estado actual.
- **Evaluación (analista):** cuestionario EBR + carga de documentos;
  al terminar envía el caso al Oficial de Cumplimiento.

## Cálculo de riesgo

El backend es la fuente de verdad (`app/kyc_risk.py`, pesos configurables en
Parámetros). El formulario KYC muestra una **estimación** con la misma fórmula
y pesos default; el valor definitivo se asigna al crear el expediente.

Umbrales: BAJO ≤ 20 · MEDIO ≤ 40 · ALTO ≤ 70 · MUY_ALTO > 70 puntos.
Un resultado ALTO o MUY_ALTO abre el caso DDR automáticamente.
