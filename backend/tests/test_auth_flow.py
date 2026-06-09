import re
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.auth.models import UserSession

EMAIL = "test@example.com"
PASSWORD = "strong-pass"


def _register_and_login(client: TestClient, outbox: list[dict[str, str]]) -> tuple[str, str]:
    response = client.post("/api/v1/auth/register", json={"email": EMAIL, "password": PASSWORD})
    assert response.status_code == 201
    assert response.json()["email_verified"] is False
    token = _email_token(outbox[-1]["body"])

    response = client.post("/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert response.status_code == 200
    return response.json()["access_value"], token


def _email_token(body: str) -> str:
    match = re.search(r"[?&]token=([A-Za-z0-9_-]+)", body)
    assert match
    return match.group(1)


def _headers(access_value: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_value}"}


def test_registration_requires_ten_character_password(client: TestClient) -> None:
    response = client.post("/api/v1/auth/register", json={"email": EMAIL, "password": "short"})
    assert response.status_code == 422


def test_verified_account_can_complete_onboarding_and_logout(
    client: TestClient,
    outbox: list[dict[str, str]],
) -> None:
    access_value, verification_token = _register_and_login(client, outbox)

    response = client.get("/api/v1/profiles", headers=_headers(access_value))
    assert response.status_code == 403
    assert response.json()["detail"] == "E-mailverificatie vereist"

    response = client.post("/api/v1/auth/email/verify", json={"token": verification_token})
    assert response.status_code == 200
    assert response.json()["email_verified"] is True

    response = client.post("/api/v1/auth/age/confirm", headers=_headers(access_value))
    assert response.status_code == 200

    response = client.get("/api/v1/profiles", headers=_headers(access_value))
    assert response.status_code == 200

    response = client.post("/api/v1/auth/logout", headers=_headers(access_value))
    assert response.status_code == 200
    assert client.get("/api/v1/auth/me", headers=_headers(access_value)).status_code == 401


def test_password_reset_revokes_sessions_and_token_is_single_use(
    client: TestClient,
    outbox: list[dict[str, str]],
) -> None:
    access_value, _ = _register_and_login(client, outbox)
    response = client.post("/api/v1/auth/password/forgot", json={"email": EMAIL})
    assert response.status_code == 200
    reset_token = _email_token(outbox[-1]["body"])

    response = client.post(
        "/api/v1/auth/password/reset",
        json={"token": reset_token, "password": "new-strong-pass"},
    )
    assert response.status_code == 200
    assert client.get("/api/v1/auth/me", headers=_headers(access_value)).status_code == 401

    response = client.post(
        "/api/v1/auth/password/reset",
        json={"token": reset_token, "password": "another-pass"},
    )
    assert response.status_code == 400
    assert client.post("/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD}).status_code == 401
    assert (
        client.post(
            "/api/v1/auth/login",
            json={"email": EMAIL, "password": "new-strong-pass"},
        ).status_code
        == 200
    )


def test_expired_session_is_rejected(
    client: TestClient,
    session: Session,
    outbox: list[dict[str, str]],
) -> None:
    access_value, _ = _register_and_login(client, outbox)
    item = session.exec(select(UserSession).where(UserSession.value == access_value)).one()
    item.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    session.add(item)
    session.commit()

    response = client.get("/api/v1/auth/me", headers=_headers(access_value))
    assert response.status_code == 401


def test_auth_rate_limit_returns_429(client: TestClient) -> None:
    responses = [client.post("/api/v1/auth/login", json={"email": EMAIL, "password": PASSWORD}) for _ in range(11)]
    assert responses[-1].status_code == 429


def test_placeholder_endpoint_returns_updated_post(
    client: TestClient,
    outbox: list[dict[str, str]],
) -> None:
    access_value, verification_token = _register_and_login(client, outbox)
    assert client.post("/api/v1/auth/email/verify", json={"token": verification_token}).status_code == 200
    assert client.post("/api/v1/auth/age/confirm", headers=_headers(access_value)).status_code == 200

    response = client.post(
        "/api/v1/posts",
        headers=_headers(access_value),
        json={
            "title": "Testkaart",
            "description": "Beschrijving",
            "rule_age": True,
            "rule_rights": True,
            "rule_safe": True,
            "rule_permission": True,
        },
    )
    assert response.status_code == 200
    post_id = response.json()["id"]

    response = client.post(
        f"/api/v1/posts/{post_id}/assets",
        headers=_headers(access_value),
        files={"file": ("preview.png", b"\x89PNG\r\n\x1a\nsmall-image", "image/png")},
    )
    assert response.status_code == 200
    assert response.json()["post"]["id"] == post_id
    assert response.json()["asset"]["preview_url"] == f"/api/v1/posts/assets/{response.json()['asset']['id']}/preview"
