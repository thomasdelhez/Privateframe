import re
from io import BytesIO

from PIL import Image


def _email_token(body: str) -> str:
    match = re.search(r"[?&]token=([A-Za-z0-9_-]+)", body)
    assert match
    return match.group(1)


def _create_user(client, outbox, email: str) -> tuple[str, str]:
    assert client.post("/api/v1/auth/register", json={"email": email, "password": "strong-password"}).status_code == 201
    verification_token = _email_token(outbox[-1]["body"])
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "strong-password"})
    access = login.json()["access_value"]
    user_id = login.json()["user"]["id"]
    headers = {"Authorization": f"Bearer {access}"}
    assert client.post("/api/v1/auth/email/verify", json={"token": verification_token}).status_code == 200
    assert client.post("/api/v1/auth/age/confirm", headers=headers).status_code == 200
    return access, user_id


def _profile(client, access: str, name: str, *, discoverable: bool = True) -> dict:
    response = client.put(
        "/api/v1/profiles/me",
        headers={"Authorization": f"Bearer {access}"},
        json={
            "display_name": name,
            "bio": "Fotografie en reizen",
            "location_label": "Utrecht",
            "age_label": "31",
            "gender": "vrouw",
            "interests": ["fotografie", "reizen"],
            "discoverable": discoverable,
            "show_online_status": True,
            "show_location": True,
            "register_profile_views": True,
        },
    )
    assert response.status_code == 200
    return response.json()


def _png_bytes() -> bytes:
    output = BytesIO()
    Image.new("RGB", (32, 32), "#ec4899").save(output, format="PNG")
    return output.getvalue()


def test_likes_create_match_and_block_removes_visibility(client, outbox) -> None:
    access_a, user_a = _create_user(client, outbox, "social-a@example.com")
    access_b, user_b = _create_user(client, outbox, "social-b@example.com")
    profile_a = _profile(client, access_a, "Social Alice")
    profile_b = _profile(client, access_b, "Social Bob")
    headers_a = {"Authorization": f"Bearer {access_a}"}
    headers_b = {"Authorization": f"Bearer {access_b}"}

    first_like = client.post(f"/api/v1/social/likes/{user_b}", headers=headers_a)
    assert first_like.json() == {"enabled": True, "matched": False}
    second_like = client.post(f"/api/v1/social/likes/{user_a}", headers=headers_b)
    assert second_like.json() == {"enabled": True, "matched": True}

    matches = client.get("/api/v1/social/matches", headers=headers_a)
    assert [item["slug"] for item in matches.json()] == [profile_b["slug"]]

    assert client.post(f"/api/v1/social/blocks/{user_b}", headers=headers_a).status_code == 200
    assert client.get("/api/v1/profiles", headers=headers_a).json() == []
    assert client.get(f"/api/v1/profiles/{profile_b['slug']}", headers=headers_a).status_code == 404
    assert client.post("/api/v1/plan/enable", headers=headers_a).status_code == 200
    assert client.post("/api/v1/chat", headers=headers_a, json={"other_user_id": user_b}).status_code == 403
    assert client.get("/api/v1/social/matches", headers=headers_a).json() == []
    assert client.get(f"/api/v1/profiles/{profile_a['slug']}", headers=headers_b).status_code == 404


def test_hidden_profile_and_private_album_access(client, outbox) -> None:
    owner_access, owner_id = _create_user(client, outbox, "private-owner@example.com")
    viewer_access, _ = _create_user(client, outbox, "private-viewer@example.com")
    owner_profile = _profile(client, owner_access, "Private Owner", discoverable=False)
    _profile(client, viewer_access, "Private Viewer")
    owner_headers = {"Authorization": f"Bearer {owner_access}"}
    viewer_headers = {"Authorization": f"Bearer {viewer_access}"}

    assert client.get("/api/v1/profiles", headers=viewer_headers).json() == []
    assert client.get(f"/api/v1/profiles/{owner_profile['slug']}", headers=viewer_headers).status_code == 404
    _profile(client, owner_access, "Private Owner", discoverable=True)

    post = client.post(
        "/api/v1/posts",
        headers=owner_headers,
        json={
            "title": "Privéset",
            "description": "Alleen na toestemming",
            "is_private": True,
            "rule_age": True,
            "rule_rights": True,
            "rule_safe": True,
            "rule_permission": True,
        },
    ).json()
    upload = client.post(
        f"/api/v1/posts/{post['id']}/assets",
        headers=owner_headers,
        files={"file": ("private.png", _png_bytes(), "image/png")},
    )
    asset_id = upload.json()["asset"]["id"]
    viewer_post = client.get(f"/api/v1/posts?user_id={owner_id}", headers=viewer_headers).json()[0]
    assert viewer_post["is_private"] is True
    assert viewer_post["assets"][0]["locked"] is True

    request = client.post(f"/api/v1/posts/{post['id']}/access", headers=viewer_headers)
    assert request.status_code == 200
    request_id = request.json()["id"]
    incoming = client.get("/api/v1/posts/access/incoming", headers=owner_headers)
    assert incoming.json()[0]["requester_display_name"] == "Private Viewer"
    assert client.post(f"/api/v1/posts/access/{request_id}/approve", headers=owner_headers).status_code == 200

    approved_post = client.get(f"/api/v1/posts?user_id={owner_id}", headers=viewer_headers).json()[0]
    assert approved_post["access_status"] == "approved"
    assert approved_post["assets"][0]["locked"] is False
    assert client.get(f"/api/v1/posts/assets/{asset_id}", headers=viewer_headers).status_code == 200

    privacy_update = client.put(
        f"/api/v1/posts/{post['id']}",
        headers=owner_headers,
        json={
            "title": "Privéset bijgewerkt",
            "description": "Nu openbaar",
            "is_private": False,
        },
    )
    assert privacy_update.status_code == 200
    assert client.get("/api/v1/posts/access/incoming", headers=owner_headers).json() == []
