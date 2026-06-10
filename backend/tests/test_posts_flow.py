import re
from io import BytesIO

from fastapi.testclient import TestClient
from PIL import Image


def _email_token(body: str) -> str:
    match = re.search(r"[?&]token=([A-Za-z0-9_-]+)", body)
    assert match
    return match.group(1)


def _headers(access_value: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_value}"}


def _png_bytes() -> bytes:
    output = BytesIO()
    Image.new("RGB", (32, 32), "#d946ef").save(output, format="PNG")
    return output.getvalue()


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
    owner_profile = client.put(
        "/api/v1/profiles/me",
        headers=_headers(owner_access),
        json={"display_name": "Photo Owner"},
    )
    assert owner_profile.status_code == 200
    assert client.put(
        "/api/v1/profiles/me",
        headers=_headers(viewer_access),
        json={"display_name": "Photo Viewer"},
    ).status_code == 200

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
        files={"file": ("studio.png", _png_bytes(), "image/png")},
    )
    assert upload.status_code == 200
    asset_id = upload.json()["asset"]["id"]

    avatar = client.put(
        "/api/v1/profiles/me/avatar",
        headers=_headers(owner_access),
        json={"media_id": asset_id},
    )
    assert avatar.status_code == 200
    assert avatar.json()["avatar_media_id"] == asset_id
    assert avatar.json()["avatar_url"].startswith(f"/api/v1/profiles/avatar/{owner_profile.json()['user_id']}")
    public_avatar = client.get(f"/api/v1/profiles/avatar/{owner_profile.json()['user_id']}")
    assert public_avatar.status_code == 200
    assert public_avatar.content.startswith(b"\x89PNG")

    forbidden_avatar = client.put(
        "/api/v1/profiles/me/avatar",
        headers=_headers(viewer_access),
        json={"media_id": asset_id},
    )
    assert forbidden_avatar.status_code == 404

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
    assert preview.content != full_for_owner.content

    update = client.put(
        f"/api/v1/posts/{post_id}",
        headers=_headers(owner_access),
        json={
            "title": "Bijgewerkte studio set",
            "description": "Alleen na toestemming",
            "is_private": True,
        },
    )
    assert update.status_code == 200
    assert update.json()["title"] == "Bijgewerkte studio set"
    assert update.json()["description"] == "Alleen na toestemming"
    assert update.json()["is_private"] is True

    forbidden_update = client.put(
        f"/api/v1/posts/{post_id}",
        headers=_headers(viewer_access),
        json={
            "title": "Niet toegestaan",
            "description": None,
            "is_private": False,
        },
    )
    assert forbidden_update.status_code == 404

    hidden = client.post(f"/api/v1/posts/assets/{asset_id}/visibility", headers=_headers(owner_access))
    assert hidden.status_code == 200
    owner_after_hide = client.get("/api/v1/profiles/me", headers=_headers(owner_access))
    assert owner_after_hide.json()["avatar_media_id"] is None
    assert client.get(f"/api/v1/profiles/avatar/{owner_profile.json()['user_id']}").status_code == 404

    broken_upload = client.post(
        f"/api/v1/posts/{post_id}/assets",
        headers=_headers(owner_access),
        files={"file": ("broken.png", b"\x89PNG\r\n\x1a\nbroken", "image/png")},
    )
    assert broken_upload.status_code == 400
