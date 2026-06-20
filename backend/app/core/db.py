import uuid

from sqlmodel import Session, create_engine, select

from app.core.config import settings
from app.core.security import get_password_hash
from app.models import (
    ListaRestrictivaSimulada,
    ParametroRiesgo,
    PepSimulado,
    User,
    UserRole,
)

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

USUARIOS_DEMO = [
    ("admin@sgddr.pa", "Admin SGDDR", "Admin123!", UserRole.ADMIN, True),
    ("rosa@sgddr.pa", "Rosa Méndez", "Demo123!", UserRole.OFICIAL_CUMPLIMIENTO, False),
    ("carlos@sgddr.pa", "Carlos Ruiz", "Demo123!", UserRole.ANALISTA_DDR, False),
    ("luis@sgddr.pa", "Luis Pérez", "Demo123!", UserRole.GERENTE_CUMPLIMIENTO, False),
    ("comite@sgddr.pa", "Comité SGDDR", "Demo123!", UserRole.COMITE_CUMPLIMIENTO, False),
    ("ana@sgddr.pa", "Ana Castillo", "Demo123!", UserRole.AUDITOR, False),
]

PEPS_DEMO = [
    (
        "Marco Aurelio Fonseca",
        "8-742-3891",
        "CEDULA_PA",
        "Panamá",
        "Exministro de Economía",
        "Ministerio de Economía y Finanzas",
    ),
    (
        "Elena Vásquez Torres",
        "PE-2847361",
        "PASAPORTE",
        "Perú",
        "Diputada Nacional",
        "Congreso de la República del Perú",
    ),
    (
        "Roberto Cifuentes",
        "8-123-4567",
        "CEDULA_PA",
        "Panamá",
        "Alcalde Municipal",
        "Municipio de Panamá",
    ),
    (
        "Adriana Moreno Leal",
        "CO-9182736",
        "PASAPORTE",
        "Colombia",
        "Exfiscal General",
        "Fiscalía General de la Nación",
    ),
    (
        "José Manuel Herrera",
        "VE-4729183",
        "PASAPORTE",
        "Venezuela",
        "Exgobernador Estado Bolívar",
        "Gobernación Estado Bolívar",
    ),
    (
        "Carmen Lucía Delgado",
        "8-891-2347",
        "CEDULA_PA",
        "Panamá",
        "Magistrada Tribunal Electoral",
        "Tribunal Electoral de Panamá",
    ),
    (
        "Fernando Augusto Ríos",
        "AR-3847291",
        "PASAPORTE",
        "Argentina",
        "Exsecretario de Hacienda",
        "Ministerio de Economía Argentina",
    ),
    (
        "Patricia Solano Vega",
        "9-234-5678",
        "CEDULA_PA",
        "Panamá",
        "Directora Autoridad Canal",
        "Autoridad del Canal de Panamá",
    ),
    (
        "Miguel Ángel Castillo",
        "MX-8273649",
        "PASAPORTE",
        "México",
        "Exsenador República",
        "Senado de la República de México",
    ),
    (
        "Diana Carolina Flores",
        "8-456-7890",
        "CEDULA_PA",
        "Panamá",
        "Viceministra de Salud",
        "Ministerio de Salud de Panamá",
    ),
]

LISTA_RESTRICTIVA_DEMO = [
    (
        "OFAC",
        "Carlos Eduardo Mendoza",
        "CO-1234567",
        "Colombia",
        "Narcotráfico y lavado de activos",
    ),
    (
        "OFAC",
        "Viktor Petrov",
        "RU-9876543",
        "Rusia",
        "Lavado de activos internacionales",
    ),
    (
        "ONU",
        "Al-Rashid Trading LLC",
        None,
        "EAU",
        "Financiamiento del terrorismo",
    ),
    (
        "ONU",
        "Ibrahim Hassan Al-Farsi",
        None,
        "Libia",
        "Proliferación de armas",
    ),
    (
        "UE",
        "Dimitri Volkov",
        "RU-5647382",
        "Rusia",
        "Evasión de sanciones internacionales",
    ),
    (
        "OFAC",
        "Luisa Fernanda Ospina",
        "CO-7382910",
        "Colombia",
        "Lavado de activos",
    ),
    (
        "ONU",
        "Pacific Shell Corp",
        None,
        "Panamá",
        "Empresa pantalla identificada",
    ),
    (
        "UE",
        "Hassan Al-Mansouri",
        None,
        "Irán",
        "Financiamiento del terrorismo",
    ),
]


