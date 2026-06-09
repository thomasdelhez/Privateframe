from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "PrivateFrame"
    api_prefix: str = "/api/v1"
    database_url: str = "postgresql+psycopg://privateframe:privateframe@localhost:5432/privateframe"
    access_token_expire_minutes: int = 60
    cors_origins: str = "http://localhost:4200"
    media_storage_path: str = "./media"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
