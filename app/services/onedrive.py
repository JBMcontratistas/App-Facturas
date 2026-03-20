import httpx
import msal
from datetime import date
from app.config import settings

GRAPH_URL = "https://graph.microsoft.com/v1.0"

def _get_access_token() -> str:
    """Obtiene token de acceso a Microsoft Graph API."""
    app = msal.ConfidentialClientApplication(
        client_id=settings.ONEDRIVE_CLIENT_ID,
        client_credential=settings.ONEDRIVE_CLIENT_SECRET,
        authority=f"https://login.microsoftonline.com/{settings.ONEDRIVE_TENANT_ID}",
    )
    result = app.acquire_token_for_client(
        scopes=["https://graph.microsoft.com/.default"]
    )
    if "access_token" not in result:
        raise Exception(f"Error autenticando con OneDrive: {result.get('error_description')}")
    return result["access_token"]

def _ruta_carpeta(fecha_emision: date, nombre_proyecto: str) -> str:
    """
    Construye la ruta de carpeta: JBM Compras/2026/Marzo/Nombre Proyecto
    """
    meses = {
        1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
        5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
        9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
    }
    anio  = str(fecha_emision.year)
    mes   = meses[fecha_emision.month]
    base  = settings.ONEDRIVE_FOLDER_BASE
    # Sanitizar nombre de proyecto para uso en ruta
    proyecto_safe = nombre_proyecto.replace("/", "-").replace("\\", "-").strip()
    return f"{base}/{anio}/{mes}/{proyecto_safe}"

async def subir_pdf_onedrive(
    pdf_bytes: bytes,
    nombre_archivo: str,
    fecha_emision: date,
    nombre_proyecto: str
) -> dict:
    """
    Sube el PDF a OneDrive en la carpeta correcta.
    Retorna la URL de acceso al archivo.
    """
    try:
        token = _get_access_token()
        carpeta = _ruta_carpeta(fecha_emision, nombre_proyecto)
        ruta_completa = f"{carpeta}/{nombre_archivo}"

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/pdf",
        }

        # Upload directo (funciona hasta 4MB; para archivos mayores usar upload session)
        url = f"{GRAPH_URL}/me/drive/root:/{ruta_completa}:/content"

        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.put(url, headers=headers, content=pdf_bytes)
            response.raise_for_status()
            item = response.json()

        # Obtener enlace de descarga
        share_url = item.get("webUrl", "")

        return {
            "ok": True,
            "url": share_url,
            "ruta": ruta_completa,
            "item_id": item.get("id"),
        }

    except Exception as e:
        # No bloqueamos el flujo si OneDrive falla — guardamos el error
        return {
            "ok": False,
            "error": str(e),
            "url": None,
        }

async def subir_pdf_onedrive_mock(
    pdf_bytes: bytes,
    nombre_archivo: str,
    fecha_emision: date,
    nombre_proyecto: str
) -> dict:
    """
    Versión mock para desarrollo local (sin credenciales de OneDrive).
    Simula una subida exitosa.
    """
    carpeta = _ruta_carpeta(fecha_emision, nombre_proyecto)
    return {
        "ok": True,
        "url": f"https://onedrive.live.com/mock/{carpeta}/{nombre_archivo}",
        "ruta": f"{carpeta}/{nombre_archivo}",
        "item_id": "mock-id-123",
    }
