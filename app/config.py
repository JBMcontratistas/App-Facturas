from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra='ignore')

    # Base de datos
    DATABASE_URL: str
    # Claude API
    ANTHROPIC_API_KEY: str
    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    # OneDrive
    ONEDRIVE_CLIENT_ID: str = ""
    ONEDRIVE_CLIENT_SECRET: str = ""
    ONEDRIVE_TENANT_ID: str = ""
    ONEDRIVE_FOLDER_BASE: str = "JBM Compras"
    # CORS
    FRONTEND_URL: str = "http://localhost:3000"
    # Entorno
    ENVIRONMENT: str = "development"

@lru_cache()
def get_settings():
    return Settings()

settings = get_settings()
