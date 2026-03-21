from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from typing import Optional
from datetime import date

from app.database import get_db
from app.models import Factura, FacturaItem, Proveedor, AsignacionProyecto, Proyecto
from app.auth import get_usuario_actual, require_admin_o_jefe, require_cualquier_rol
from app.services.extraccion_ia import extraer_datos_pdf, hay_alertas
from app.services.onedrive import subir_pdf_onedrive, subir_pdf_onedrive_mock
from app.config import settings

router = APIRouter(prefix="/api/facturas", tags=["Facturas"])


class ItemVerificado(BaseModel):
    linea: int
    codigo_producto: Optional[str] = None
    descripcion: str
    unidad: Optional[str] = None
    cantidad: float
    precio_unit_con_igv: Optional[float] = None
    precio_unit_sin_igv: Optional[float] = None
    subtotal: float
    categoria_id: Optional[int] = None


class AsignacionInput(BaseModel):
    proyecto_id: int
    porcentaje: Optional[float] = None
    monto: Optional[float] = None
    nota: Optional[str] = None


class FacturaVerificada(BaseModel):
    numero_factura: str
    tipo_documento: str = "factura"
    proveedor_ruc: str
    proveedor_razon_social: str
    proveedor_direccion: Optional[str] = None
    proveedor_telefono: Optional[str] = None
    proveedor_email: Optional[str] = None
    fecha_emision: date
    fecha_vencimiento: Optional[date] = None
    moneda: str = "PEN"
    op_gravada: float = 0
    op_inafecta: float = 0
    op_exonerada: float = 0
    igv: float = 0
    total: float
    condicion_pago: Optional[str] = None
    nota: Optional[str] = None
    confianza_ia: Optional[float] = None
    items: list[ItemVerificado]
    asignaciones: list[AsignacionInput]


@router.post("/extraer")
async def extraer_factura(
    archivo: UploadFile = File(...),
    usuario=Depends(get_usuario_actual)
):
    if not archivo.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Solo se aceptan archivos PDF")

    MAX_SIZE = 10 * 1024 * 1024
    pdf_bytes = await archivo.read()
    if len(pdf_bytes) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="El archivo supera el limite de 10 MB")

    resultado = await extraer_datos_pdf(pdf_bytes, archivo.filename)

    if not resultado["ok"]:
        raise HTTPException(status_code=422, detail=resultado["error"])

    datos = resultado["datos"]
    return {
        "ok": True,
        "datos": datos,
        "tiene_alertas": hay_alertas(datos),
        "nombre_archivo": archivo.filename,
        "tamano_bytes": len(pdf_bytes),
    }


