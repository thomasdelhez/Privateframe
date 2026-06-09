import re

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.auth.models import User
from app.core.enums import UserRole


def _email_token(body: str) -> str:
    match = re.search(r"[?&]token=([A-Za-z0-9_-]+)", body)
    assert match
    return match.group(1)


def _headers(access_value: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_value}"}


def _create_onboarded_user(
    client: TestClient,
    outbox: list[dict[str, str]],
    *,
    email: str,
    password: str = "strong-password",
) -> str:
    response = client.post("/api/v1/auth/register", json={"email": email, "password": password})
    assert response.status_code == 201
    verification_token = _email_token(outbox[-1]["body"])

    response = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200
    access_value = response.json()["access_value"]

    assert client.post("/api/v1/auth/email/verify", json={"token": verification_token}).status_code == 200
    assert client.post("/api/v1/auth/age/confirm", headers=_headers(access_value)).status_code == 200
    return access_value


def test_discover_excludes_self_and_supports_filters(
    client: TestClient,
    outbox: list[dict[str, str]],
) -> None:
    access_alice = _create_onboarded_user(client, outbox, email="alice@example.com")
    access_bob = _create_onboarded_user(client, outbox, email="bob@example.com")

    assert client.put(
        "/api/v1/profiles/me",
        headers=_headers(access_alice),
        json={
            "display_name": "Alice Rivers",
            "bio": "Photographer in Utrecht",
            "location_label": "Utrecht",
            "age_label": "29",
            "gender": "vrouw",
        },
    ).status_code == 200

    assert client.put(
        "/api/v1/profiles/me",
        headers=_headers(access_bob),
        json={
            "display_name": "Bob Stone",
            "bio": "Music and coffee walks",
            "location_label": "Amsterdam",
            "age_label": "31",
            "gender": "man",
        },
    ).status_code == 200

    response = client.get("/api/v1/profiles", headers=_headers(access_alice))
    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["display_name"] == "Bob Stone"
    assert payload[0]["gender"] == "man"
    assert payload[0]["age_label"] == "31"

    response = client.get("/api/v1/profiles?q=coffee", headers=_headers(access_alice))
    assert response.status_code == 200
    assert [item["slug"] for item in response.json()] == ["bob-stone"]

    response = client.get("/api/v1/profiles?location=Utrecht", headers=_headers(access_bob))
    assert response.status_code == 200
    assert [item["slug"] for item in response.json()] == ["alice-rivers"]


def test_profile_activity_hides_identity_for_free_and_shows_for_premium(
    client: TestClient,
    session: Session,
    outbox: list[dict[str, str]],
) -> None:
    access_alice = _create_onboarded_user(client, outbox, email="alice@example.com")
    access_bob = _create_onboarded_user(client, outbox, email="bob@example.com")

    alice_profile = client.put(
        "/api/v1/profiles/me",
        headers=_headers(access_alice),
        json={
            "display_name": "Alice Rivers",
            "bio": "Likes art fairs",
            "location_label": "Utrecht",
            "age_label": "29",
            "gender": "vrouw",
        },
    )
    assert alice_profile.status_code == 200

    bob_profile = client.put(
        "/api/v1/profiles/me",
        headers=_headers(access_bob),
        json={
            "display_name": "Bob Stone",
            "bio": "Music and coffee walks",
            "location_label": "Amsterdam",
            "age_label": "31",
            "gender": "man",
        },
    )
    assert bob_profile.status_code == 200

    alice_slug = alice_profile.json()["slug"]
    assert client.get(f"/api/v1/profiles/{alice_slug}", headers=_headers(access_bob)).status_code == 200
    assert client.get(f"/api/v1/profiles/{alice_slug}", headers=_headers(access_bob)).status_code == 200

    free_activity = client.get("/api/v1/profiles/me/activity", headers=_headers(access_alice))
    assert free_activity.status_code == 200
    free_payload = free_activity.json()
    assert free_payload["count"] == 1
    assert free_payload["visits"][0]["profile"] is None

    alice_user = session.exec(select(User).where(User.email == "alice@example.com")).one()
    alice_user.role = UserRole.PREMIUM
    session.add(alice_user)
    session.commit()

    premium_activity = client.get("/api/v1/profiles/me/activity", headers=_headers(access_alice))
    assert premium_activity.status_code == 200
    premium_payload = premium_activity.json()
    assert premium_payload["count"] == 1
    assert premium_payload["visits"][0]["profile"]["slug"] == bob_profile.json()["slug"]
