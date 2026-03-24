from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers.auth import router as auth_router
from app.routers.facturas import router as facturas_router
from app.routers.otros import proyectos_router, proveedores_router
from app.routers.reportes import router as reportes_router
from app.routers.catalogo import router as catalogo_router

app = FastAPI(
    title="JBM Compras API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(facturas_router)
app.include_router(proyectos_router)
app.include_router(proveedores_router)
app.include_router(catalogo_router)
app.include_router(reportes_router)

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "app": "JBM Compras", "version": "1.0.0"}
