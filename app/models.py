from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Numeric,
    Date, DateTime, ForeignKey, CheckConstraint, UniqueConstraint
)
from sqlalchemy.orm import relationship, DeclarativeBase
from sqlalchemy.sql import func

class Base(DeclarativeBase):
    pass

class Categoria(Base):
    __tablename__ = "categorias"
    id        = Column(Integer, primary_key=True)
    nombre    = Column(String(100), nullable=False, unique=True)
    descripcion = Column(Text)
    activo    = Column(Boolean, default=True)
    creado_en = Column(DateTime, server_default=func.now())

    materiales = relationship("CatalogoMaterial", back_populates="categoria")

class Proyecto(Base):
    __tablename__ = "proyectos"
    id           = Column(Integer, primary_key=True)
    codigo       = Column(String(50), unique=True)
    nombre       = Column(String(200), nullable=False)
    descripcion  = Column(Text)
    fecha_inicio = Column(Date)
    fecha_fin    = Column(Date)
    estado       = Column(String(20), default="activo")
    creado_en    = Column(DateTime, server_default=func.now())

    asignaciones = relationship("AsignacionProyecto", back_populates="proyecto")

class Proveedor(Base):
    __tablename__ = "proveedores"
    id             = Column(Integer, primary_key=True)
    ruc            = Column(String(11), nullable=False, unique=True)
    razon_social   = Column(String(200), nullable=False)
    direccion      = Column(Text)
    telefono       = Column(String(50))
    email          = Column(String(100))
    activo         = Column(Boolean, default=True)
    creado_en      = Column(DateTime, server_default=func.now())
    actualizado_en = Column(DateTime, server_default=func.now(), onupdate=func.now())

    facturas = relationship("Factura", back_populates="proveedor")

