from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from datetime import timedelta
from app.database import get_db
from app.models import Usuario
from app.auth import (
    verificar_password, hashear_password, crear_token,
    get_usuario_actual, require_admin
)
from app.config import settings

router = APIRouter(prefix="/api/auth", tags=["Autenticación"])

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    usuario: dict

class UsuarioCreate(BaseModel):
    nombre: str
    email: EmailStr
    password: str
    rol: str = "jefe_proyecto"

class UsuarioResponse(BaseModel):
    id: int
    nombre: str
    email: str
    rol: str
    activo: bool

@router.post("/login", response_model=TokenResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Usuario).where(Usuario.email == form_data.username)
    )
    usuario = result.scalar_one_or_none()

    if not usuario or not verificar_password(form_data.password, usuario.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
        )
    if not usuario.activo:
        raise HTTPException(status_code=403, detail="Usuario inactivo")

    token = crear_token(
        {"sub": str(usuario.id), "rol": usuario.rol},
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "usuario": {
            "id": usuario.id,
            "nombre": usuario.nombre,
            "email": usuario.email,
            "rol": usuario.rol,
        }
    }

@router.get("/me", response_model=UsuarioResponse)
async def get_me(usuario: Usuario = Depends(get_usuario_actual)):
    return usuario

@router.post("/usuarios", response_model=UsuarioResponse)
async def crear_usuario(
    data: UsuarioCreate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Usuario).where(Usuario.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="El email ya está registrado")

    usuario = Usuario(
        nombre=data.nombre,
        email=data.email,
        password_hash=hashear_password(data.password),
        rol=data.rol,
    )
    db.add(usuario)
    await db.flush()
    return usuario

@router.get("/usuarios", response_model=list[UsuarioResponse])
async def listar_usuarios(
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(require_admin)
):
    result = await db.execute(select(Usuario).order_by(Usuario.nombre))
    return result.scalars().all()
