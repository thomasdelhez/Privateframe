import re

from fastapi.testclient import TestClient


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


def test_uploaded_asset_has_preview_and_full_access_rules(
    client: TestClient,
    outbox: list[dict[str, str]],
) -> None:
    owner_access = _create_onboarded_user(client, outbox, email="owner@example.com")
    viewer_access = _create_onboarded_user(client, outbox, email="viewer@example.com")

    response = client.post(
        "/api/v1/posts",
        headers=_headers(owner_access),
        json={
            "title": "Studio set",
            "description": "Nieuw beeld",
            "rule_age": True,
            "rule_rights": True,
            "rule_safe": True,
            "rule_permission": True,
        },
    )
    assert response.status_code == 200
    post_id = response.json()["id"]

    upload = client.post(
        f"/api/v1/posts/{post_id}/assets",
        headers=_headers(owner_access),
        files={"file": ("studio.png", b"\x89PNG\r\n\x1a\nasset-bytes", "image/png")},
    )
    assert upload.status_code == 200
    asset_id = upload.json()["asset"]["id"]

    posts_for_viewer = client.get("/api/v1/posts", headers=_headers(viewer_access))
    assert posts_for_viewer.status_code == 200
    assert posts_for_viewer.json()[0]["assets"][0]["locked"] is True
    assert posts_for_viewer.json()[0]["assets"][0]["url"] is None
    assert posts_for_viewer.json()[0]["assets"][0]["preview_url"] == f"/api/v1/posts/assets/{asset_id}/preview"

    preview = client.get(f"/api/v1/posts/assets/{asset_id}/preview")
    assert preview.status_code == 200
    assert preview.headers["content-type"] == "image/png"

    full_for_free_viewer = client.get(f"/api/v1/posts/assets/{asset_id}", headers=_headers(viewer_access))
    assert full_for_free_viewer.status_code == 402

    full_for_owner = client.get(f"/api/v1/posts/assets/{asset_id}", headers=_headers(owner_access))
    assert full_for_owner.status_code == 200
    assert full_for_owner.content.startswith(b"\x89PNG")