class Usuario(Base):
    __tablename__ = "usuarios"
    id            = Column(Integer, primary_key=True)
    nombre        = Column(String(100), nullable=False)
    email         = Column(String(150), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    rol           = Column(String(30), default="jefe_proyecto")
    activo        = Column(Boolean, default=True)
    creado_en     = Column(DateTime, server_default=func.now())

class Factura(Base):
    __tablename__ = "facturas"
    id                  = Column(Integer, primary_key=True)
    numero_factura      = Column(String(50), nullable=False)
    tipo_documento      = Column(String(30), default="factura")
    proveedor_id        = Column(Integer, ForeignKey("proveedores.id"), nullable=False)
    fecha_emision       = Column(Date, nullable=False)
    fecha_vencimiento   = Column(Date)
    moneda              = Column(String(10), default="PEN")
    op_gravada          = Column(Numeric(12, 2), default=0)
    op_inafecta         = Column(Numeric(12, 2), default=0)
    op_exonerada        = Column(Numeric(12, 2), default=0)
    igv                 = Column(Numeric(12, 2), default=0)
    total               = Column(Numeric(12, 2), nullable=False)
    condicion_pago      = Column(String(50))
    estado_verificacion = Column(String(20), default="pendiente")
    nota                = Column(Text)
    pdf_onedrive_url    = Column(Text)
    pdf_nombre_archivo  = Column(String(255))
    confianza_ia        = Column(Numeric(5, 2))
    subido_por          = Column(Integer, ForeignKey("usuarios.id"))
    creado_en           = Column(DateTime, server_default=func.now())
    actualizado_en      = Column(DateTime, server_default=func.now(), onupdate=func.now())

    proveedor    = relationship("Proveedor", back_populates="facturas")
    items        = relationship("FacturaItem", back_populates="factura", cascade="all, delete-orphan")
    asignaciones = relationship("AsignacionProyecto", back_populates="factura", cascade="all, delete-orphan")

class FacturaItem(Base):
    __tablename__ = "factura_items"
    id                  = Column(Integer, primary_key=True)
    factura_id          = Column(Integer, ForeignKey("facturas.id"), nullable=False)
    linea               = Column(Integer, nullable=False)
    codigo_producto     = Column(String(50))
    descripcion         = Column(Text, nullable=False)
    unidad              = Column(String(30))
    cantidad            = Column(Numeric(12, 3), nullable=False)
    precio_unit_con_igv = Column(Numeric(12, 4))
    precio_unit_sin_igv = Column(Numeric(12, 4))
    subtotal            = Column(Numeric(12, 2), nullable=False)
    categoria_id        = Column(Integer, ForeignKey("categorias.id"))
    catalogo_id         = Column(Integer, ForeignKey("catalogo_materiales.id"))
    confianza_campo     = Column(Numeric(5, 2))
    creado_en           = Column(DateTime, server_default=func.now())

    factura  = relationship("Factura", back_populates="items")
    categoria = relationship("Categoria")
    catalogo  = relationship("CatalogoMaterial")

class AsignacionProyecto(Base):
    __tablename__ = "asignaciones_proyecto"
    id          = Column(Integer, primary_key=True)
    factura_id  = Column(Integer, ForeignKey("facturas.id"), nullable=False)
    proyecto_id = Column(Integer, ForeignKey("proyectos.id"), nullable=False)
    porcentaje  = Column(Numeric(5, 2))
    monto       = Column(Numeric(12, 2))
    nota        = Column(Text)
    creado_en   = Column(DateTime, server_default=func.now())

    factura  = relationship("Factura", back_populates="asignaciones")
    proyecto = relationship("Proyecto", back_populates="asignaciones")

class CatalogoMaterial(Base):
    __tablename__ = "catalogo_materiales"
    id                   = Column(Integer, primary_key=True)
    nombre_normalizado   = Column(String(200), nullable=False, unique=True)
    categoria_id         = Column(Integer, ForeignKey("categorias.id"), nullable=False)
    unidad_estandar      = Column(String(30))
    descripcion          = Column(Text)
    precio_minimo        = Column(Numeric(12, 4))
    precio_maximo        = Column(Numeric(12, 4))
    precio_promedio      = Column(Numeric(12, 4))
    ultima_compra_fecha  = Column(Date)
    ultima_compra_precio = Column(Numeric(12, 4))
    total_compras        = Column(Integer, default=0)
    activo               = Column(Boolean, default=True)
    creado_en            = Column(DateTime, server_default=func.now())
    actualizado_en       = Column(DateTime, server_default=func.now(), onupdate=func.now())

    categoria = relationship("Categoria", back_populates="materiales")

class Estimacion(Base):
    __tablename__ = "estimaciones"
    id             = Column(Integer, primary_key=True)
    nombre         = Column(String(200), nullable=False)
    proyecto_id    = Column(Integer, ForeignKey("proyectos.id"))
    descripcion    = Column(Text)
    estado         = Column(String(20), default="borrador")
    total          = Column(Numeric(12, 2))
    creado_por     = Column(Integer, ForeignKey("usuarios.id"))
    creado_en      = Column(DateTime, server_default=func.now())
    actualizado_en = Column(DateTime, server_default=func.now(), onupdate=func.now())

    items = relationship("EstimacionItem", back_populates="estimacion", cascade="all, delete-orphan")

class EstimacionItem(Base):
    __tablename__ = "estimacion_items"
    id               = Column(Integer, primary_key=True)
    estimacion_id    = Column(Integer, ForeignKey("estimaciones.id"), nullable=False)
    catalogo_id      = Column(Integer, ForeignKey("catalogo_materiales.id"))
    descripcion_libre = Column(Text)
    unidad           = Column(String(30))
    cantidad         = Column(Numeric(12, 3), nullable=False)
    precio_unitario  = Column(Numeric(12, 4), nullable=False)
    subtotal         = Column(Numeric(12, 2), nullable=False)
    nota             = Column(Text)
    orden            = Column(Integer)

    estimacion = relationship("Estimacion", back_populates="items")
    catalogo   = relationship("CatalogoMaterial")
