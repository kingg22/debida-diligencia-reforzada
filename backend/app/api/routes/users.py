import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import col, delete, func, select

from app import crud
from app.api.deps import (
    CurrentUser,
    SessionDep,
    get_current_active_superuser,
    require_2fa_if_required_by_role,
    require_roles,
)
from app.auditoria import registrar_auditoria
from app.core.config import settings
from app.core.security import get_password_hash, verify_password
from app.models import (
    Item,
    Message,
    UpdatePassword,
    User,
    UserCreate,
    UserPublic,
    UserRegister,
    UsersPublic,
    UserRole,
    UserUpdate,
    UserUpdateMe,
)
from app.utils import generate_new_account_email, send_email

router = APIRouter(prefix="/users", tags=["users"])


@router.get(
    "/",
    dependencies=[
        Depends(require_roles(UserRole.ADMIN, UserRole.OFICIAL_CUMPLIMIENTO)),
        Depends(require_2fa_if_required_by_role),
    ],
    response_model=UsersPublic,
)
def read_users(session: SessionDep, skip: int = 0, limit: int = 100) -> Any:
    """Lista usuarios."""
    count_statement = select(func.count()).select_from(User)
    count = session.exec(count_statement).one()

    statement = (
        select(User).order_by(col(User.created_at).desc()).offset(skip).limit(limit)
    )
    users = session.exec(statement).all()

    users_public = [UserPublic.model_validate(user) for user in users]
    return UsersPublic(data=users_public, count=count)


@router.post(
    "/",
    dependencies=[
        Depends(get_current_active_superuser),
        Depends(require_2fa_if_required_by_role),
    ],
    response_model=UserPublic,
)
def create_user(
    *,
    session: SessionDep,
    user_in: UserCreate,
    request: Request,
    current_user: CurrentUser,
) -> Any:
    """Crea un nuevo usuario."""
    user = crud.get_user_by_email(session=session, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )

    user = crud.create_user(session=session, user_create=user_in)
    if settings.emails_enabled and user_in.email:
        email_data = generate_new_account_email(
            email_to=user_in.email, username=user_in.email, password=user_in.password
        )
        send_email(
            email_to=user_in.email,
            subject=email_data.subject,
            html_content=email_data.html_content,
        )
    registrar_auditoria(
        session=session,
        usuario_id=current_user.id,
        modulo="USUARIOS",
        accion="CREAR_USUARIO",
        entidad_tipo="usuario",
        entidad_id=user.id,
        descripcion=f"Usuario creado: {user.email} (rol {user.role.value})",
        ip_origen=request.client.host if request.client else None,
    )
    return user


@router.patch("/me", response_model=UserPublic)
def update_user_me(
    *, session: SessionDep, user_in: UserUpdateMe, current_user: CurrentUser
) -> Any:
    """Actualiza el propio usuario."""
    if user_in.email:
        existing_user = crud.get_user_by_email(session=session, email=user_in.email)
        if existing_user and existing_user.id != current_user.id:
            raise HTTPException(
                status_code=409, detail="User with this email already exists"
            )
    user_data = user_in.model_dump(exclude_unset=True)
    current_user.sqlmodel_update(user_data)
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return current_user


@router.patch("/me/password", response_model=Message)
def update_password_me(
    *, session: SessionDep, body: UpdatePassword, current_user: CurrentUser
) -> Any:
    """Actualiza la contraseña propia."""
    verified, _ = verify_password(body.current_password, current_user.hashed_password)
    if not verified:
        raise HTTPException(status_code=400, detail="Incorrect password")
    if body.current_password == body.new_password:
        raise HTTPException(
            status_code=400, detail="New password cannot be the same as the current one"
        )
    hashed_password = get_password_hash(body.new_password)
    current_user.hashed_password = hashed_password
    session.add(current_user)
    session.commit()
    return Message(message="Password updated successfully")


@router.get("/me", response_model=UserPublic)
def read_user_me(current_user: CurrentUser) -> Any:
    """Devuelve el usuario actual."""
    return current_user


@router.delete("/me", response_model=Message)
def delete_user_me(session: SessionDep, current_user: CurrentUser) -> Any:
    """Elimina el propio usuario."""
    if current_user.is_superuser:
        raise HTTPException(
            status_code=403, detail="Super users are not allowed to delete themselves"
        )
    session.delete(current_user)
    session.commit()
    return Message(message="User deleted successfully")


@router.post("/signup", response_model=UserPublic)
def register_user(session: SessionDep, user_in: UserRegister) -> Any:
    """Crea un nuevo usuario sin necesidad de estar logueado."""
    user = crud.get_user_by_email(session=session, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system",
        )
    user_create = UserCreate.model_validate(user_in)
    user = crud.create_user(session=session, user_create=user_create)
    return user


@router.get(
    "/{user_id}",
    dependencies=[Depends(require_2fa_if_required_by_role)],
    response_model=UserPublic,
)
def read_user_by_id(
    user_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
) -> Any:
    """Obtiene un usuario por id."""
    user = session.get(User, user_id)
    if user == current_user:
        return user
    if not current_user.is_superuser and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="The user doesn't have enough privileges",
        )
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.patch(
    "/{user_id}",
    dependencies=[
        Depends(get_current_active_superuser),
        Depends(require_2fa_if_required_by_role),
    ],
    response_model=UserPublic,
)
def update_user(
    *,
    session: SessionDep,
    user_id: uuid.UUID,
    user_in: UserUpdate,
    request: Request,
    current_user: CurrentUser,
) -> Any:
    """Actualiza un usuario."""
    db_user: User | None = session.get(User, user_id)
    if not db_user:
        raise HTTPException(
            status_code=404,
            detail="The user with this id does not exist in the system",
        )
    if user_in.email:
        existing_user = crud.get_user_by_email(session=session, email=user_in.email)
        if existing_user and existing_user.id != user_id:
            raise HTTPException(
                status_code=409, detail="User with this email already exists"
            )

    db_user = crud.update_user(session=session, db_user=db_user, user_in=user_in)
    registrar_auditoria(
        session=session,
        usuario_id=current_user.id,
        modulo="USUARIOS",
        accion="EDITAR_USUARIO",
        entidad_tipo="usuario",
        entidad_id=db_user.id,
        descripcion=f"Usuario editado: {db_user.email}",
        ip_origen=request.client.host if request.client else None,
    )
    return db_user


@router.delete(
    "/{user_id}",
    dependencies=[
        Depends(get_current_active_superuser),
        Depends(require_2fa_if_required_by_role),
    ],
    response_model=Message,
)
def delete_user(
    session: SessionDep,
    current_user: CurrentUser,
    user_id: uuid.UUID,
    request: Request,
) -> Message:
    """Desactiva (elimina) un usuario."""
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user == current_user:
        raise HTTPException(
            status_code=403, detail="Super users are not allowed to delete themselves"
        )
    statement = delete(Item).where(col(Item.owner_id) == user_id)
    session.exec(statement)
    session.delete(user)
    session.commit()
    registrar_auditoria(
        session=session,
        usuario_id=current_user.id,
        modulo="USUARIOS",
        accion="DESACTIVAR_USUARIO",
        entidad_tipo="usuario",
        entidad_id=user_id,
        descripcion=f"Usuario desactivado: {user.email}",
        ip_origen=request.client.host if request.client else None,
    )
    return Message(message="User deleted successfully")
