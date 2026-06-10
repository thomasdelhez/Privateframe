from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta
from threading import Lock

from fastapi import HTTPException, Request, status

from app.core.config import get_settings

_attempts: dict[str, deque[datetime]] = defaultdict(deque)
_lock = Lock()


def enforce_auth_rate_limit(request: Request, scope: str) -> None:
    settings = get_settings()
    address = request.client.host if request.client else "unknown"
    key = f"{scope}:{address}"
    now = datetime.now(UTC)
    cutoff = now - timedelta(seconds=settings.auth_rate_limit_window_seconds)

    with _lock:
        bucket = _attempts[key]
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()
        if len(bucket) >= settings.auth_rate_limit_attempts:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Te veel pogingen. Probeer het later opnieuw.",
            )
        bucket.append(now)


def enforce_user_rate_limit(
    request: Request,
    scope: str,
    user_id: str,
    *,
    attempts: int,
    window_seconds: int,
) -> None:
    address = request.client.host if request.client else "unknown"
    key = f"user:{scope}:{user_id}:{address}"
    now = datetime.now(UTC)
    cutoff = now - timedelta(seconds=window_seconds)
    with _lock:
        bucket = _attempts[key]
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()
        if len(bucket) >= attempts:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Te veel acties. Probeer het later opnieuw.",
            )
        bucket.append(now)


def clear_rate_limits() -> None:
    with _lock:
        _attempts.clear()
