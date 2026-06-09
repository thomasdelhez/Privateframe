from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "PrivateFrame"
    api_prefix: str = "/api/v1"
    database_url: str = "postgresql+psycopg://privateframe:privateframe@localhost:5432/privateframe"
    session_expire_days: int = 7
    email_verification_expire_hours: int = 24
    password_reset_expire_minutes: int = 60
    auto_verify_new_users: bool = False
    auth_rate_limit_attempts: int = 10
    auth_rate_limit_window_seconds: int = 60
    cors_origins: str = "http://localhost:4200"
    media_storage_path: str = "./media"
    frontend_url: str = "http://localhost:4200"
    email_backend: str = "console"
    email_from: str = "PrivateFrame <noreply@privateframe.local>"
    smtp_host: str = "localhost"
    smtp_port: int = 1025

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
