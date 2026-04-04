from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional, List
from pydantic import BaseModel

from app.database import get_db
from app.auth import require_cualquier_rol

router = APIRouter(prefix="/estimaciones", tags=["estimaciones"])


# ─── Schemas ────────────────────────────────────────────────────────────────

class EstimacionItemCreate(BaseModel):
    catalogo_id: Optional[int] = None
    descripcion_libre: Optional[str] = None
    unidad: str
    cantidad: float
    precio_unitario: float
    nota: Optional[str] = None
    orden: Optional[int] = 0


class EstimacionItemUpdate(BaseModel):
    catalogo_id: Optional[int] = None
    descripcion_libre: Optional[str] = None
    unidad: Optional[str] = None
    cantidad: Optional[float] = None
    precio_unitario: Optional[float] = None
    nota: Optional[str] = None
    orden: Optional[int] = None


class EstimacionCreate(BaseModel):
    nombre: str
    proyecto_id: Optional[int] = None
    descripcion: Optional[str] = None
    items: Optional[List[EstimacionItemCreate]] = []


class EstimacionUpdate(BaseModel):
    nombre: Optional[str] = None
    proyecto_id: Optional[int] = None
    descripcion: Optional[str] = None
    estado: Optional[str] = None


# ─── Helper ─────────────────────────────────────────────────────────────────

async def recalcular_total(db: AsyncSession, estimacion_id: int) -> float:
    result = await db.execute(
        text("SELECT cantidad, precio_unitario FROM estimacion_items WHERE estimacion_id = :eid"),
        {"eid": estimacion_id}
    )
    items = result.fetchall()
    total = sum(float(r.cantidad) * float(r.precio_unitario) for r in items)
    await db.execute(
        text("UPDATE estimaciones SET total = :total WHERE id = :eid"),
        {"total": total, "eid": estimacion_id}
    )
    await db.commit()
    return total


# ─── Endpoints ──────────────────────────────────────────────────────────────

@router.get("")
async def listar_estimaciones(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_cualquier_rol)
):
    result = await db.execute(text("""
        SELECT
            e.id, e.nombre, e.descripcion, e.estado, e.total,
            e.creado_por, e.created_at, e.proyecto_id,
            p.nombre AS proyecto_nombre,
            u.nombre AS creado_por_nombre
        FROM estimaciones e
        LEFT JOIN proyectos p ON p.id = e.proyecto_id
        LEFT JOIN usuarios u ON u.id = e.creado_por
        ORDER BY e.created_at DESC
    """))
    rows = result.fetchall()
    return [dict(r._mapping) for r in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
async def crear_estimacion(
    data: EstimacionCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_cualquier_rol)
):
    result = await db.execute(
        text("""
            INSERT INTO estimaciones (nombre, proyecto_id, descripcion, estado, total, creado_por)
            VALUES (:nombre, :proyecto_id, :descripcion, 'borrador', 0, :creado_por)
            RETURNING id
        """),
        {
            "nombre": data.nombre,
            "proyecto_id": data.proyecto_id,
            "descripcion": data.descripcion,
            "creado_por": current_user.id,
        }
    )
    await db.commit()
    estimacion_id = result.fetchone()[0]

    for idx, item in enumerate(data.items or []):
        subtotal = float(item.cantidad) * float(item.precio_unitario)
        await db.execute(
            text("""
                INSERT INTO estimacion_items
                    (estimacion_id, catalogo_id, descripcion_libre, unidad, cantidad, precio_unitario, subtotal, nota, orden)
                VALUES
                    (:eid, :cat_id, :desc_libre, :unidad, :cantidad, :precio_unitario, :subtotal, :nota, :orden)
            """),
            {
                "eid": estimacion_id,
                "cat_id": item.catalogo_id,
                "desc_libre": item.descripcion_libre,
                "unidad": item.unidad,
                "cantidad": item.cantidad,
                "precio_unitario": item.precio_unitario,
                "subtotal": subtotal,
                "nota": item.nota,
                "orden": item.orden if item.orden is not None else idx,
            }
        )
    await db.commit()

    if data.items:
        await recalcular_total(db, estimacion_id)

    return {"id": estimacion_id, "mensaje": "Estimación creada"}


