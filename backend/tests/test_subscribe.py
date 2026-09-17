"""Newsletter routes.

These are the only unauthenticated routes on the API, so the questions are
about what a stranger can do with them: fill the table, learn who is on the
list, put someone on it without their consent, or take someone off it.
"""

import json

import pytest
from botocore.exceptions import ClientError

import auth
import subscribe


def event(method, path, body=None, query=None):
    return {
        "requestContext": {"http": {"method": method, "path": path, "sourceIp": "203.0.113.7"}},
        "rawPath": path,
        "headers": {"content-type": "application/json"},
        "body": json.dumps(body) if body is not None else None,
        "queryStringParameters": query,
    }


def body_of(response):
    return json.loads(response["body"])


class FakeTable:
    """Just enough DynamoDB to exercise the handler's decisions."""

    def __init__(self):
        self.rows = {}
        self.updates = []

    def update_item(self, Key, UpdateExpression, ExpressionAttributeValues, **kwargs):
        email = Key["email"]
        cond = kwargs.get("ConditionExpression")
        row = self.rows.get(email, {})
        if cond and row.get("status") == "confirmed":
            raise ClientError(
                {"Error": {"Code": "ConditionalCheckFailedException", "Message": "no"}},
                "UpdateItem",
            )
        self.updates.append((email, UpdateExpression))
        values = {k.lstrip(":"): v for k, v in ExpressionAttributeValues.items()}
        if "pending" in values:
            row = {"email": email, "status": "pending", "token": values["token"]}
        if "confirmed" in values and ":confirmed" in UpdateExpression.split("=")[1]:
            row["status"] = "confirmed"
        if "gone" in values:
            row["status"] = "unsubscribed"
            row["expires_at"] = values["ttl"]
        self.rows[email] = row

    def query(self, IndexName, ExpressionAttributeValues, **kwargs):
        token = ExpressionAttributeValues[":token"]
        return {"Items": [r for r in self.rows.values() if r.get("token") == token]}


@pytest.fixture
def table(monkeypatch):
    fake = FakeTable()
    monkeypatch.setattr(subscribe, "_table", fake)
    return fake


@pytest.fixture
def outbox(monkeypatch):
    sent = []
    monkeypatch.setattr(
        subscribe._ses, "send_email", lambda **kwargs: sent.append(kwargs) or {"MessageId": "x"}
    )
    return sent


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setattr(subscribe.config, "NEWSLETTER_FROM", "Saheeh AI <news@saheeh.ai>")
    monkeypatch.setattr(subscribe.config, "SITE_URL", "https://saheeh.ai")


@pytest.fixture
def turnstile_ok(monkeypatch):
    monkeypatch.setattr(auth, "verify_turnstile", lambda token, ip=None: True)


@pytest.fixture
def turnstile_fails(monkeypatch):
    monkeypatch.setattr(auth, "verify_turnstile", lambda token, ip=None: False)


GOOD = {"email": "Someone@Example.com", "source": "support", "turnstile_token": "t"}


# --- Sign-up ---------------------------------------------------------------


def test_signup_stores_pending_and_emails_a_confirmation(table, outbox, configured, turnstile_ok):
    response = subscribe.lambda_handler(event("POST", "/subscribe", GOOD), None)

    assert response["statusCode"] == 200
    row = table.rows["someone@example.com"]
    assert row["status"] == "pending"
    assert len(outbox) == 1
    assert outbox[0]["Destination"]["ToAddresses"] == ["someone@example.com"]
    text = outbox[0]["Message"]["Body"]["Text"]["Data"]
    assert f"/subscribe/confirm?token={row['token']}" in text
    assert f"/subscribe/unsubscribe?token={row['token']}" in text


def test_signup_is_refused_when_there_is_no_sender(table, outbox, turnstile_ok, monkeypatch):
    """No sender means no confirmation email, so nothing may be stored."""
    monkeypatch.setattr(subscribe.config, "NEWSLETTER_FROM", "")
    response = subscribe.lambda_handler(event("POST", "/subscribe", GOOD), None)
    assert response["statusCode"] == 503
    assert table.rows == {}
    assert outbox == []


