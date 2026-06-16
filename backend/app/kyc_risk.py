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

_PAISES_ALTO_RIESGO_GAFI = {
    "irán", "corea del norte", "myanmar", "cuba",
    "siria", "afghanistán", "afghanistan",
    "yemen", "libia", "iraq", "somalia",
    "sudán", "sudan", "zimbabwe", "venezuela",
    "laos", "camboya", "haití", "haiti",
    "etiopía", "etiopia", "malí", "mali",
    "burkina faso", "niger", "chad",
    "guyana", "surinam", "trinidad y tobago",
    "jamaica", "bahamas", "barbados",
    "islas vírgenes", "islas virgenes",
    "panamá", "panama", "costa rica",
    "nicaragua", "belice", "honduras",
    "guatemala", "el salvador", "república dominicana",
    "republica dominicana", "ecuador", "bolivia",
    "paraguay", "uruguay", "argentina",
    "brasil", "colombia", "perú", "peru",
    "chile", "méxico", "mexico",
}

_PANAMA = {"pa", "pan", "panama", "panamá"}


def _es_panama(pais: str | None) -> bool:
    return bool(pais) and pais.strip().lower() in _PANAMA  # type: ignore[union-attr]


def _es_alto_riesgo(pais: str | None) -> bool:
    if not pais:
        return False
    return pais.strip().lower() in _PAISES_ALTO_RIESGO_GAFI


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
        add("Cliente PEP", 40, pn.es_pep)
        add("Familiar de PEP", 20, pn.es_pep_familiar)
        add("Antecedentes penales", 25, pn.tiene_antecedentes)

        add(
            "País de residencia de alto riesgo",
            20,
            _es_alto_riesgo(pn.pais) and not _es_panama(pn.pais),
        )

        ingreso = pn.ingreso_mensual_aproximado or 0
        add("Ingresos 25k-50k", 15, 25000 <= ingreso < 50000)
        add("Ingresos 50k+", 15, ingreso >= 50000)

    pj = expediente.persona_juridica
    if pj is not None:
        add("Accionistas anónimos", 25, pj.tiene_accionistas_anonimos)
        add(
            "País de constitución de alto riesgo",
            20,
            _es_alto_riesgo(pj.pais_constitucion) and not _es_panama(pj.pais_constitucion),
        )
        add(
            "Opera en países de alto riesgo GAFI",
            20,
            pj.opera_en_paises_alto_riesgo,
        )

    bf_pep = sum(1 for bf in expediente.beneficiarios_final if bf.es_pep)
    if bf_pep:
        contribucion = min(bf_pep * 15, 45)
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

    if puntaje <= 20:
        nivel = RiskLevel.BAJO
    elif puntaje <= 40:
        nivel = RiskLevel.MEDIO
    elif puntaje <= 70:
        nivel = RiskLevel.ALTO
    else:
        nivel = RiskLevel.MUY_ALTO

    return RiesgoResult(nivel=nivel, puntaje=puntaje, factores=factores)
