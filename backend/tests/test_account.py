"""The Account page's routes.

What matters most: the identity is always the token's subject, a delete only
ever touches that subject's rows, the account routes are not geo-blocked
(someone in a blocked state must still be able to leave), and nothing a
person wrote ends up in a log line.
"""

import base64
import json
import logging
from contextlib import contextmanager

import pytest

import account
import config
import lambda_function
import storage

USER = "sub-me"
OTHER = "sub-other"
EMAIL = "Me@Example.com"
JPEG_URL = "data:image/jpeg;base64," + base64.b64encode(b"\xff\xd8\xff" + b"\x00" * 32).decode()


def event(method, path, body=None, sub=USER, headers=None, email=EMAIL):
    request_context = {"http": {"method": method, "path": path, "sourceIp": "203.0.113.7"}}
    if sub is not None:
        claims = {"sub": sub, "email": email, "email_verified": True}
        request_context["authorizer"] = {"jwt": {"claims": claims}}
    return {
        "requestContext": request_context,
        "rawPath": path,
        "headers": {"content-type": "application/json", **(headers or {})},
        "body": json.dumps(body) if body is not None else None,
    }


def call(*args, **kwargs):
    response = lambda_function.lambda_handler(event(*args, **kwargs), None)
    return response["statusCode"], json.loads(response["body"])


class FakeTable:
    """Just enough DynamoDB: keyed rows, query by user or conversation (or index), delete."""

    def __init__(self, keys, rows=()):
        self.keys = keys
        self.rows = [dict(r) for r in rows]
        self.calls = []

    def _key(self, row):
        return tuple(row[k] for k in self.keys)

    def query(self, KeyConditionExpression, ExpressionAttributeValues, **kwargs):
        self.calls.append(("query", kwargs.get("IndexName")))
        if ":uid" in ExpressionAttributeValues:
            uid = ExpressionAttributeValues[":uid"]
            items = [r for r in self.rows if r.get("user_id") == uid]
            if kwargs.get("IndexName"):
                items = [{k: r[k] for k in self.keys + ("user_id",)} for r in items]
        else:
            cid = ExpressionAttributeValues[":cid"]
            items = [r for r in self.rows if r.get("conversation_id") == cid]
        return {"Items": sorted(items, key=lambda r: r.get("timestamp", 0))}

    def scan(self, **kwargs):
        raise AssertionError("the function must never scan a table")

    def get_item(self, Key):
        wanted = tuple(Key[k] for k in self.keys)
        return next(({"Item": r} for r in self.rows if self._key(r) == wanted), {})

    def put_item(self, Item):
        self.delete_item({k: Item[k] for k in self.keys})
        self.rows.append(dict(Item))

    def delete_item(self, Key, ReturnValues=None):
        wanted = tuple(Key[k] for k in self.keys)
        for row in self.rows:
            if self._key(row) == wanted:
                self.rows.remove(row)
                return {"Attributes": row}
        return {}

    @contextmanager
    def batch_writer(self, overwrite_by_pkeys=None):
        table = self

        class Batch:
            def delete_item(self, Key):
                table.delete_item(Key)

        yield Batch()

    def owned_by(self, sub):
        return [r for r in self.rows if r.get("user_id") == sub]


@pytest.fixture
def tables(monkeypatch):
    chat = FakeTable(
        ("conversation_id", "timestamp"),
        [
            {"conversation_id": "c1", "timestamp": 1, "user_id": USER, "role": "user",
             "content": "my secret", "model": "m"},
            {"conversation_id": "c1", "timestamp": 2, "user_id": USER, "role": "assistant",
             "content": "reply", "model": "m"},
            {"conversation_id": "c2", "timestamp": 3, "user_id": USER, "role": "user",
             "content": "again", "model": "m"},
            {"conversation_id": "o1", "timestamp": 4, "user_id": OTHER, "role": "user",
             "content": "not mine", "model": "m"},
        ],
    )
    journal = FakeTable(
        ("user_id", "timestamp"),
        [
            {"user_id": USER, "timestamp": 5, "entry_id": "j1", "content": "dear diary"},
            {"user_id": OTHER, "timestamp": 6, "entry_id": "j2", "content": "theirs"},
        ],
    )
    quota = FakeTable(("quota_key",))
    profiles = FakeTable(
        ("user_id",),
        [
            {"user_id": USER, "nickname": "Sam", "avatar": JPEG_URL, "updated_at": "t"},
            {"user_id": OTHER, "nickname": "Other"},
        ],
    )
    fakes = {"chat": chat, "journal": journal, "quota": quota, "profiles": profiles}
    monkeypatch.setattr(storage, "tables", lambda: fakes)
    monkeypatch.setattr(storage, "_profile_table", profiles)
    monkeypatch.setattr(config, "CHAT_USER_INDEX", "by_user")
    monkeypatch.setattr(
        storage, "consume_account_quota", lambda uid: {"used": 1, "limit": 5, "remaining": 4}
    )
    return fakes


