from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional
from pydantic import BaseModel

from app.database import get_db
from app.auth import require_cualquier_rol

router = APIRouter(prefix="/api/catalogo", tags=["Catalogo"])


class CategoriaCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None

class MaterialCreate(BaseModel):
    nombre_normalizado: str
    categoria_id: int
    unidad_estandar: Optional[str] = None
    descripcion: Optional[str] = None


@router.get("/categorias")
async def listar_categorias(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_cualquier_rol)
):
    sql = text("SELECT id, nombre, descripcion FROM categorias WHERE activo = true ORDER BY nombre")
    result = await db.execute(sql)
    return [dict(r) for r in result.mappings().all()]

@router.post("/categorias")
async def crear_categoria(
    data: CategoriaCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_cualquier_rol)
):
    sql = text("""
        INSERT INTO categorias (nombre, descripcion)
        VALUES (:nombre, :descripcion)
        RETURNING id, nombre, descripcion
    """)
    result = await db.execute(sql, {"nombre": data.nombre, "descripcion": data.descripcion})
    await db.commit()
    return dict(result.mappings().first())


@router.get("/materiales")
async def listar_materiales(
    categoria_id: Optional[int] = None,
    buscar: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_cualquier_rol)
):
    sql = text("""
        SELECT
            cm.id,
            cm.nombre_normalizado,
            cm.unidad_estandar,
            cm.descripcion,
            cm.precio_minimo,
            cm.precio_maximo,
            cm.precio_promedio,
            cm.ultima_compra_fecha,
            cm.ultima_compra_precio,
            cm.total_compras,
            c.nombre AS categoria
        FROM catalogo_materiales cm
        JOIN categorias c ON c.id = cm.categoria_id
        WHERE cm.activo = true
          AND (:cat IS NULL OR cm.categoria_id = :cat)
          AND (:buscar IS NULL OR LOWER(cm.nombre_normalizado) LIKE LOWER(:buscar))
        ORDER BY cm.nombre_normalizado
    """)
    buscar_like = f"%{buscar}%" if buscar else None
    result = await db.execute(sql, {"cat": categoria_id, "buscar": buscar_like})
    return [dict(r) for r in result.mappings().all()]

@router.post("/materiales")
async def crear_material(
    data: MaterialCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_cualquier_rol)
):
    check = await db.execute(
        text("SELECT id FROM catalogo_materiales WHERE LOWER(nombre_normalizado) = LOWER(:nombre)"),
        {"nombre": data.nombre_normalizado}
    )
    if check.first():
        raise HTTPException(status_code=400, detail="Ya existe un material con ese nombre")

    sql = text("""
        INSERT INTO catalogo_materiales (nombre_normalizado, categoria_id, unidad_estandar, descripcion)
        VALUES (:nombre, :cat, :unidad, :desc)
        RETURNING id, nombre_normalizado, unidad_estandar, descripcion
    """)
    result = await db.execute(sql, {
        "nombre": data.nombre_normalizado,
        "cat": data.categoria_id,
        "unidad": data.unidad_estandar,
        "desc": data.descripcion
    })
    await db.commit()
    return dict(result.mappings().first())

@router.get("/materiales/{material_id}/historial")
async def historial_precios(
    material_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_cualquier_rol)
):
    sql = text("""
        SELECT
            f.fecha_emision,
            fi.precio_unit_sin_igv,
            fi.cantidad,
            p.razon_social AS proveedor,
            p.ruc
        FROM factura_items fi
        JOIN facturas f ON f.id = fi.factura_id
        JOIN proveedores p ON p.id = f.proveedor_id
        WHERE fi.catalogo_id = :mid
          AND f.estado_verificacion = 'verificada'
          AND fi.precio_unit_sin_igv IS NOT NULL
        ORDER BY f.fecha_emision DESC
        LIMIT 50
    """)
    result = await db.execute(sql, {"mid": material_id})
    return [dict(r) for r in result.mappings().all()]
