from sqlmodel import Session, create_engine, select

from app import crud
from app.core.config import settings
from app.models import User, UserCreate, UserRole

engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))


# Usuarios demo sembrados para probar el control de acceso por rol.
# La contraseña es la misma del superusuario (entorno local).
DEMO_USERS: list[tuple[str, str, UserRole]] = [
    ("analista@example.com", "Analista DDR", UserRole.ANALISTA_DDR),
    ("oficial@example.com", "Oficial de Cumplimiento", UserRole.OFICIAL_CUMPLIMIENTO),
]


# make sure all SQLModel models are imported (app.models) before initializing DB
# otherwise, SQLModel might fail to initialize relationships properly
# for more details: https://github.com/fastapi/full-stack-fastapi-template/issues/28


def init_db(session: Session) -> None:
    # Tables should be created with Alembic migrations
    # But if you don't want to use migrations, create
    # the tables un-commenting the next lines
    # from sqlmodel import SQLModel

    # This works because the models are already imported and registered from app.models
    # SQLModel.metadata.create_all(engine)

    user = session.exec(
        select(User).where(User.email == settings.FIRST_SUPERUSER)
    ).first()
    if not user:
        user_in = UserCreate(
            email=settings.FIRST_SUPERUSER,
            password=settings.FIRST_SUPERUSER_PASSWORD,
            is_superuser=True,
            role=UserRole.ADMIN,
        )
        user = crud.create_user(session=session, user_create=user_in)
    elif user.role != UserRole.ADMIN:
        # Asegura que el superusuario siempre tenga rol ADMIN.
        user.role = UserRole.ADMIN
        session.add(user)
        session.commit()

    # Siembra usuarios demo por rol (solo si no existen aún).
    for email, full_name, role in DEMO_USERS:
        existing = crud.get_user_by_email(session=session, email=email)
        if not existing:
            crud.create_user(
                session=session,
                user_create=UserCreate(
                    email=email,
                    password=settings.FIRST_SUPERUSER_PASSWORD,
                    full_name=full_name,
                    role=role,
                ),
            )