def test_signup_without_turnstile_is_refused(table, outbox, configured, turnstile_fails):
    response = subscribe.lambda_handler(event("POST", "/subscribe", GOOD), None)
    assert response["statusCode"] == 400
    assert table.rows == {}
    assert outbox == []


@pytest.mark.parametrize(
    "email",
    ["", "not-an-email", "a@b", "x" * 300 + "@example.com", None, 42],
    ids=["empty", "no-at", "no-tld", "too-long", "none", "number"],
)
def test_signup_rejects_bad_addresses(email, table, outbox, configured, turnstile_ok):
    response = subscribe.lambda_handler(
        event("POST", "/subscribe", {**GOOD, "email": email}), None
    )
    assert response["statusCode"] == 400
    assert table.rows == {}
    assert outbox == []


def test_signup_leaves_a_confirmed_address_alone(table, outbox, configured, turnstile_ok):
    table.rows["someone@example.com"] = {
        "email": "someone@example.com",
        "status": "confirmed",
        "token": "keep-me",
    }
    response = subscribe.lambda_handler(event("POST", "/subscribe", GOOD), None)

    assert response["statusCode"] == 200
    assert body_of(response) == {"ok": True}
    assert table.rows["someone@example.com"]["token"] == "keep-me"
    assert outbox == []


def test_unknown_source_is_recorded_as_site(table, outbox, configured, turnstile_ok):
    subscribe.lambda_handler(event("POST", "/subscribe", {**GOOD, "source": "evil"}), None)
    assert table.updates and table.updates[0][0] == "someone@example.com"


# --- Confirm and unsubscribe ------------------------------------------------


def test_confirm_with_the_emailed_token(table):
    table.rows["a@example.com"] = {"email": "a@example.com", "status": "pending", "token": "t" * 32}
    response = subscribe.lambda_handler(
        event("GET", "/subscribe/confirm", query={"token": "t" * 32}), None
    )
    assert response["statusCode"] == 200
    assert table.rows["a@example.com"]["status"] == "confirmed"


def test_unsubscribe_sets_a_ttl(table):
    table.rows["a@example.com"] = {
        "email": "a@example.com",
        "status": "confirmed",
        "token": "u" * 32,
    }
    response = subscribe.lambda_handler(
        event("GET", "/subscribe/unsubscribe", query={"token": "u" * 32}), None
    )
    assert response["statusCode"] == 200
    assert table.rows["a@example.com"]["status"] == "unsubscribed"
    assert table.rows["a@example.com"]["expires_at"] > 0


@pytest.mark.parametrize(
    "query", [None, {}, {"token": ""}, {"token": "short"}, {"token": "z" * 32}]
)
def test_bad_or_unknown_tokens_are_refused(query, table):
    for path in ("/subscribe/confirm", "/subscribe/unsubscribe"):
        response = subscribe.lambda_handler(event("GET", path, query=query), None)
        assert response["statusCode"] == 400
    assert table.rows == {}


# --- Plumbing --------------------------------------------------------------


def test_api_prefix_is_stripped(table):
    table.rows["a@example.com"] = {"email": "a@example.com", "status": "pending", "token": "p" * 32}
    response = subscribe.lambda_handler(
        event("GET", "/api/subscribe/confirm", query={"token": "p" * 32}), None
    )
    assert response["statusCode"] == 200


def test_unknown_route_is_404():
    assert subscribe.lambda_handler(event("GET", "/subscribe/other"), None)["statusCode"] == 404


def test_errors_do_not_leak_internals(table, outbox, configured, turnstile_ok, monkeypatch):
    def boom(**kwargs):
        raise ClientError({"Error": {"Code": "Throttling", "Message": "internal detail"}}, "Send")

    monkeypatch.setattr(subscribe._ses, "send_email", boom)
    response = subscribe.lambda_handler(event("POST", "/subscribe", GOOD), None)
    assert response["statusCode"] == 502
    assert "internal detail" not in response["body"]