@router.post("/guardar")
async def guardar_factura(
    datos: FacturaVerificada,
    db: AsyncSession = Depends(get_db),
    usuario=Depends(require_admin_o_jefe)
):
    result = await db.execute(
        select(Factura).join(Proveedor).where(
            and_(
                Factura.numero_factura == datos.numero_factura,
                Proveedor.ruc == datos.proveedor_ruc
            )
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail="La factura " + datos.numero_factura + " de este proveedor ya existe"
        )

    result = await db.execute(
        select(Proveedor).where(Proveedor.ruc == datos.proveedor_ruc)
    )
    proveedor = result.scalar_one_or_none()
    if not proveedor:
        proveedor = Proveedor(
            ruc=datos.proveedor_ruc,
            razon_social=datos.proveedor_razon_social,
            direccion=datos.proveedor_direccion,
            telefono=datos.proveedor_telefono,
            email=datos.proveedor_email,
        )
        db.add(proveedor)
        await db.flush()
    else:
        proveedor.razon_social = datos.proveedor_razon_social

    factura = Factura(
        numero_factura=datos.numero_factura,
        tipo_documento=datos.tipo_documento,
        proveedor_id=proveedor.id,
        fecha_emision=datos.fecha_emision,
        fecha_vencimiento=datos.fecha_vencimiento,
        moneda=datos.moneda,
        op_gravada=datos.op_gravada,
        op_inafecta=datos.op_inafecta,
        op_exonerada=datos.op_exonerada,
        igv=datos.igv,
        total=datos.total,
        condicion_pago=datos.condicion_pago,
        estado_verificacion="verificada",
        nota=datos.nota,
        confianza_ia=datos.confianza_ia,
        subido_por=usuario.id,
    )
    db.add(factura)
    await db.flush()

    for item_data in datos.items:
        item = FacturaItem(
            factura_id=factura.id,
            linea=item_data.linea,
            codigo_producto=item_data.codigo_producto,
            descripcion=item_data.descripcion,
            unidad=item_data.unidad,
            cantidad=item_data.cantidad,
            precio_unit_con_igv=item_data.precio_unit_con_igv,
            precio_unit_sin_igv=item_data.precio_unit_sin_igv,
            subtotal=item_data.subtotal,
            categoria_id=item_data.categoria_id,
        )
        db.add(item)

    for asig_data in datos.asignaciones:
        result = await db.execute(
            select(Proyecto).where(Proyecto.id == asig_data.proyecto_id)
        )
        if not result.scalar_one_or_none():
            raise HTTPException(
                status_code=404,
                detail="Proyecto " + str(asig_data.proyecto_id) + " no encontrado"
            )
        asig = AsignacionProyecto(
            factura_id=factura.id,
            proyecto_id=asig_data.proyecto_id,
            porcentaje=asig_data.porcentaje,
            monto=asig_data.monto,
            nota=asig_data.nota,
        )
        db.add(asig)

    await db.commit()
    return {"ok": True, "factura_id": factura.id, "mensaje": "Factura guardada correctamente"}


@router.post("/subir-pdf/{factura_id}")
async def subir_pdf(
    factura_id: int,
    archivo: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    usuario=Depends(require_admin_o_jefe)
):
    result = await db.execute(
        select(Factura).options(
            selectinload(Factura.asignaciones).selectinload(AsignacionProyecto.proyecto)
        ).where(Factura.id == factura_id)
    )
    factura = result.scalar_one_or_none()
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    pdf_bytes = await archivo.read()

    nombre_proyecto = "Sin proyecto"
    if factura.asignaciones:
        nombre_proyecto = factura.asignaciones[0].proyecto.nombre

    fn = subir_pdf_onedrive_mock if settings.ENVIRONMENT == "development" else subir_pdf_onedrive
    resultado = await fn(pdf_bytes, archivo.filename, factura.fecha_emision, nombre_proyecto)

    factura.pdf_onedrive_url = resultado.get("url")
    factura.pdf_nombre_archivo = archivo.filename
    await db.commit()

    return {"ok": True, "url": resultado.get("url"), "mock": settings.ENVIRONMENT == "development"}


@router.get("/")
async def listar_facturas(
    pagina: int = 1,
    por_pagina: int = 20,
    proyecto_id: Optional[int] = None,
    proveedor_ruc: Optional[str] = None,
    desde: Optional[date] = None,
    hasta: Optional[date] = None,
    estado: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    usuario=Depends(require_cualquier_rol)
):
    query = (
        select(Factura)
        .options(selectinload(Factura.proveedor))
        .options(selectinload(Factura.asignaciones).selectinload(AsignacionProyecto.proyecto))
    )

    if proyecto_id:
        query = query.join(AsignacionProyecto).where(
            AsignacionProyecto.proyecto_id == proyecto_id
        )
    if proveedor_ruc:
        query = query.join(Proveedor).where(Proveedor.ruc == proveedor_ruc)
    if desde:
        query = query.where(Factura.fecha_emision >= desde)
    if hasta:
        query = query.where(Factura.fecha_emision <= hasta)
    if estado:
        query = query.where(Factura.estado_verificacion == estado)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar()

    query = query.order_by(Factura.fecha_emision.desc())
    query = query.offset((pagina - 1) * por_pagina).limit(por_pagina)

    result = await db.execute(query)
    facturas = result.scalars().all()

    return {
        "total": total,
        "pagina": pagina,
        "por_pagina": por_pagina,
        "facturas": [_serializar_factura(f) for f in facturas]
    }


@router.get("/{factura_id}")
async def obtener_factura(
    factura_id: int,
    db: AsyncSession = Depends(get_db),
    usuario=Depends(require_cualquier_rol)
):
    result = await db.execute(
        select(Factura)
        .options(selectinload(Factura.proveedor))
        .options(selectinload(Factura.items).selectinload(FacturaItem.categoria))
        .options(selectinload(Factura.asignaciones).selectinload(AsignacionProyecto.proyecto))
        .where(Factura.id == factura_id)
    )
    factura = result.scalar_one_or_none()
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    return _serializar_factura(factura, detalle=True)


def _serializar_factura(f: Factura, detalle: bool = False) -> dict:
    data = {
        "id": f.id,
        "numero_factura": f.numero_factura,
        "tipo_documento": f.tipo_documento,
        "fecha_emision": f.fecha_emision.isoformat() if f.fecha_emision else None,
        "fecha_vencimiento": f.fecha_vencimiento.isoformat() if f.fecha_vencimiento else None,
        "total": float(f.total),
        "igv": float(f.igv),
        "estado_verificacion": f.estado_verificacion,
        "nota": f.nota,
        "pdf_onedrive_url": f.pdf_onedrive_url,
        "confianza_ia": float(f.confianza_ia) if f.confianza_ia else None,
        "proveedor": {
            "id": f.proveedor.id,
            "ruc": f.proveedor.ruc,
            "razon_social": f.proveedor.razon_social,
        } if f.proveedor else None,
        "proyectos": [
            {
                "id": a.proyecto_id,
                "nombre": a.proyecto.nombre if a.proyecto else None,
                "porcentaje": float(a.porcentaje) if a.porcentaje else None,
                "monto": float(a.monto) if a.monto else None,
            }
            for a in (f.asignaciones or [])
        ],
    }
    if detalle:
        data["items"] = [
            {
                "linea": i.linea,
                "descripcion": i.descripcion,
                "unidad": i.unidad,
                "cantidad": float(i.cantidad),
                "precio_unit_con_igv": float(i.precio_unit_con_igv) if i.precio_unit_con_igv else None,
                "precio_unit_sin_igv": float(i.precio_unit_sin_igv) if i.precio_unit_sin_igv else None,
                "subtotal": float(i.subtotal),
                "categoria": i.categoria.nombre if i.categoria else None,
            }
            for i in (f.items or [])
        ]
    return data
