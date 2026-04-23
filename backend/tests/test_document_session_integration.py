import main
from fastapi.testclient import TestClient


client = TestClient(main.app)


def test_document_session_supported_document_generates_draft(monkeypatch):
    async def fake_complete_document_chat(request):
        return (
            main.DocumentChatStructuredResponse(
                assistantMessage="Great, I will continue filling your Mutual NDA.",
                selectedDocument="Mutual NDA",
                requestedUnsupportedDocument=None,
                collectedFields={"purpose": "Evaluate partnership"},
                missingFields=["effectiveDate"],
                readyForDraft=False,
            ),
            "openrouter/openai/gpt-oss-120b:free",
        )

    monkeypatch.setattr(main, "complete_document_chat", fake_complete_document_chat)

    response = client.post(
        "/api/chat/document-session",
        json={
            "messages": [{"role": "user", "content": "Need a mutual NDA"}],
            "state": {
                "selectedDocument": None,
                "collectedFields": {},
                "missingFields": [],
                "readyForDraft": False,
                "draftMarkdown": "",
            },
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["selectedDocument"] == "Mutual NDA"
    assert payload["isDocumentSupported"] is True
    assert payload["suggestedClosestDocument"] is None
    assert payload["availableDocuments"]
    assert payload["collectedFields"]["purpose"] == "Evaluate partnership"
    assert "# Draft: Mutual NDA" in payload["draftMarkdown"]
    assert "## Template" not in payload["draftMarkdown"]


def test_document_session_unsupported_document_returns_closest_suggestion(monkeypatch):
    async def fake_complete_document_chat(request):
        return (
            main.DocumentChatStructuredResponse(
                assistantMessage="We can proceed with a close alternative.",
                selectedDocument="Employment Agreement",
                requestedUnsupportedDocument="Employment Agreement",
                collectedFields={},
                missingFields=["partyNames"],
                readyForDraft=False,
            ),
            "openrouter/openai/gpt-oss-120b:free",
        )

    monkeypatch.setattr(main, "complete_document_chat", fake_complete_document_chat)

    response = client.post(
        "/api/chat/document-session",
        json={
            "messages": [{"role": "user", "content": "I need an employment agreement"}],
            "state": {
                "selectedDocument": None,
                "collectedFields": {},
                "missingFields": [],
                "readyForDraft": False,
                "draftMarkdown": "",
            },
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["isDocumentSupported"] is False
    assert payload["suggestedClosestDocument"] in payload["availableDocuments"]
    assert "cannot generate 'Employment Agreement'" in payload["assistantMessage"]


def test_document_session_without_selected_document_has_empty_draft(monkeypatch):
    async def fake_complete_document_chat(request):
        return (
            main.DocumentChatStructuredResponse(
                assistantMessage="Which document do you want to create?",
                selectedDocument=None,
                requestedUnsupportedDocument=None,
                collectedFields={},
                missingFields=["documentType"],
                readyForDraft=False,
            ),
            "openrouter/openai/gpt-oss-120b:free",
        )

    monkeypatch.setattr(main, "complete_document_chat", fake_complete_document_chat)

    response = client.post(
        "/api/chat/document-session",
        json={
            "messages": [{"role": "user", "content": "Help me draft something"}],
            "state": {
                "selectedDocument": None,
                "collectedFields": {},
                "missingFields": [],
                "readyForDraft": False,
                "draftMarkdown": "",
            },
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["selectedDocument"] is None
    assert payload["draftMarkdown"] == ""


def test_document_session_infers_csa_from_cloud_saas_phrase(monkeypatch):
    async def fake_complete_document_chat(request):
        return (
            main.DocumentChatStructuredResponse(
                assistantMessage="",
                selectedDocument=None,
                requestedUnsupportedDocument=None,
                collectedFields={},
                missingFields=[],
                readyForDraft=False,
            ),
            "openrouter/openai/gpt-oss-120b:free",
        )

    monkeypatch.setattr(main, "complete_document_chat", fake_complete_document_chat)

    response = client.post(
        "/api/chat/document-session",
        json={
            "messages": [
                {
                    "role": "user",
                    "content": "I want a cloud SaaS agreement for our product",
                }
            ],
            "state": {
                "selectedDocument": None,
                "collectedFields": {},
                "missingFields": [],
                "readyForDraft": False,
                "draftMarkdown": "",
            },
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["selectedDocument"] == "Cloud Service Agreement (CSA)"
    assert payload["draftMarkdown"].startswith("# Draft: Cloud Service Agreement (CSA)")
    assert payload["missingFields"]
    assert "service provider company" in payload["assistantMessage"]


def test_document_session_keeps_selected_document_from_state(monkeypatch):
    async def fake_complete_document_chat(request):
        return (
            main.DocumentChatStructuredResponse(
                assistantMessage="Please provide the effective date and term length.",
                selectedDocument=None,
                requestedUnsupportedDocument=None,
                collectedFields={"partyNames": "Tomas inc / Imone Inc"},
                missingFields=["effectiveDate", "term"],
                readyForDraft=False,
            ),
            "openrouter/openai/gpt-oss-120b:free",
        )

    monkeypatch.setattr(main, "complete_document_chat", fake_complete_document_chat)

    response = client.post(
        "/api/chat/document-session",
        json={
            "messages": [
                {"role": "assistant", "content": "Who are the parties?"},
                {"role": "user", "content": "First party: Tomas inc, second party: Imone Inc"},
            ],
            "state": {
                "selectedDocument": "Cloud Service Agreement (CSA)",
                "collectedFields": {"initial": "value"},
                "missingFields": ["partyNames"],
                "readyForDraft": False,
                "draftMarkdown": "",
            },
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["selectedDocument"] == "Cloud Service Agreement (CSA)"
    assert payload["collectedFields"]["initial"] == "value"
    assert payload["collectedFields"]["partyNames"] == "Tomas inc / Imone Inc"
    assert payload["draftMarkdown"].startswith("# Draft: Cloud Service Agreement (CSA)")


def test_document_session_normalizes_csa_selected_document(monkeypatch):
    async def fake_complete_document_chat(request):
        return (
            main.DocumentChatStructuredResponse(
                assistantMessage="Great, let's proceed with CSA.",
                selectedDocument="CSA",
                requestedUnsupportedDocument=None,
                collectedFields={},
                missingFields=["partyNames"],
                readyForDraft=False,
            ),
            "openrouter/openai/gpt-oss-120b:free",
        )

    monkeypatch.setattr(main, "complete_document_chat", fake_complete_document_chat)

    response = client.post(
        "/api/chat/document-session",
        json={
            "messages": [{"role": "user", "content": "I want CSA"}],
            "state": {
                "selectedDocument": None,
                "collectedFields": {},
                "missingFields": [],
                "readyForDraft": False,
                "draftMarkdown": "",
            },
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["selectedDocument"] == "Cloud Service Agreement (CSA)"
    assert payload["isDocumentSupported"] is True
    assert payload["draftMarkdown"].startswith("# Draft: Cloud Service Agreement (CSA)")


def test_document_session_does_not_mark_csa_as_unsupported(monkeypatch):
    async def fake_complete_document_chat(request):
        return (
            main.DocumentChatStructuredResponse(
                assistantMessage="We can proceed.",
                selectedDocument=None,
                requestedUnsupportedDocument="CSA",
                collectedFields={},
                missingFields=["partyNames"],
                readyForDraft=False,
            ),
            "openrouter/openai/gpt-oss-120b:free",
        )

    monkeypatch.setattr(main, "complete_document_chat", fake_complete_document_chat)

    response = client.post(
        "/api/chat/document-session",
        json={
            "messages": [{"role": "user", "content": "CSA"}],
            "state": {
                "selectedDocument": None,
                "collectedFields": {},
                "missingFields": [],
                "readyForDraft": False,
                "draftMarkdown": "",
            },
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["selectedDocument"] == "Cloud Service Agreement (CSA)"
    assert payload["isDocumentSupported"] is True
    assert payload["suggestedClosestDocument"] is None


def test_document_session_user_intent_overrides_wrong_model_guess(monkeypatch):
    async def fake_complete_document_chat(request):
        return (
            main.DocumentChatStructuredResponse(
                assistantMessage=(
                    "Great, we'll prepare a Software License Agreement for your SaaS product. "
                    "Who are the parties involved?"
                ),
                selectedDocument="Software License Agreement",
                requestedUnsupportedDocument=None,
                collectedFields={},
                missingFields=["partyNames"],
                readyForDraft=False,
            ),
            "openrouter/openai/gpt-oss-120b:free",
        )

    monkeypatch.setattr(main, "complete_document_chat", fake_complete_document_chat)

    response = client.post(
        "/api/chat/document-session",
        json={
            "messages": [{"role": "user", "content": "A cloud SaaS agreement"}],
            "state": {
                "selectedDocument": None,
                "collectedFields": {},
                "missingFields": [],
                "readyForDraft": False,
                "draftMarkdown": "",
            },
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["selectedDocument"] == "Cloud Service Agreement (CSA)"
    assert payload["draftMarkdown"].startswith("# Draft: Cloud Service Agreement (CSA)")


def test_document_session_plain_text_reply_fills_current_missing_field(monkeypatch):
    async def fake_complete_document_chat(request):
        return (
            main.DocumentChatStructuredResponse(
                assistantMessage="Thanks, please continue.",
                selectedDocument="Cloud Service Agreement (CSA)",
                requestedUnsupportedDocument=None,
                collectedFields={},
                missingFields=[
                    "providerCompanyName",
                    "customerCompanyName",
                    "effectiveDate",
                ],
                readyForDraft=False,
            ),
            "openrouter/openai/gpt-oss-120b:free",
        )

    monkeypatch.setattr(main, "complete_document_chat", fake_complete_document_chat)

    response = client.post(
        "/api/chat/document-session",
        json={
            "messages": [
                {
                    "role": "assistant",
                    "content": "What is the full legal name of the service provider company?",
                },
                {"role": "user", "content": "Tomas Inc"},
            ],
            "state": {
                "selectedDocument": "Cloud Service Agreement (CSA)",
                "collectedFields": {},
                "missingFields": [
                    "providerCompanyName",
                    "customerCompanyName",
                    "effectiveDate",
                ],
                "readyForDraft": False,
                "draftMarkdown": "",
            },
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["collectedFields"]["providerCompanyName"] == "Tomas Inc"
    assert "customer company" in payload["assistantMessage"].lower()


def test_render_document_draft_uses_pretty_field_labels_and_table():
    draft = main.render_document_draft(
        "Cloud Service Agreement (CSA)",
        {
            "providerCompanyName": "Tomas Cloud Ltd",
            "effectiveDate": "2026-04-23",
            "servicesDescription": "Managed hosting",
        },
    )

    assert "## Party and Deal Information" in draft
    assert "<table" in draft
    assert "Provider Company Name</td><td" in draft
    assert "Effective Date</td><td" in draft
    assert "Field | Value" not in draft
    assert "- effectiveDate:" not in draft


def test_clean_template_for_draft_adds_spacing_before_numbered_sections():
    cleaned = main.clean_template_for_draft(
        "Intro paragraph.\n2. Support.\nDuring the term, provider supports customer."
    )

    assert "Intro paragraph.\n\n## 2 Support." in cleaned


def test_purpose_answer_with_comma_is_extracted():
    """Purpose answers containing commas should not be blocked by looks_structured guard."""
    extracted = main.extract_basic_fields_from_messages(
        "Business Associate Agreement (BAA)",
        [
            {"role": "assistant", "content": "What is the main purpose or scope of this agreement?"},
            {"role": "user", "content": "PHI data sharing for HIPAA compliance, including all downstream vendors"},
        ],
        prior_missing_fields=["purpose", "effectiveDate", "governingLaw"],
        existing_collected_fields={},
    )
    assert extracted.get("purpose") == "PHI data sharing for HIPAA compliance, including all downstream vendors"


def test_purpose_answer_with_colon_is_extracted():
    extracted = main.extract_basic_fields_from_messages(
        "Mutual NDA",
        [
            {"role": "assistant", "content": "What is the main purpose or scope of this agreement?"},
            {"role": "user", "content": "Evaluation: exploring a potential software partnership"},
        ],
        prior_missing_fields=["purpose", "effectiveDate", "governingLaw"],
        existing_collected_fields={},
    )
    assert extracted.get("purpose") == "Evaluation: exploring a potential software partnership"


def test_baa_document_session_tracks_purpose_field(monkeypatch):
    async def fake_complete_document_chat(request):
        return (
            main.DocumentChatStructuredResponse(
                assistantMessage="Thanks, what is the main purpose?",
                selectedDocument="Business Associate Agreement (BAA)",
                requestedUnsupportedDocument=None,
                collectedFields={},
                missingFields=["purpose", "effectiveDate", "governingLaw"],
                readyForDraft=False,
            ),
            "local-fallback",
        )

    monkeypatch.setattr(main, "complete_document_chat", fake_complete_document_chat)

    response = client.post(
        "/api/chat/document-session",
        json={
            "messages": [
                {"role": "assistant", "content": "What is the main purpose or scope of this agreement?"},
                {"role": "user", "content": "PHI data sharing, including downstream vendors"},
            ],
            "state": {
                "selectedDocument": "Business Associate Agreement (BAA)",
                "collectedFields": {
                    "coveredEntityName": "Health Corp",
                    "businessAssociateName": "Tech Co",
                },
                "missingFields": ["purpose", "effectiveDate", "governingLaw"],
                "readyForDraft": False,
                "draftMarkdown": "",
            },
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["collectedFields"].get("purpose") == "PHI data sharing, including downstream vendors"
    assert "purpose" not in payload["missingFields"]


def test_infer_document_does_not_match_sla_inside_words():
    assert main.infer_document_from_text("verslas") is None


def test_infer_document_matches_explicit_sla_alias():
    assert main.infer_document_from_text("Need SLA for uptime commitments") == "Service Level Agreement (SLA)"