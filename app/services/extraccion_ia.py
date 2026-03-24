import anthropic
import base64
import json
import io
from app.config import settings

try:
    import pdfplumber
    PDFPLUMBER_DISPONIBLE = True
except ImportError:
    PDFPLUMBER_DISPONIBLE = False

client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

PROMPT_EXTRACCION = """Eres un asistente especializado en leer facturas electronicas peruanas (SUNAT).
Analiza el PDF adjunto y extrae TODOS los datos con maxima precision.

Responde UNICAMENTE con un JSON valido con esta estructura exacta (sin texto adicional, sin markdown):

{
  "confianza_general": 95,
  "tipo_documento": "factura",
  "proveedor": {
    "ruc": "20613675281",
    "razon_social": "GRUPO RIALVA S.A.C.",
    "direccion": "...",
    "telefono": "...",
    "email": "..."
  },
  "numero_factura": "F001-00002894",
  "fecha_emision": "2026-03-03",
  "fecha_vencimiento": "2026-03-03",
  "moneda": "PEN",
  "condicion_pago": "Contado",
  "op_gravada": 2677.12,
  "op_inafecta": 0.00,
  "op_exonerada": 0.00,
  "igv": 481.88,
  "total": 3159.00,
  "items": [
    {
      "linea": 1,
      "codigo_producto": "",
      "descripcion": "KG. DE. CAUCHO. GRANULADO",
      "unidad": "NIU",
      "cantidad": 1700,
      "precio_unit_con_igv": 1.86,
      "precio_unit_sin_igv": 1.57,
      "subtotal": 3159.00,
      "confianza_campo": 98
    }
  ],
  "campos_baja_confianza": []
}

REGLAS IMPORTANTES:
- tipo_documento: "factura", "recibo_honorarios", "boleta" u "otro"
- fechas en formato YYYY-MM-DD
- montos como numeros decimales (sin simbolo S/ ni comas de miles)
- Si un campo no existe en el documento, usar null
- precio_unit_con_igv = precio que aparece en columna P.UNIT de la factura
- precio_unit_sin_igv = precio en columna SIN IGV (si existe), si no: calcular dividiendo entre 1.18
- confianza_general: 0-100 segun que tan legible y completo esta el documento
- confianza_campo por item: 0-100 segun legibilidad de esa linea especifica
- campos_baja_confianza: lista de nombres de campos con confianza menor a 70
"""

PROMPT_TEXTO_PLANO = """Eres un asistente especializado en leer facturas electronicas peruanas (SUNAT).
A continuacion tienes el texto extraido de una factura PDF. Parsea los datos y responde UNICAMENTE con JSON valido.

TEXTO DE LA FACTURA:
{texto}

Usa exactamente esta estructura (sin texto adicional, sin markdown):

{
  "confianza_general": 90,
  "tipo_documento": "factura",
  "proveedor": {
    "ruc": "...",
    "razon_social": "...",
    "direccion": "...",
    "telefono": "...",
    "email": "..."
  },
  "numero_factura": "...",
  "fecha_emision": "YYYY-MM-DD",
  "fecha_vencimiento": "YYYY-MM-DD",
  "moneda": "PEN",
  "condicion_pago": "...",
  "op_gravada": 0.00,
  "op_inafecta": 0.00,
  "op_exonerada": 0.00,
  "igv": 0.00,
  "total": 0.00,
  "items": [],
  "campos_baja_confianza": []
}

REGLAS: fechas YYYY-MM-DD, montos sin S/ ni comas, null si no existe el campo.
"""


def _extraer_texto_pdf(pdf_bytes: bytes):
    if not PDFPLUMBER_DISPONIBLE:
        return None
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            texto_total = ""
            for pagina in pdf.pages:
                texto = pagina.extract_text()
                if texto:
                    texto_total += texto + "\n"
        texto_limpio = texto_total.strip()
        if len(texto_limpio) < 100:
            return None
        return texto_limpio
    except Exception:
        return None


async def _extraer_con_texto(texto: str, nombre_archivo: str) -> dict:
    prompt = PROMPT_TEXTO_PLANO.format(texto=texto[:8000])
    try:
        message = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}]
        )
        respuesta_texto = message.content[0].text.strip()
        if respuesta_texto.startswith("```"):
            lineas = respuesta_texto.split("\n")
            respuesta_texto = "\n".join(lineas[1:-1])
        datos = json.loads(respuesta_texto)
        datos["nombre_archivo_original"] = nombre_archivo
        datos["metodo_extraccion"] = "texto_plano"
        datos.setdefault("confianza_general", 85)
        datos.setdefault("campos_baja_confianza", [])
        datos.setdefault("items", [])
        _marcar_campos_baja_confianza(datos)
        return {"ok": True, "datos": datos}
    except json.JSONDecodeError as e:
        return {"ok": False, "error": "Error parseando JSON del texto", "detalle": str(e)}
    except Exception as e:
        return {"ok": False, "error": "Error en extraccion por texto", "detalle": str(e)}


async def _extraer_con_vision(pdf_bytes: bytes, nombre_archivo: str) -> dict:
    pdf_base64 = base64.standard_b64encode(pdf_bytes).decode("utf-8")
    try:
        message = await client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=4096,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "document",
                            "source": {
                                "type": "base64",
                                "media_type": "application/pdf",
                                "data": pdf_base64,
                            },
                        },
                        {"type": "text", "text": PROMPT_EXTRACCION}
                    ],
                }
            ],
        )
        respuesta_texto = message.content[0].text.strip()
        if respuesta_texto.startswith("```"):
            lineas = respuesta_texto.split("\n")
            respuesta_texto = "\n".join(lineas[1:-1])
        datos = json.loads(respuesta_texto)
        datos["nombre_archivo_original"] = nombre_archivo
        datos["metodo_extraccion"] = "vision_ia"
        datos.setdefault("confianza_general", 80)
        datos.setdefault("campos_baja_confianza", [])
        datos.setdefault("items", [])
        _marcar_campos_baja_confianza(datos)
        return {"ok": True, "datos": datos}
    except json.JSONDecodeError as e:
        return {"ok": False, "error": "La IA no pudo estructurar los datos del PDF", "detalle": str(e)}
    except Exception as e:
        import traceback
        return {
            "ok": False,
            "error": "Error al procesar el PDF",
            "detalle": str(e),
            "traceback": traceback.format_exc()
        }


async def extraer_datos_pdf(pdf_bytes: bytes, nombre_archivo: str) -> dict:
    texto = _extraer_texto_pdf(pdf_bytes)
    if texto:
        resultado = await _extraer_con_texto(texto, nombre_archivo)
        if not resultado["ok"]:
            resultado = await _extraer_con_vision(pdf_bytes, nombre_archivo)
    else:
        resultado = await _extraer_con_vision(pdf_bytes, nombre_archivo)
    return resultado


def _marcar_campos_baja_confianza(datos: dict):
    campos_criticos = [
        ("numero_factura", datos.get("numero_factura")),
        ("proveedor.ruc", datos.get("proveedor", {}).get("ruc")),
        ("proveedor.razon_social", datos.get("proveedor", {}).get("razon_social")),
        ("fecha_emision", datos.get("fecha_emision")),
        ("total", datos.get("total")),
    ]
    baja_confianza = set(datos.get("campos_baja_confianza", []))
    for campo, valor in campos_criticos:
        if not valor:
            baja_confianza.add(campo)
    if datos.get("confianza_general", 100) < 70:
        for item in datos.get("items", []):
            item["confi
