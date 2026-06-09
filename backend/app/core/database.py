from collections.abc import Generator

from sqlmodel import Session, SQLModel, create_engine

from app.core.config import get_settings

settings = get_settings()
engine = create_engine(settings.database_url, echo=False, pool_pre_ping=True)


def init_db() -> None:
    # Import models so SQLModel registers metadata before create_all.
    from app.auth import models as auth_models  # noqa: F401
    from app.profiles import models as profile_models  # noqa: F401
    from app.posts import models as post_models  # noqa: F401
    from app.chat import models as chat_models  # noqa: F401
    from app.billing import models as billing_models  # noqa: F401
    from app.reports import models as report_models  # noqa: F401
    from app.audit import models as audit_models  # noqa: F401

    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