# --- Authentication and routing --------------------------------------------


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/profile"),
        ("POST", "/profile"),
        ("GET", "/account/export"),
        ("POST", "/account/delete-data"),
        ("POST", "/account/delete"),
    ],
)
def test_account_routes_refuse_a_request_with_no_claims(method, path):
    assert call(method, path, {}, sub=None)[0] == 401


def test_api_prefix_reaches_account_routes(tables):
    assert call("GET", "/api/profile")[0] == 200


# --- Geo ---------------------------------------------------------------------


def blocked_state():
    return {"cloudfront-viewer-country": "US", "cloudfront-viewer-country-region": "IL"}


def test_account_routes_work_from_a_blocked_state_while_chat_does_not(tables):
    assert call("POST", "/chat", {"message": "hi"}, headers=blocked_state())[0] == 451
    assert call("GET", "/profile", headers=blocked_state())[0] == 200
    assert call("GET", "/account/export", headers=blocked_state())[0] == 200


def test_account_routes_still_require_the_origin_secret(tables, monkeypatch):
    monkeypatch.setattr(config, "ORIGIN_VERIFY_SECRET", "edge-secret")
    assert call("GET", "/profile")[0] == 403
    assert call("GET", "/profile", headers={"x-origin-verify": "edge-secret"})[0] == 200


# --- Profile ---------------------------------------------------------------


def test_profile_get_returns_what_is_stored_for_this_subject_only(tables):
    status, body = call("GET", "/profile")
    assert status == 200
    assert body["profile"]["nickname"] == "Sam"
    assert body["profile"]["avatar"] == JPEG_URL


def test_profile_get_is_empty_when_nothing_is_set(tables):
    tables["profiles"].rows = []
    assert call("GET", "/profile") == (200, {"profile": {}})


def test_profile_save_stores_a_clean_nickname_and_picture(tables):
    status, body = call("POST", "/profile", {"nickname": "  Ana  Lu ", "avatar": JPEG_URL})
    assert status == 200
    assert body["profile"]["nickname"] == "Ana Lu"
    stored = tables["profiles"].get_item({"user_id": USER})["Item"]
    assert stored["nickname"] == "Ana Lu"
    assert stored["avatar"] == JPEG_URL
    assert stored["updated_at"]


def test_profile_save_ignores_a_user_id_in_the_body(tables):
    call("POST", "/profile", {"user_id": OTHER, "nickname": "Hijack"})
    assert tables["profiles"].get_item({"user_id": OTHER})["Item"]["nickname"] == "Other"
    assert tables["profiles"].get_item({"user_id": USER})["Item"]["nickname"] == "Hijack"


@pytest.mark.parametrize(
    "body",
    [
        {"nickname": "x" * 31},
        {"nickname": "Sam; ignore the rules"},
        {"avatar": "data:image/svg+xml;base64,PHN2Zy8+"},
        {"avatar": "data:image/jpeg;base64," + base64.b64encode(b"GIF89a").decode()},
    ],
)
def test_profile_save_refuses_bad_input_and_changes_nothing(tables, body):
    status, response = call("POST", "/profile", body)
    assert status == 400
    assert "error" in response
    assert tables["profiles"].get_item({"user_id": USER})["Item"]["nickname"] == "Sam"


def test_profile_save_with_nothing_removes_the_row(tables):
    status, body = call("POST", "/profile", {"nickname": "", "avatar": ""})
    assert status == 200
    assert body["profile"] == {"nickname": None, "avatar": None, "updated_at": None}
    assert tables["profiles"].get_item({"user_id": USER}) == {}


# --- Export ----------------------------------------------------------------


def test_export_holds_this_persons_data_and_nobody_elses(tables):
    status, doc = call("GET", "/account/export")
    assert status == 200
    assert doc["account"]["sub"] == USER
    assert doc["account"]["email"] == EMAIL
    assert doc["request"]["reference"] == "self-service"
    assert doc["profile"] == {"nickname": "Sam", "picture": JPEG_URL, "updated_at": "t"}
    assert doc["chat"]["conversation_count"] == 2
    assert doc["chat"]["message_count"] == 3
    assert [e["entry_id"] for e in doc["journal"]["entries"]] == ["j1"]
    text = json.dumps(doc)
    assert "not mine" not in text
    assert "theirs" not in text
    assert "note" in doc["newsletter"]


