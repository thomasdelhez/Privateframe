from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.core.config import get_settings
from app.core.database import get_session
from app.core.rate_limit import clear_rate_limits
from app.main import app


@pytest.fixture
def session() -> Generator[Session, None, None]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as value:
        yield value
    SQLModel.metadata.drop_all(engine)


@pytest.fixture
def client(session: Session) -> Generator[TestClient, None, None]:
    def override_session() -> Generator[Session, None, None]:
        yield session

    clear_rate_limits()
    app.dependency_overrides[get_session] = override_session
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    clear_rate_limits()


@pytest.fixture
def outbox(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, str]]:
    messages: list[dict[str, str]] = []

    def capture_email(*, recipient: str, subject: str, body: str) -> None:
        messages.append({"recipient": recipient, "subject": subject, "body": body})

    monkeypatch.setattr("app.auth.service.send_email", capture_email)
    return messages


@pytest.fixture(autouse=True)
def media_storage(
    tmp_path_factory: pytest.TempPathFactory,
    monkeypatch: pytest.MonkeyPatch,
) -> Generator[None, None, None]:
    media_dir = tmp_path_factory.mktemp("media")
    monkeypatch.setenv("MEDIA_STORAGE_PATH", str(media_dir))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
