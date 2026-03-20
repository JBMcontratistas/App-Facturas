from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Optional
from datetime import date

from app.database import get_db
from app.auth import require_cualquier_rol

router = APIRouter(prefix="/api/reportes", tags=["Reportes"])

@router.get("/gastos-por-mes")
async def gastos_por_mes(
    anio: int,
    proyecto_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_cualquier_rol)
):
    """Gastos mensuales del año, opcionalmente filtrado por proyecto."""
    sql = text("""
        SELECT
            EXTRACT(MONTH FROM f.fecha_emision)::int AS mes,
            TO_CHAR(f.fecha_emision, 'Month') AS nombre_mes,
            COUNT(DISTINCT f.id) AS cantidad_facturas,
            SUM(CASE WHEN ap.proyecto_id = :pid OR :pid IS NULL
                THEN COALESCE(ap.monto, f.total) ELSE 0 END) AS total_gastado,
            SUM(f.igv) AS total_igv
        FROM facturas f
        LEFT JOIN asignaciones_proyecto ap ON ap.factura_id = f.id
        WHERE EXTRACT(YEAR FROM f.fecha_emision) = :anio
          AND f.estado_verificacion = 'verificada'
          AND (:pid IS NULL OR ap.proyecto_id = :pid)
        GROUP BY EXTRACT(MONTH FROM f.fecha_emision), TO_CHAR(f.fecha_emision, 'Month')
        ORDER BY mes
    """)
    result = await db.execute(sql, {"anio": anio, "pid": proyecto_id})
    return [dict(r) for r in result.mappings().all()]

@router.get("/gastos-por-proyecto")
async def gastos_por_proyecto(
    desde: Optional[date] = None,
    hasta: Optional[date] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_cualquier_rol)
):
    """Total gastado por proyecto en un rango de fechas."""
    sql = text("""
        SELECT
            pr.id AS proyecto_id,
            pr.nombre AS proyecto,
            COUNT(DISTINCT f.id) AS cantidad_facturas,
            SUM(COALESCE(ap.monto,
                ap.porcentaje / 100.0 * f.total,
                f.total)) AS total_gastado
        FROM asignaciones_proyecto ap
        JOIN facturas f  ON f.id  = ap.factura_id
        JOIN proyectos pr ON pr.id = ap.proyecto_id
        WHERE f.estado_verificacion = 'verificada'
          AND (:desde IS NULL OR f.fecha_emision >= :desde)
          AND (:hasta IS NULL OR f.fecha_emision <= :hasta)
        GROUP BY pr.id, pr.nombre
        ORDER BY total_gastado DESC
    """)
    result = await db.execute(sql, {"desde": desde, "hasta": hasta})
    return [dict(r) for r in result.mappings().all()]

@router.get("/ranking-proveedores")
async def ranking_proveedores(
    desde: Optional[date] = None,
    hasta: Optional[date] = None,
    limite: int = 10,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_cualquier_rol)
):
    """Proveedores ordenados por monto total facturado."""
    sql = text("""
        SELECT
            p.ruc,
            p.razon_social,
            COUNT(f.id) AS cantidad_facturas,
            SUM(f.total) AS total_facturado,
            MIN(f.fecha_emision) AS primera_compra,
            MAX(f.fecha_emision) AS ultima_compra
        FROM facturas f
        JOIN proveedores p ON p.id = f.proveedor_id
        WHERE f.estado_verificacion = 'verificada'
          AND (:desde IS NULL OR f.fecha_emision >= :desde)
          AND (:hasta IS NULL OR f.fecha_emision <= :hasta)
        GROUP BY p.ruc, p.razon_social
        ORDER BY total_facturado DESC
        LIMIT :limite
    """)
    result = await db.execute(sql, {"desde": desde, "hasta": hasta, "limite": limite})
    return [dict(r) for r in result.mappings().all()]

@router.get("/comparativo-precios/{catalogo_id}")
async def comparativo_precios(
    catalogo_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_cualquier_rol)
):
    """Evolución de precios de un material específico a lo largo del tiempo."""
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
        WHERE fi.catalogo_id = :cid
          AND f.estado_verificacion = 'verificada'
          AND fi.precio_unit_sin_igv IS NOT NULL
        ORDER BY f.fecha_emision ASC
    """)
    result = await db.execute(sql, {"cid": catalogo_id})
    return [dict(r) for r in result.mappings().all()]

@router.get("/resumen-dashboard")
async def resumen_dashboard(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_cualquier_rol)
):
    """Datos principales para el dashboard: mes actual vs anterior, top proveedores."""
    sql = text("""
        SELECT
            COUNT(*) FILTER (WHERE DATE_TRUNC('month', fecha_emision) = DATE_TRUNC('month', NOW()))
                AS facturas_este_mes,
            SUM(total) FILTER (WHERE DATE_TRUNC('month', fecha_emision) = DATE_TRUNC('month', NOW()))
                AS gasto_este_mes,
            COUNT(*) FILTER (WHERE DATE_TRUNC('month', fecha_emision) = DATE_TRUNC('month', NOW() - INTERVAL '1 month'))
                AS facturas_mes_anterior,
            SUM(total) FILTER (WHERE DATE_TRUNC('month', fecha_emision) = DATE_TRUNC('month', NOW() - INTERVAL '1 month'))
                AS gasto_mes_anterior,
            COUNT(*) FILTER (WHERE estado_verificacion = 'pendiente') AS facturas_pendientes
        FROM facturas
    """)
    result = await db.execute(sql)
    row = result.mappings().first()
    return dict(row) if row else {}