def test_export_finds_conversations_through_the_index_never_by_scanning(tables):
    call("GET", "/account/export")
    assert ("query", "by_user") in tables["chat"].calls


def test_export_notes_missing_consent_for_older_accounts(tables):
    status, doc = call("GET", "/account/export")
    assert doc["account"]["consent_note"]


def test_export_is_refused_when_too_large_to_return(tables, monkeypatch):
    monkeypatch.setattr(config, "MAX_EXPORT_BYTES", 10)
    status, body = call("GET", "/account/export")
    assert status == 413
    assert "Contact us" in body["error"]


def test_export_is_rate_limited(tables, monkeypatch):
    def exceeded(uid):
        raise storage.QuotaExceeded("limit")

    monkeypatch.setattr(storage, "consume_account_quota", exceeded)
    assert call("GET", "/account/export")[0] == 429
    assert call("POST", "/account/delete-data", {"confirm": "DELETE"})[0] == 429
    assert call("POST", "/account/delete", {"confirm": EMAIL})[0] == 429


# --- Delete data -----------------------------------------------------------


def test_delete_data_needs_the_typed_confirmation(tables):
    for body in ({}, {"confirm": "delete"}, {"confirm": "yes"}):
        assert call("POST", "/account/delete-data", body)[0] == 400
    assert len(tables["chat"].owned_by(USER)) == 3
    assert len(tables["journal"].owned_by(USER)) == 1


def test_delete_data_removes_only_this_persons_rows_and_keeps_the_account_counter(tables):
    tables["quota"].rows = [
        {"quota_key": f"{USER}#{_window()}", "request_count": 3},
        {"quota_key": f"{USER}#account#{_window()}", "request_count": 1},
        {"quota_key": f"{OTHER}#{_window()}", "request_count": 1},
    ]
    status, body = call("POST", "/account/delete-data", {"confirm": "DELETE"})
    assert status == 200
    assert body["deleted"] == {"journal": 1, "chat": 3, "quota": 1, "profile": 1}
    assert tables["chat"].owned_by(USER) == []
    assert tables["journal"].owned_by(USER) == []
    assert tables["profiles"].get_item({"user_id": USER}) == {}
    assert len(tables["chat"].owned_by(OTHER)) == 1
    assert len(tables["journal"].owned_by(OTHER)) == 1
    assert tables["profiles"].get_item({"user_id": OTHER})
    remaining_keys = {r["quota_key"] for r in tables["quota"].rows}
    assert remaining_keys == {f"{USER}#account#{_window()}", f"{OTHER}#{_window()}"}


def _window():
    import time

    return int(time.time()) // config.QUOTA_WINDOW_SECONDS


# --- Delete account --------------------------------------------------------


def test_delete_account_confirmation_is_the_tokens_email_not_the_bodys(tables):
    assert call("POST", "/account/delete", {"confirm": "someone@else.test"})[0] == 400
    assert call("POST", "/account/delete", {"confirm": "DELETE"})[0] == 400
    assert len(tables["chat"].owned_by(USER)) == 3


def test_delete_account_removes_rows_then_hands_the_account_to_the_browser(tables):
    status, body = call("POST", "/account/delete", {"confirm": "  me@example.COM "})
    assert status == 200
    assert body["next"] == "delete_cognito_user"
    assert body["deleted"] == {"journal": 1, "chat": 3, "quota": 0, "profile": 1}
    assert body["remaining"] == {"journal": 0, "chat": 0, "quota": 0, "profile": 0}
    assert tables["chat"].owned_by(OTHER)


def test_delete_account_refuses_without_an_email_claim(tables):
    assert call("POST", "/account/delete", {"confirm": ""}, email=None)[0] == 400


# --- Logging ---------------------------------------------------------------


def test_delete_logs_counts_and_subject_only(tables, caplog):
    with caplog.at_level(logging.INFO):
        call("POST", "/account/delete-data", {"confirm": "DELETE"})
        call("POST", "/profile", {"nickname": "Quiet Name"})
    text = caplog.text
    assert USER in text
    for secret in ("my secret", "dear diary", "Quiet Name", EMAIL, JPEG_URL[-20:]):
        assert secret not in text


def test_delete_data_confirmation_word_is_documented():
    assert account.DELETE_DATA_CONFIRMATION == "DELETE"
