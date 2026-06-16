import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock

import pytest

from app.kyc_risk import calcular_riesgo
from app.models import (
    BeneficiarioFinal,
    ExpedienteKYC,
    PersonaJuridica,
    PersonaNatural,
    RiskLevel,
)


def _make_expediente(**kwargs) -> ExpedienteKYC:
    exp = MagicMock(spec=ExpedienteKYC)
    exp.id = uuid.uuid4()
    exp.persona_natural = None
    exp.persona_juridica = None
    exp.beneficiarios_final = []
    for k, v in kwargs.items():
        setattr(exp, k, v)
    return exp


def _make_pn(**overrides) -> PersonaNatural:
    defaults = dict(
        tipo_documento="CEDULA",
        numero_documento="1-123-456",
        fecha_expiracion_doc="2030-12-31",
        nacionalidad="Panameña",
        pais_nacimiento="Panamá",
        nombre="Juan",
        apellido="Pérez",
        fecha_nacimiento="1990-01-01",
        genero="M",
        estado_civil="SOLTERO",
        telefono="6000-1234",
        email="juan@test.com",
        direccion="Calle 1",
        ciudad="Panamá",
        pais="Panamá",
        ocupacion="Ingeniero",
        empleador="Tech Corp",
        ingreso_mensual_aproximado=5000,
        fuente_ingresos="Salario",
        es_pep=False,
        es_pep_familiar=False,
        tiene_antecedentes=False,
    )
    defaults.update(overrides)
    pn = MagicMock(spec=PersonaNatural)
    for k, v in defaults.items():
        setattr(pn, k, v)
    return pn


def _make_pj(**overrides) -> PersonaJuridica:
    defaults = dict(
        razon_social="Tech Corp",
        ruc="123456789",
        tipo_sociedad="SA",
        fecha_constitucion="2020-01-01",
        pais_constitucion="Panamá",
        numero_registro_mercantil="RM-123",
        nombre_representante="Carlos",
        cedula_representante="8-123-456",
        cargo_representante="Director",
        telefono_empresa="300-1234",
        email_empresa="corp@test.com",
        direccion_fiscal="Av 1",
        ciudad="Panamá",
        pais="Panamá",
        actividad_economica="Tecnología",
        ingreso_anual_aproximado=500000,
        cantidad_empleados=50,
        tiene_accionistas_anonimos=False,
        opera_en_paises_alto_riesgo=False,
    )
    defaults.update(overrides)
    pj = MagicMock(spec=PersonaJuridica)
    for k, v in defaults.items():
        setattr(pj, k, v)
    return pj


def _make_bf(**overrides) -> BeneficiarioFinal:
    defaults = dict(
        nombre="Pedro",
        apellido="García",
        fecha_nacimiento="1985-05-15",
        cedula="3-456-789",
        porcentaje_participacion=50,
        es_pep=False,
    )
    defaults.update(overrides)
    bf = MagicMock(spec=BeneficiarioFinal)
    for k, v in defaults.items():
        setattr(bf, k, v)
    return bf