def _seed_usuarios(session: Session) -> None:
    """Crea el superusuario inicial y los 6 usuarios demo si no existen."""
    superuser = session.exec(
        select(User).where(User.email == settings.FIRST_SUPERUSER)
    ).first()
    if not superuser:
        superuser = User(
            email=settings.FIRST_SUPERUSER,
            hashed_password=get_password_hash(settings.FIRST_SUPERUSER_PASSWORD),
            is_superuser=True,
            is_active=True,
            full_name="Superusuario",
            role=UserRole.ADMIN,
        )
        session.add(superuser)
        session.commit()

    for email, nombre, password, role, is_superuser in USUARIOS_DEMO:
        existing = session.exec(select(User).where(User.email == email)).first()
        if existing:
            continue
        user = User(
            email=email,
            hashed_password=get_password_hash(password),
            full_name=nombre,
            role=role,
            is_superuser=is_superuser,
            is_active=True,
        )
        session.add(user)
    session.commit()


def _seed_peps(session: Session) -> None:
    """Sembrado idempotente de PEPs simulados."""
    for (
        nombre_completo,
        numero_documento,
        tipo_documento,
        pais,
        cargo,
        institucion,
    ) in PEPS_DEMO:
        existing = session.exec(
            select(PepSimulado).where(
                PepSimulado.numero_documento == numero_documento
            )
        ).first()
        if existing:
            continue
        session.add(
            PepSimulado(
                nombre_completo=nombre_completo,
                numero_documento=numero_documento,
                tipo_documento=tipo_documento,
                pais=pais,
                cargo=cargo,
                institucion=institucion,
                activo=True,
            )
        )
    session.commit()


def _seed_lista_restrictiva(session: Session) -> None:
    """Sembrado idempotente de la lista restrictiva simulada."""
    for (
        fuente,
        nombre_completo,
        numero_documento,
        pais,
        motivo,
    ) in LISTA_RESTRICTIVA_DEMO:
        existing = session.exec(
            select(ListaRestrictivaSimulada).where(
                ListaRestrictivaSimulada.fuente == fuente,
                ListaRestrictivaSimulada.nombre_completo == nombre_completo,
            )
        ).first()
        if existing:
            continue
        session.add(
            ListaRestrictivaSimulada(
                fuente=fuente,
                nombre_completo=nombre_completo,
                numero_documento=numero_documento,
                pais=pais,
                motivo=motivo,
                activo=True,
            )
        )
    session.commit()


_PARAMETROS_RIESGO_DEFAULT = [
    ("Cliente PEP", "Persona Expuesta Políticamente (Ley 23/2015)", 40),
    ("Familiar de PEP", "Cónyuge o familiar directo de un PEP", 20),
    ("Antecedentes penales", "Cliente con antecedentes penales registrados", 25),
    ("País de residencia de alto riesgo", "Reside en país listado por GAFI como jurisdicción de alto riesgo", 20),
    ("Ingresos 25k-50k", "Ingreso mensual entre $25,000 y $50,000", 15),
    ("Ingresos 50k+", "Ingreso mensual mayor a $50,000", 15),
    ("Accionistas anónimos", "Empresa con acciones al portador o accionistas anónimos", 25),
    ("País de constitución de alto riesgo", "Empresa constituida en jurisdicción de alto riesgo GAFI", 20),
    ("Opera en países de alto riesgo GAFI", "Empresa con operaciones en países de alto riesgo", 20),
    ("Beneficiarios finales PEP", "Beneficiario final identificado como PEP (peso por cada uno, máx ×3)", 15),
]


def _seed_parametros_riesgo(session: Session) -> None:
    for factor, descripcion, peso in _PARAMETROS_RIESGO_DEFAULT:
        existing = session.exec(
            select(ParametroRiesgo).where(ParametroRiesgo.factor == factor)
        ).first()
        if existing:
            continue
        session.add(ParametroRiesgo(factor=factor, descripcion=descripcion, peso=peso))
    session.commit()


def init_db(session: Session) -> None:
    """Inicializa la base de datos con datos demo (idempotente)."""
    _seed_usuarios(session)
    _seed_peps(session)
    _seed_lista_restrictiva(session)
    _seed_parametros_riesgo(session)
