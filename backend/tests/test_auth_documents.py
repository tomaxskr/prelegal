import main
import uuid
from fastapi.testclient import TestClient


client = TestClient(main.app)


def test_signup_signin_and_auth_me_roundtrip():
    email = f"taylor.{uuid.uuid4().hex[:8]}@example.com"
    signup_response = client.post(
        "/api/auth/signup",
        json={
            "name": "Taylor Stone",
            "email": email,
            "password": "supersecret123",
        },
    )
    assert signup_response.status_code == 200
    signup_payload = signup_response.json()
    assert signup_payload["token"]
    assert signup_payload["user"]["email"] == email

    token = signup_payload["token"]
    me_response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_response.status_code == 200
    assert me_response.json()["user"]["name"] == "Taylor Stone"

    signin_response = client.post(
        "/api/auth/signin",
        json={"email": email, "password": "supersecret123"},
    )
    assert signin_response.status_code == 200
    assert signin_response.json()["token"]


def test_document_history_is_scoped_per_user():
    first_email = f"first.user.{uuid.uuid4().hex[:8]}@example.com"
    second_email = f"second.user.{uuid.uuid4().hex[:8]}@example.com"

    first_user = client.post(
        "/api/auth/signup",
        json={
            "name": "First User",
            "email": first_email,
            "password": "firstuserpw",
        },
    )
    second_user = client.post(
        "/api/auth/signup",
        json={
            "name": "Second User",
            "email": second_email,
            "password": "seconduserpw",
        },
    )

    assert first_user.status_code == 200
    assert second_user.status_code == 200

    first_token = first_user.json()["token"]
    second_token = second_user.json()["token"]

    save_first = client.post(
        "/api/documents",
        headers={"Authorization": f"Bearer {first_token}"},
        json={
            "selectedDocument": "Mutual NDA",
            "collectedFields": {"party1Name": "Acme", "party2Name": "Globex"},
            "draftMarkdown": "# Draft: Mutual NDA\n\nTest body",
        },
    )
    assert save_first.status_code == 200

    list_first = client.get(
        "/api/documents",
        headers={"Authorization": f"Bearer {first_token}"},
    )
    list_second = client.get(
        "/api/documents",
        headers={"Authorization": f"Bearer {second_token}"},
    )

    assert list_first.status_code == 200
    assert list_second.status_code == 200

    first_docs = list_first.json()
    second_docs = list_second.json()

    assert len(first_docs) == 1
    assert first_docs[0]["selectedDocument"] == "Mutual NDA"
    assert second_docs == []

    saved_id = first_docs[0]["id"]
    detail_first = client.get(
        f"/api/documents/{saved_id}",
        headers={"Authorization": f"Bearer {first_token}"},
    )
    detail_second = client.get(
        f"/api/documents/{saved_id}",
        headers={"Authorization": f"Bearer {second_token}"},
    )

    assert detail_first.status_code == 200
    assert detail_first.json()["selectedDocument"] == "Mutual NDA"
    assert detail_second.status_code == 404
