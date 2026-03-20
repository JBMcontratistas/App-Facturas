from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from pydantic import BaseModel
from typing import Optional
from datetime import date

from app.database import get_db
from app.models import Proyecto, Proveedor, Categoria, CatalogoMaterial
from app.auth import require_admin, require_admin_o_jefe, require_cualquier_rol

# ══════════════════════════════════════════════════════════
# PROYECTOS
# ══════════════════════════════════════════════════════════
proyectos_router = APIRouter(prefix="/api/proyectos", tags=["Proyectos"])

class ProyectoCreate(BaseModel):
    codigo: Optional[str] = None
    nombre: str
    descripcion: Optional[str] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None

class ProyectoUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    estado: Optional[str] = None

@proyectos_router.get("/")
async def listar_proyectos(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_cualquier_rol)
):
    result = await db.execute(
        select(Proyecto).where(Proyecto.estado == "activo").order_by(Proyecto.nombre)
    )
    proyectos = result.scalars().all()
    return [
        {
            "id": p.id, "codigo": p.codigo, "nombre": p.nombre,
            "estado": p.estado, "fecha_inicio": p.fecha_inicio,
            "fecha_fin": p.fecha_fin,
        }
        for p in proyectos
    ]

@proyectos_router.post("/")
async def crear_proyecto(
    data: ProyectoCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin)
):
    proyecto = Proyecto(**data.model_dump())
    db.add(proyecto)
    await db.commit()
    await db.refresh(proyecto)
    return {"id": proyecto.id, "nombre": proyecto.nombre}

@proyectos_router.patch("/{proyecto_id}")
async def actualizar_proyecto(
    proyecto_id: int,
    data: ProyectoUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin)
):
    result = await db.execute(select(Proyecto).where(Proyecto.id == proyecto_id))
    proyecto = result.scalar_one_or_none()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    for campo, valor in data.model_dump(exclude_none=True).items():
        setattr(proyecto, campo, valor)

    await db.commit()
    return {"ok": True}


# ══════════════════════════════════════════════════════════
# PROVEEDORES
# ══════════════════════════════════════════════════════════
proveedores_router = APIRouter(prefix="/api/proveedores", tags=["Proveedores"])

@proveedores_router.get("/")
async def listar_proveedores(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_cualquier_rol)
):
    result = await db.execute(
        select(Proveedor).where(Proveedor.activo == True).order_by(Proveedor.razon_social)
    )
    proveedores = result.scalars().all()
    return [
        {
            "id": p.id, "ruc": p.ruc, "razon_social": p.razon_social,
            "telefono": p.telefono, "email": p.email,
        }
        for p in proveedores
    ]

@proveedores_router.get("/buscar")
async def buscar_proveedor_ruc(
    ruc: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin_o_jefe)
):
    """Busca un proveedor por RUC — útil para autocompletar en el formulario."""
    result = await db.execute(select(Proveedor).where(Proveedor.ruc == ruc))
    proveedor = result.scalar_one_or_none()
    if not proveedor:
        return {"encontrado": False}
    return {
        "encontrado": True,
        "ruc": proveedor.ruc,
        "razon_social": proveedor.razon_social,
        "direccion": proveedor.direccion,
    }


# ══════════════════════════════════════════════════════════
# CATÁLOGO DE MATERIALES
# ══════════════════════════════════════════════════════════
catalogo_router = APIRouter(prefix="/api/catalogo", tags=["Catálogo de materiales"])

class MaterialCreate(BaseModel):
    nombre_normalizado: str
    categoria_id: int
    unidad_estandar: Optional[str] = None
    descripcion: Optional[str] = None

@catalogo_router.get("/categorias")
async def listar_categorias(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_cualquier_rol)
):
    result = await db.execute(
        select(Categoria).where(Categoria.activo == True).order_by(Categoria.nombre)
    )
    return [{"id": c.id, "nombre": c.nombre} for c in result.scalars().all()]

@catalogo_router.get("/materiales")
async def listar_materiales(
    categoria_id: Optional[int] = None,
    buscar: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_cualquier_rol)
):
    query = select(CatalogoMaterial).where(CatalogoMaterial.activo == True)

    if categoria_id:
        query = query.where(CatalogoMaterial.categoria_id == categoria_id)
    if buscar:
        query = query.where(CatalogoMaterial.nombre_normalizado.ilike(f"%{buscar}%"))

    query = query.order_by(CatalogoMaterial.nombre_normalizado)
    result = await db.execute(query)
    materiales = result.scalars().all()

    return [
        {
            "id": m.id,
            "nombre": m.nombre_normalizado,
            "categoria_id": m.categoria_id,
            "unidad_estandar": m.unidad_estandar,
            "precio_minimo": float(m.precio_minimo) if m.precio_minimo else None,
            "precio_maximo": float(m.precio_maximo) if m.precio_maximo else None,
            "precio_promedio": float(m.precio_promedio) if m.precio_promedio else None,
            "ultima_compra_fecha": m.ultima_compra_fecha,
            "ultima_compra_precio": float(m.ultima_compra_precio) if m.ultima_compra_precio else None,
            "total_compras": m.total_compras,
        }
        for m in materiales
    ]

@catalogo_router.post("/materiales")
async def crear_material(
    data: MaterialCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_admin)
):
    material = CatalogoMaterial(**data.model_dump())
    db.add(material)
    await db.commit()
    await db.refresh(material)
    return {"id": material.id, "nombre": material.nombre_normalizado}

@catalogo_router.get("/materiales/{material_id}/historial")
async def historial_precios(
    material_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_cualquier_rol)
):
    """Retorna el historial de precios de un material a lo largo del tiempo."""
    sql = text("""
        SELECT
            f.fecha_emision,
            fi.precio_unit_sin_igv,
            fi.precio_unit_con_igv,
            fi.cantidad,
            p.razon_social AS proveedor,
            STRING_AGG(pr.nombre, ', ') AS proyectos
        FROM factura_items fi
        JOIN facturas f  ON f.id  = fi.factura_id
        JOIN proveedores p ON p.id = f.proveedor_id
        LEFT JOIN asignaciones_proyecto ap ON ap.factura_id = f.id
        LEFT JOIN proyectos pr ON pr.id = ap.proyecto_id
        WHERE fi.catalogo_id = :mid
          AND f.estado_verificacion = 'verificada'
        GROUP BY f.fecha_emision, fi.precio_unit_sin_igv,
                 fi.precio_unit_con_igv, fi.cantidad, p.razon_social
        ORDER BY f.fecha_emision DESC
        LIMIT 50
    """)
    result = await db.execute(sql, {"mid": material_id})
    rows = result.mappings().all()
    return [dict(r) for r in rows]
