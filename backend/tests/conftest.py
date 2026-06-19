from collections.abc import Generator

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlmodel import Session, delete

from app.core.config import settings
from app.core.db import engine, init_db
from app.main import app
from app.models import (
    Auditoria,
    CasoDDR,
    DocumentoKYC,
    ExpedienteKYC,
    Item,
    ListaRestrictivaSimulada,
    PepSimulado,
    TwoFactorAuth,
    User,
)
from tests.utils.user import authentication_token_from_email
from tests.utils.utils import get_superuser_token_headers


@pytest.fixture(autouse=True, scope="session")
def _ensure_fernet_key() -> None:
    """Asegura que ``FERNET_KEY`` esté configurada antes de importar
    ``app.main`` (necesario para los tests 2FA que cifran/descifran
    secretos TOTP). En local se autogenera; aquí forzamos una clave
    estable para que sea persistente durante toda la sesión."""
    import os

    if not os.environ.get("FERNET_KEY"):
        os.environ["FERNET_KEY"] = Fernet.generate_key().decode()


@pytest.fixture(scope="session", autouse=True)
def db() -> Generator[Session, None, None]:
    with Session(engine) as session:
        init_db(session)
        yield session
        for model in (
            TwoFactorAuth,
            DocumentoKYC,
            CasoDDR,
            Auditoria,
            ExpedienteKYC,
            Item,
        ):
            session.execute(delete(model))
        session.execute(delete(ListaRestrictivaSimulada))
        session.execute(delete(PepSimulado))
        session.execute(delete(User))
        session.commit()


@pytest.fixture(scope="module")
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def superuser_token_headers(client: TestClient) -> dict[str, str]:
    return get_superuser_token_headers(client)


@pytest.fixture(scope="module")
def normal_user_token_headers(client: TestClient, db: Session) -> dict[str, str]:
    return authentication_token_from_email(
        client=client, email=settings.EMAIL_TEST_USER, db=db
    )