@router.get("/catalogo/buscar")
async def buscar_catalogo(
    q: str = "",
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_cualquier_rol)
):
    result = await db.execute(
        text("""
            SELECT id, nombre_normalizado, unidad_estandar,
                   precio_promedio, ultima_compra_precio, precio_minimo, precio_maximo
            FROM catalogo_materiales
            WHERE nombre_normalizado ILIKE :q
            ORDER BY total_compras DESC
            LIMIT 20
        """),
        {"q": f"%{q}%"}
    )
    rows = result.fetchall()
    return [dict(r._mapping) for r in rows]


@router.get("/{estimacion_id}")
async def obtener_estimacion(
    estimacion_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_cualquier_rol)
):
    result = await db.execute(
        text("""
            SELECT
                e.id, e.nombre, e.descripcion, e.estado, e.total,
                e.creado_por, e.created_at, e.proyecto_id,
                p.nombre AS proyecto_nombre,
                u.nombre AS creado_por_nombre
            FROM estimaciones e
            LEFT JOIN proyectos p ON p.id = e.proyecto_id
            LEFT JOIN usuarios u ON u.id = e.creado_por
            WHERE e.id = :eid
        """),
        {"eid": estimacion_id}
    )
    est = result.fetchone()
    if not est:
        raise HTTPException(status_code=404, detail="Estimación no encontrada")

    items_result = await db.execute(
        text("""
            SELECT
                ei.id, ei.catalogo_id, ei.descripcion_libre, ei.unidad,
                ei.cantidad, ei.precio_unitario, ei.subtotal, ei.nota, ei.orden,
                cm.nombre_normalizado AS catalogo_nombre,
                cm.precio_promedio AS precio_referencia
            FROM estimacion_items ei
            LEFT JOIN catalogo_materiales cm ON cm.id = ei.catalogo_id
            WHERE ei.estimacion_id = :eid
            ORDER BY ei.orden ASC, ei.id ASC
        """),
        {"eid": estimacion_id}
    )
    items = items_result.fetchall()

    data = dict(est._mapping)
    data["items"] = [dict(i._mapping) for i in items]
    return data


@router.put("/{estimacion_id}")
async def actualizar_estimacion(
    estimacion_id: int,
    data: EstimacionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_cualquier_rol)
):
    result = await db.execute(
        text("SELECT id FROM estimaciones WHERE id = :eid"),
        {"eid": estimacion_id}
    )
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Estimación no encontrada")

    campos = {}
    if data.nombre is not None:
        campos["nombre"] = data.nombre
    if data.proyecto_id is not None:
        campos["proyecto_id"] = data.proyecto_id
    if data.descripcion is not None:
        campos["descripcion"] = data.descripcion
    if data.estado is not None:
        if data.estado not in ("borrador", "finalizada", "aprobada"):
            raise HTTPException(status_code=400, detail="Estado inválido")
        campos["estado"] = data.estado

    if campos:
        set_clause = ", ".join(f"{k} = :{k}" for k in campos)
        campos["eid"] = estimacion_id
        await db.execute(
            text(f"UPDATE estimaciones SET {set_clause} WHERE id = :eid"),
            campos
        )
        await db.commit()

    return {"mensaje": "Estimación actualizada"}


@router.delete("/{estimacion_id}")
async def eliminar_estimacion(
    estimacion_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_cualquier_rol)
):
    result = await db.execute(
        text("SELECT id FROM estimaciones WHERE id = :eid"),
        {"eid": estimacion_id}
    )
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Estimación no encontrada")

    await db.execute(text("DELETE FROM estimacion_items WHERE estimacion_id = :eid"), {"eid": estimacion_id})
    await db.execute(text("DELETE FROM estimaciones WHERE id = :eid"), {"eid": estimacion_id})
    await db.commit()
    return {"mensaje": "Estimación eliminada"}


# ─── Ítems ──────────────────────────────────────────────────────────────────

