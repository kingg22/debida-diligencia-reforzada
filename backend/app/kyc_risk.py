"""Cálculo de nivel de riesgo KYC (server-side).

Implementa la fórmula descrita en el briefing del módulo KYC. Devuelve el
puntaje (0-100), el nivel resultante y el desglose de factores que lo
determinaron (para mostrar en el Paso 4 del wizard y en el detalle).
"""

from app.models import (
    ExpedienteKYC,
    FactorRiesgo,
    RiesgoResult,
    RiskLevel,
)

_PANAMA = {"pa", "pan", "panama", "panamá"}


def _es_panama(pais: str | None) -> bool:
    return bool(pais) and pais.strip().lower() in _PANAMA  # type: ignore[union-attr]


def calcular_riesgo(expediente: ExpedienteKYC) -> RiesgoResult:
    factores: list[FactorRiesgo] = []
    puntaje = 0

    def add(factor: str, peso: int, activo: bool) -> None:
        nonlocal puntaje
        valor = 1 if activo else 0
        contribucion = peso * valor
        puntaje += contribucion
        factores.append(
            FactorRiesgo(
                factor=factor, peso=peso, valor=valor, contribucion=contribucion
            )
        )

    pn = expediente.persona_natural
    if pn is not None:
        add("Cliente PEP", 30, pn.es_pep)
        add("Familiar de PEP", 20, pn.es_pep_familiar)
        add("Antecedentes penales", 25, pn.tiene_antecedentes)
        add("País de residencia extranjero", 10, not _es_panama(pn.pais))
        add("Ingresos elevados", 5, pn.ingreso_mensual_aproximado > 10000)

    pj = expediente.persona_juridica
    if pj is not None:
        add("Accionistas anónimos", 25, pj.tiene_accionistas_anonimos)
        add("Opera en países de alto riesgo GAFI", 30, pj.opera_en_paises_alto_riesgo)
        add("País de constitución extranjero", 10, not _es_panama(pj.pais_constitucion))

    bf_pep = sum(1 for bf in expediente.beneficiarios_final if bf.es_pep)
    if bf_pep:
        contribucion = min(bf_pep * 15, 60)
        puntaje += contribucion
        factores.append(
            FactorRiesgo(
                factor=f"Beneficiarios finales PEP ({bf_pep})",
                peso=15,
                valor=bf_pep,
                contribucion=contribucion,
            )
        )

    puntaje = min(100, puntaje)

    if puntaje <= 25:
        nivel = RiskLevel.BAJO
    elif puntaje <= 50:
        nivel = RiskLevel.MEDIO
    elif puntaje <= 75:
        nivel = RiskLevel.ALTO
    else:
        nivel = RiskLevel.MUY_ALTO

    return RiesgoResult(nivel=nivel, puntaje=puntaje, factores=factores)
