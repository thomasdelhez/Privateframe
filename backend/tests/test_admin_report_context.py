import re
from uuid import UUID

from sqlmodel import Session

from app.auth.models import User
from app.core.enums import UserRole


def _email_token(body: str) -> str:
    match = re.search(r"[?&]token=([A-Za-z0-9_-]+)", body)
    assert match
    return match.group(1)


def _register_ready_user(client, outbox, email: str) -> tuple[str, str]:
    password = "secret12345"
    assert client.post("/api/v1/auth/register", json={"email": email, "password": password}).status_code == 201
    login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    token = login.json()["access_value"]
    headers = {"Authorization": f"Bearer {token}"}
    assert client.post("/api/v1/auth/email/verify", json={"token": _email_token(outbox[-1]["body"])}).status_code == 200
    assert client.post("/api/v1/auth/age/confirm", headers=headers).status_code == 200
    assert client.post("/api/v1/plan/enable", headers=headers).status_code == 200
    user_id = client.get("/api/v1/auth/me", headers=headers).json()["id"]
    return token, user_id


def test_admin_report_context_contains_full_conversation(client, outbox, session: Session) -> None:
    token_a, _ = _register_ready_user(client, outbox, "context-a@example.com")
    token_b, user_b_id = _register_ready_user(client, outbox, "context-b@example.com")
    admin_token, admin_user_id = _register_ready_user(client, outbox, "context-admin@example.com")

    admin = session.get(User, UUID(admin_user_id))
    assert admin
    admin.role = UserRole.ADMIN
    session.add(admin)
    session.commit()

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}
    headers_admin = {"Authorization": f"Bearer {admin_token}"}

    conversation = client.post("/api/v1/chat", json={"other_user_id": user_b_id}, headers=headers_a)
    assert conversation.status_code == 200
    conversation_id = conversation.json()["id"]

    expected_messages = [
        ("Eerste bericht", headers_a),
        ("Antwoord van de andere deelnemer", headers_b),
        ("Laatste bericht in de conversatie", headers_a),
    ]
    for body, headers in expected_messages:
        response = client.post(
            f"/api/v1/chat/{conversation_id}/messages",
            json={"body": body},
            headers=headers,
        )
        assert response.status_code == 200

    report = client.post(
        "/api/v1/reports",
        headers=headers_b,
        json={
            "target_type": "conversation",
            "target_id": conversation_id,
            "reason": "harassment",
            "description": "Bekijk het volledige gesprek.",
        },
    )
    assert report.status_code == 200

    context = client.get(
        f"/api/v1/admin/reports/{report.json()['id']}/context",
        headers=headers_admin,
    )
    assert context.status_code == 200
    payload = context.json()

    assert payload["conversation"]["id"] == conversation_id
    assert payload["message_count"] == 3
    assert [message["body"] for message in payload["messages"]] == [item[0] for item in expected_messages]
    assert payload["reporter"]["email"] == "context-b@example.com"
    assert len(payload["conversation"]["participants"]) == 2
