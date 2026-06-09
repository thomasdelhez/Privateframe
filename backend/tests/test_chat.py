import re
from uuid import uuid4


def _email_token(body: str) -> str:
    match = re.search(r"[?&]token=([A-Za-z0-9_-]+)", body)
    assert match
    return match.group(1)


def _register_and_enable_premium(client, outbox, email: str, password: str) -> tuple[str, str]:
    register = client.post("/api/v1/auth/register", json={"email": email, "password": password})
    assert register.status_code == 201
    login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200
    token = login.json()["access_value"]
    headers = {"Authorization": f"Bearer {token}"}
    verify = client.post("/api/v1/auth/email/verify", json={"token": _email_token(outbox[-1]["body"])})
    assert verify.status_code == 200
    client.post("/api/v1/auth/age/confirm", headers=headers)
    client.post("/api/v1/plan/enable", headers=headers)
    me = client.get("/api/v1/auth/me", headers=headers).json()
    return token, me["id"]


def test_chat_unread_counts_and_mark_read(client, outbox) -> None:
    token_a, user_a_id = _register_and_enable_premium(client, outbox, "a@example.com", "secret12345")
    token_b, user_b_id = _register_and_enable_premium(client, outbox, "b@example.com", "secret12345")

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    conversation = client.post("/api/v1/chat", json={"other_user_id": user_b_id}, headers=headers_a).json()
    conversation_id = conversation["id"]

    send = client.post(
        f"/api/v1/chat/{conversation_id}/messages",
        json={"body": "Hoi daar"},
        headers=headers_a,
    )
    assert send.status_code == 200
    assert send.json()["status"] == "sent"
    assert send.json()["read_at"] is None

    conversations_b = client.get("/api/v1/chat", headers=headers_b)
    assert conversations_b.status_code == 200
    assert conversations_b.json()[0]["unread_count"] == 1
    assert conversations_b.json()[0]["last_message"]["body"] == "Hoi daar"

    messages_before = client.get(f"/api/v1/chat/{conversation_id}/messages", headers=headers_b)
    assert messages_before.status_code == 200
    assert messages_before.json()[0]["status"] == "sent"

    read = client.post(f"/api/v1/chat/{conversation_id}/read", headers=headers_b)
    assert read.status_code == 200
    assert read.json()["read_count"] == 1

    conversations_b_after = client.get("/api/v1/chat", headers=headers_b)
    assert conversations_b_after.status_code == 200
    assert conversations_b_after.json()[0]["unread_count"] == 0

    messages_after = client.get(f"/api/v1/chat/{conversation_id}/messages", headers=headers_b)
    assert messages_after.status_code == 200
    assert messages_after.json()[0]["status"] == "read"
    assert messages_after.json()[0]["read_at"] is not None


def test_chat_cannot_mark_unknown_conversation_read(client, outbox) -> None:
    token_a, _ = _register_and_enable_premium(client, outbox, "c@example.com", "secret12345")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    response = client.post(f"/api/v1/chat/{uuid4()}/read", headers=headers_a)
    assert response.status_code == 404