@router.post("/{estimacion_id}/items", status_code=status.HTTP_201_CREATED)
async def agregar_item(
    estimacion_id: int,
    item: EstimacionItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_cualquier_rol)
):
    result = await db.execute(
        text("SELECT id FROM estimaciones WHERE id = :eid"),
        {"eid": estimacion_id}
    )
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Estimación no encontrada")

    subtotal = float(item.cantidad) * float(item.precio_unitario)

    max_result = await db.execute(
        text("SELECT COALESCE(MAX(orden), -1) FROM estimacion_items WHERE estimacion_id = :eid"),
        {"eid": estimacion_id}
    )
    max_orden = max_result.scalar()

    insert_result = await db.execute(
        text("""
            INSERT INTO estimacion_items
                (estimacion_id, catalogo_id, descripcion_libre, unidad, cantidad, precio_unitario, subtotal, nota, orden)
            VALUES
                (:eid, :cat_id, :desc_libre, :unidad, :cantidad, :precio_unitario, :subtotal, :nota, :orden)
            RETURNING id
        """),
        {
            "eid": estimacion_id,
            "cat_id": item.catalogo_id,
            "desc_libre": item.descripcion_libre,
            "unidad": item.unidad,
            "cantidad": item.cantidad,
            "precio_unitario": item.precio_unitario,
            "subtotal": subtotal,
            "nota": item.nota,
            "orden": max_orden + 1,
        }
    )
    await db.commit()
    item_id = insert_result.fetchone()[0]
    total = await recalcular_total(db, estimacion_id)

    return {"id": item_id, "subtotal": subtotal, "total_estimacion": total}


@router.put("/{estimacion_id}/items/{item_id}")
async def actualizar_item(
    estimacion_id: int,
    item_id: int,
    data: EstimacionItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_cualquier_rol)
):
    result = await db.execute(
        text("SELECT id FROM estimacion_items WHERE id = :iid AND estimacion_id = :eid"),
        {"iid": item_id, "eid": estimacion_id}
    )
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Ítem no encontrado")

    campos = {}
    if data.catalogo_id is not None:
        campos["catalogo_id"] = data.catalogo_id
    if data.descripcion_libre is not None:
        campos["descripcion_libre"] = data.descripcion_libre
    if data.unidad is not None:
        campos["unidad"] = data.unidad
    if data.cantidad is not None:
        campos["cantidad"] = data.cantidad
    if data.precio_unitario is not None:
        campos["precio_unitario"] = data.precio_unitario
    if data.nota is not None:
        campos["nota"] = data.nota
    if data.orden is not None:
        campos["orden"] = data.orden

    if campos:
        if "cantidad" in campos or "precio_unitario" in campos:
            cur = await db.execute(
                text("SELECT cantidad, precio_unitario FROM estimacion_items WHERE id = :iid"),
                {"iid": item_id}
            )
            current = cur.fetchone()
            cant = campos.get("cantidad", float(current.cantidad))
            precio = campos.get("precio_unitario", float(current.precio_unitario))
            campos["subtotal"] = cant * precio

        set_clause = ", ".join(f"{k} = :{k}" for k in campos)
        campos["iid"] = item_id
        await db.execute(
            text(f"UPDATE estimacion_items SET {set_clause} WHERE id = :iid"),
            campos
        )
        await db.commit()

    total = await recalcular_total(db, estimacion_id)
    return {"mensaje": "Ítem actualizado", "total_estimacion": total}


@router.delete("/{estimacion_id}/items/{item_id}")
async def eliminar_item(
    estimacion_id: int,
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_cualquier_rol)
):
    result = await db.execute(
        text("SELECT id FROM estimacion_items WHERE id = :iid AND estimacion_id = :eid"),
        {"iid": item_id, "eid": estimacion_id}
    )
    if not result.fetchone():
        raise HTTPException(status_code=404, detail="Ítem no encontrado")

    await db.execute(text("DELETE FROM estimacion_items WHERE id = :iid"), {"iid": item_id})
    await db.commit()
    total = await recalcular_total(db, estimacion_id)
    return {"mensaje": "Ítem eliminado", "total_estimacion": total}
