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


_PESOS_DEFAULT: dict[str, int] = {
    "Cliente PEP": 40,
    "Familiar de PEP": 20,
    "Antecedentes penales": 25,
    "País de residencia de alto riesgo": 20,
    "Ingresos 25k-50k": 15,
    "Ingresos 50k+": 15,
    "Accionistas anónimos": 25,
    "País de constitución de alto riesgo": 20,
    "Opera en países de alto riesgo GAFI": 20,
    "Beneficiarios finales PEP": 15,
}


def calcular_riesgo(
    expediente: ExpedienteKYC,
    pesos: dict[str, int] | None = None,
) -> RiesgoResult:
    p = {**_PESOS_DEFAULT, **(pesos or {})}
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
        add("Cliente PEP", p["Cliente PEP"], pn.es_pep)
        add("Familiar de PEP", p["Familiar de PEP"], pn.es_pep_familiar)
        add("Antecedentes penales", p["Antecedentes penales"], pn.tiene_antecedentes)

        add(
            "País de residencia de alto riesgo",
            p["País de residencia de alto riesgo"],
            _es_alto_riesgo(pn.pais) and not _es_panama(pn.pais),
        )

        ingreso = pn.ingreso_mensual_aproximado or 0
        add("Ingresos 25k-50k", p["Ingresos 25k-50k"], 25000 <= ingreso < 50000)
        add("Ingresos 50k+", p["Ingresos 50k+"], ingreso >= 50000)

    pj = expediente.persona_juridica
    if pj is not None:
        add("Accionistas anónimos", p["Accionistas anónimos"], pj.tiene_accionistas_anonimos)
        add(
            "País de constitución de alto riesgo",
            p["País de constitución de alto riesgo"],
            _es_alto_riesgo(pj.pais_constitucion) and not _es_panama(pj.pais_constitucion),
        )
        add(
            "Opera en países de alto riesgo GAFI",
            p["Opera en países de alto riesgo GAFI"],
            pj.opera_en_paises_alto_riesgo,
        )

    bf_pep = sum(1 for bf in expediente.beneficiarios_final if bf.es_pep)
    peso_bf = p["Beneficiarios finales PEP"]
    if bf_pep:
        contribucion = min(bf_pep * peso_bf, peso_bf * 3)
        puntaje += contribucion
        factores.append(
            FactorRiesgo(
                factor=f"Beneficiarios finales PEP ({bf_pep})",
                peso=peso_bf,
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

    # Regla dura de cumplimiento: un cliente PEP (o con beneficiarios
    # finales PEP) es SIEMPRE al menos riesgo ALTO, sin importar el puntaje.
    hay_pep = (pn is not None and pn.es_pep) or bf_pep > 0
    if hay_pep and nivel in (RiskLevel.BAJO, RiskLevel.MEDIO):
        nivel = RiskLevel.ALTO

    return RiesgoResult(nivel=nivel, puntaje=puntaje, factores=factores)