class TestPesosRiesgo:
    def test_pep_peso_40(self):
        exp = _make_expediente(persona_natural=_make_pn(es_pep=True))
        result = calcular_riesgo(exp)
        pep = [f for f in result.factores if "PEP" in f.factor and "Familiar" not in f.factor][0]
        assert pep.peso == 40
        assert pep.contribucion == 40

    def test_familiar_pep_peso_20(self):
        exp = _make_expediente(persona_natural=_make_pn(es_pep_familiar=True))
        result = calcular_riesgo(exp)
        fp = [f for f in result.factores if "Familiar de PEP" in f.factor][0]
        assert fp.peso == 20
        assert fp.contribucion == 20

    def test_antecedentes_peso_25(self):
        exp = _make_expediente(persona_natural=_make_pn(tiene_antecedentes=True))
        result = calcular_riesgo(exp)
        ant = [f for f in result.factores if "Antecedentes" in f.factor][0]
        assert ant.peso == 25
        assert ant.contribucion == 25

    def test_pais_alto_riesgo_peso_20(self):
        exp = _make_expediente(persona_natural=_make_pn(pais="Irán"))
        result = calcular_riesgo(exp)
        pais = [f for f in result.factores if "alto riesgo" in f.factor.lower()][0]
        assert pais.peso == 20
        assert pais.contribucion == 20

    def test_pais_panama_no_suma_riesgo(self):
        exp = _make_expediente(persona_natural=_make_pn(pais="Panamá"))
        result = calcular_riesgo(exp)
        pais = [f for f in result.factores if "alto riesgo" in f.factor.lower()]
        assert len(pais) == 0 or pais[0].contribucion == 0

    def test_ingresos_25k_a_50k_peso_15(self):
        exp = _make_expediente(persona_natural=_make_pn(ingreso_mensual_aproximado=30000))
        result = calcular_riesgo(exp)
        ing = [f for f in result.factores if "25k-50k" in f.factor][0]
        assert ing.peso == 15
        assert ing.contribucion == 15

    def test_ingresos_50k_plus_peso_15(self):
        exp = _make_expediente(persona_natural=_make_pn(ingreso_mensual_aproximado=60000))
        result = calcular_riesgo(exp)
        ing = [f for f in result.factores if "50k+" in f.factor][0]
        assert ing.peso == 15
        assert ing.contribucion == 15

    def test_ingresos_bajo_no_aplica(self):
        exp = _make_expediente(persona_natural=_make_pn(ingreso_mensual_aproximado=5000))
        result = calcular_riesgo(exp)
        ing_25k = [f for f in result.factores if "25k-50k" in f.factor][0]
        ing_50k = [f for f in result.factores if "50k+" in f.factor][0]
        assert ing_25k.contribucion == 0
        assert ing_50k.contribucion == 0

    def test_pj_accionistas_anonimos_peso_25(self):
        exp = _make_expediente(persona_juridica=_make_pj(tiene_accionistas_anonimos=True))
        result = calcular_riesgo(exp)
        acc = [f for f in result.factores if "Accionistas" in f.factor][0]
        assert acc.peso == 25
        assert acc.contribucion == 25

    def test_pj_pais_alto_riesgo_peso_20(self):
        exp = _make_expediente(persona_juridica=_make_pj(pais_constitucion="Cuba"))
        result = calcular_riesgo(exp)
        pais = [f for f in result.factores if "constitución" in f.factor.lower()][0]
        assert pais.peso == 20
        assert pais.contribucion == 20

    def test_pj_opera_alto_riesgo_peso_20(self):
        exp = _make_expediente(persona_juridica=_make_pj(opera_en_paises_alto_riesgo=True))
        result = calcular_riesgo(exp)
        op = [f for f in result.factores if "Opera" in f.factor][0]
        assert op.peso == 20
        assert op.contribucion == 20

    def test_beneficiarios_pep_max_45(self):
        bfs = [_make_bf(es_pep=True) for _ in range(5)]
        exp = _make_expediente(beneficiarios_final=bfs)
        result = calcular_riesgo(exp)
        bf_factor = [f for f in result.factores if "Beneficiarios" in f.factor][0]
        assert bf_factor.contribucion == 45

    def test_beneficiarios_pep_uno(self):
        bfs = [_make_bf(es_pep=True)]
        exp = _make_expediente(beneficiarios_final=bfs)
        result = calcular_riesgo(exp)
        bf_factor = [f for f in result.factores if "Beneficiarios" in f.factor][0]
        assert bf_factor.contribucion == 15


class TestUmbralesNivel:
    def test_bajo_0(self):
        exp = _make_expediente(persona_natural=_make_pn())
        result = calcular_riesgo(exp)
        assert result.nivel == RiskLevel.BAJO
        assert result.puntaje == 0

    def test_bajo_20(self):
        exp = _make_expediente(persona_natural=_make_pn(es_pep_familiar=True))
        result = calcular_riesgo(exp)
        assert result.nivel == RiskLevel.BAJO
        assert result.puntaje == 20

    def test_medio_40(self):
        exp = _make_expediente(
            persona_natural=_make_pn(
                es_pep_familiar=True,
                pais="Siria",
            )
        )
        result = calcular_riesgo(exp)
        assert result.nivel == RiskLevel.MEDIO
        assert result.puntaje == 40

    def test_alto_70(self):
        exp = _make_expediente(
            persona_natural=_make_pn(
                es_pep=True,
                tiene_antecedentes=True,
            )
        )
        result = calcular_riesgo(exp)
        assert result.nivel == RiskLevel.ALTO
        assert result.puntaje == 65

    def test_muy_alto_80(self):
        exp = _make_expediente(
            persona_natural=_make_pn(
                es_pep=True,
                tiene_antecedentes=True,
                es_pep_familiar=True,
            )
        )
        result = calcular_riesgo(exp)
        assert result.nivel == RiskLevel.MUY_ALTO
        assert result.puntaje == 85

    def test_puntaje_maximo_100(self):
        bfs = [_make_bf(es_pep=True) for _ in range(10)]
        exp = _make_expediente(
            persona_natural=_make_pn(
                es_pep=True,
                tiene_antecedentes=True,
                es_pep_familiar=True,
                pais="Siria",
            ),
            beneficiarios_final=bfs,
        )
        result = calcular_riesgo(exp)
        assert result.puntaje <= 100

    def test_ningun_factor_bajo(self):
        exp = _make_expediente(persona_natural=_make_pn())
        result = calcular_riesgo(exp)
        assert result.nivel == RiskLevel.BAJO
        assert result.puntaje == 0
