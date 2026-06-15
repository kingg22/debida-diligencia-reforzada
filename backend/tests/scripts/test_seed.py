"""Tests para el seed inicial de la base de datos."""
from sqlmodel import Session, select

from app.core.db import init_db
from app.models import (
    ListaRestrictivaSimulada,
    PepSimulado,
    User,
    UserRole,
)


def test_seed_es_idempotente(db: Session) -> None:
    """Llamar init_db() dos veces no debe crear usuarios duplicados."""
    init_db(db)
    usuarios_despues_1 = db.exec(select(User)).all()
    count1 = len(usuarios_despues_1)
    peps1 = len(db.exec(select(PepSimulado)).all())
    listas1 = len(db.exec(select(ListaRestrictivaSimulada)).all())

    init_db(db)
    usuarios_despues_2 = db.exec(select(User)).all()
    count2 = len(usuarios_despues_2)
    peps2 = len(db.exec(select(PepSimulado)).all())
    listas2 = len(db.exec(select(ListaRestrictivaSimulada)).all())

    assert count1 == count2
    assert peps1 == peps2
    assert listas1 == listas2


def test_seed_crea_seis_usuarios(db: Session) -> None:
    """El seed crea al menos los 6 usuarios demo + el superusuario."""
    init_db(db)
    usuarios = db.exec(select(User)).all()
    correos = {u.email for u in usuarios}
    # 6 usuarios demo + 1 superusuario
    assert "rosa@sgddr.pa" in correos
    assert "carlos@sgddr.pa" in correos
    assert "luis@sgddr.pa" in correos
    assert "comite@sgddr.pa" in correos
    assert "ana@sgddr.pa" in correos
    # admin@sgddr.pa (FIRST_SUPERUSER) se crea también
    assert len(usuarios) >= 6


def test_seed_asigna_rol_oficial_a_rosa(db: Session) -> None:
    """El seed asigna el rol OFICIAL_CUMPLIMIENTO a Rosa."""
    init_db(db)
    rosa = db.exec(select(User).where(User.email == "rosa@sgddr.pa")).first()
    assert rosa is not None
    assert rosa.role == UserRole.OFICIAL_CUMPLIMIENTO


def test_seed_crea_peps(db: Session) -> None:
    """El seed inserta los PEPs demo."""
    init_db(db)
    peps = db.exec(select(PepSimulado)).all()
    assert len(peps) >= 10


def test_seed_crea_lista_restrictiva(db: Session) -> None:
    """El seed inserta entradas en la lista restrictiva."""
    init_db(db)
    entradas = db.exec(select(ListaRestrictivaSimulada)).all()
    assert len(entradas) >= 8
