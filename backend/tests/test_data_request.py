"""Privacy requests: export and delete for one address.

A delete is irreversible on the chat and journal tables (no point-in-time
recovery there), so these tests care most about deleting the wrong rows,
deleting the account before the rows that hang off it, and saying anything
identifying on a public run log.
"""

import json
import re
import time
from contextlib import contextmanager
from decimal import Decimal

import pytest
from botocore.exceptions import ClientError

import config
import data_request as dr

EMAIL = "someone@example.com"
SUB = "sub-1"
STRANGER_SUB = "sub-2"
POLICY_DATE = "2026-09-16"


class FakeCognito:
    def __init__(self, users, log):
        self.users = users
        self.log = log
        self.deleted = []

    def list_users(self, UserPoolId, Filter, Limit):
        wanted = re.fullmatch(r'email = "(.*)"', Filter).group(1)
        found = [u for u in self.users if u["attrs"].get("email") == wanted]
        self.log.append("cognito.list_users")
        return {
            "Users": [
                {
                    "Username": u["username"],
                    "UserStatus": "CONFIRMED",
                    "Enabled": True,
                    "UserCreateDate": u.get("created"),
                    "Attributes": [{"Name": k, "Value": v} for k, v in u["attrs"].items()],
                }
                for u in found[:Limit]
            ]
        }

    def admin_delete_user(self, UserPoolId, Username):
        self.log.append("cognito.admin_delete_user")
        self.deleted.append(Username)
        self.users = [u for u in self.users if u["username"] != Username]


class FakeTable:
    """Query, scan, get, delete and batch delete, with pagination and a failure switch."""

    def __init__(self, name, keys, rows, log, page_size=100, fail_delete=False):
        self.name = name
        self.keys = keys
        self.rows = list(rows)
        self.log = log
        self.page_size = page_size
        self.fail_delete = fail_delete

    def _key_of(self, row):
        return tuple(row[k] for k in self.keys)

    def _page(self, items, kwargs):
        start = kwargs.get("ExclusiveStartKey")
        if start is not None:
            items = items[start["offset"] :]
        page = items[: self.page_size]
        result = {"Items": page}
        if len(items) > self.page_size:
            consumed = (start["offset"] if start else 0) + self.page_size
            result["LastEvaluatedKey"] = {"offset": consumed}
        return result

    def query(self, KeyConditionExpression, ExpressionAttributeValues, **kwargs):
        self.log.append(f"{self.name}.query")
        uid = ExpressionAttributeValues[":uid"]
        items = sorted((r for r in self.rows if r["user_id"] == uid), key=lambda r: r["timestamp"])
        return self._page(items, kwargs)

    def scan(self, FilterExpression, ExpressionAttributeValues, **kwargs):
        self.log.append(f"{self.name}.scan")
        uid = ExpressionAttributeValues[":uid"]
        return self._page([r for r in self.rows if r.get("user_id") == uid], kwargs)

    def get_item(self, Key):
        wanted = tuple(Key[k] for k in self.keys)
        for row in self.rows:
            if self._key_of(row) == wanted:
                return {"Item": row}
        return {}

    def delete_item(self, Key, ReturnValues=None):
        self.log.append(f"{self.name}.delete_item")
        if self.fail_delete:
            raise ClientError({"Error": {"Code": "Boom", "Message": EMAIL}}, "DeleteItem")
        wanted = tuple(Key[k] for k in self.keys)
        for row in self.rows:
            if self._key_of(row) == wanted:
                self.rows.remove(row)
                return {"Attributes": row}
        return {}

    @contextmanager
    def batch_writer(self, overwrite_by_pkeys=None):
        self.log.append(f"{self.name}.batch_delete")
        table = self

        class Batch:
            def delete_item(self, Key):
                table.delete_item(Key)

        yield Batch()


class ExplodingClients:
    def __getattr__(self, name):
        raise AssertionError(f"AWS must not be touched, but {name} was read")


def make_clients(log, *, with_account=True, with_subscriber=True, page_size=100):
    now_ms = 1_700_000_000_000
    users = [{"username": "stranger-uuid", "attrs": {"sub": STRANGER_SUB, "email": "x@y.zz"}}]
    if with_account:
        users.insert(
            0,
            {
                "username": "someone-uuid",
                "attrs": {
                    "sub": SUB,
                    "email": EMAIL,
                    "email_verified": "true",
                    "custom:age_attested": "true",
                    "custom:policies_accepted": POLICY_DATE,
                },
            },
        )
    journal = [
        {"user_id": SUB, "timestamp": Decimal(now_ms + 20), "entry_id": "j2", "content": "second"},
        {"user_id": SUB, "timestamp": Decimal(now_ms + 10), "entry_id": "j1", "content": "first"},
        {
            "user_id": SUB,
            "timestamp": Decimal(now_ms + 30),
            "entry_id": "j3",
            "content": "third",
            "title": "T",
            "mood": "ok",
            "tags": ["a", "b"],
        },
        {"user_id": STRANGER_SUB, "timestamp": Decimal(now_ms), "entry_id": "s1", "content": "x"},
    ]
    chat = [
        {"conversation_id": "c2", "timestamp": Decimal(now_ms + 50), "user_id": SUB,
         "role": "user", "content": "later convo", "model": "m"},
        {"conversation_id": "c1", "timestamp": Decimal(now_ms + 2), "user_id": SUB,
         "role": "assistant", "content": "reply", "model": "m"},
        {"conversation_id": "c1", "timestamp": Decimal(now_ms + 1), "user_id": SUB,
         "role": "user", "content": "hello", "model": "m"},
        {"conversation_id": "c2", "timestamp": Decimal(now_ms + 51), "user_id": SUB,
         "role": "assistant", "content": "later reply", "model": "m"},
        {"conversation_id": "c1", "timestamp": Decimal(now_ms + 3), "user_id": SUB,
         "role": "user", "content": "more", "model": "m"},
        {"conversation_id": "s", "timestamp": Decimal(now_ms), "user_id": STRANGER_SUB,
         "role": "user", "content": "stranger", "model": "m"},
    ]
    window = int(time.time()) // config.QUOTA_WINDOW_SECONDS
    quota = [
        {"quota_key": f"{SUB}#{window}", "request_count": Decimal(3)},
        {"quota_key": f"{SUB}#{window - 40}", "request_count": Decimal(9)},  # outside range
        {"quota_key": f"{STRANGER_SUB}#{window}", "request_count": Decimal(1)},
    ]
    subscribers = [{"email": "x@y.zz", "status": "confirmed", "token": "st"}]
    if with_subscriber:
        subscribers.insert(
            0,
            {
                "email": EMAIL,
                "status": "confirmed",
                "token": "secret-token",
                "created_at": Decimal(1),
                "source": "support",
                "confirmed_at": Decimal(2),
            },
        )
    return dr.Clients(
        cognito=FakeCognito(users, log),
        chat=FakeTable("chat", ("conversation_id", "timestamp"), chat, log, page_size),
        journal=FakeTable("journal", ("user_id", "timestamp"), journal, log, page_size),
        quota=FakeTable("quota", ("quota_key",), quota, log, page_size),
        subscribers=FakeTable("subscribers", ("email",), subscribers, log, page_size),
        user_pool_id="pool",
    )


@pytest.fixture
def log():
    return []


@pytest.fixture
def clients(log):
    return make_clients(log)


def stranger_intact(c):
    assert any(u["attrs"]["sub"] == STRANGER_SUB for u in c.cognito.users)
    assert any(r["user_id"] == STRANGER_SUB for r in c.journal.rows)
    assert any(r["user_id"] == STRANGER_SUB for r in c.chat.rows)
    assert any(r["quota_key"].startswith(STRANGER_SUB) for r in c.quota.rows)
    assert any(r["email"] == "x@y.zz" for r in c.subscribers.rows)


# --- Export ----------------------------------------------------------------


def test_unknown_email_exports_nothing_held(clients):
    doc = dr.build_export(clients, "nobody@example.com")
    assert doc["account"] is None
    assert doc["chat"]["message_count"] == 0
    assert doc["journal"]["entry_count"] == 0
    assert doc["newsletter"] is None
    assert dr.export_counts(doc) == {
        "account": 0,
        "conversations": 0,
        "chat_messages": 0,
        "journal_entries": 0,
        "newsletter": 0,
        "quota_rows": 0,
    }


def test_export_has_every_section(clients):
    doc = dr.build_export(clients, EMAIL, reference="#7")
    assert set(doc) == {
        "generated_at", "request", "policy", "account", "chat", "journal",
        "newsletter", "quota", "not_included",
    }
    assert doc["request"] == {"email": EMAIL, "reference": "#7"}
    assert doc["policy"]["privacy"].endswith("/legal#privacy")
    assert doc["account"]["sub"] == SUB
    assert doc["not_included"]


def test_export_groups_chat_by_conversation_in_timestamp_order(clients):
    doc = dr.build_export(clients, EMAIL)
    convs = doc["chat"]["conversations"]
    assert [c["conversation_id"] for c in convs] == ["c1", "c2"]
    assert [m["content"] for m in convs[0]["messages"]] == ["hello", "reply", "more"]
    assert doc["chat"]["conversation_count"] == 2
    assert doc["chat"]["message_count"] == 5


def test_export_lists_journal_in_timestamp_order(clients):
    doc = dr.build_export(clients, EMAIL)
    assert [e["entry_id"] for e in doc["journal"]["entries"]] == ["j1", "j2", "j3"]
    assert doc["journal"]["entries"][2]["tags"] == ["a", "b"]


def test_export_is_json_serialisable_with_plain_ints(clients):
    doc = dr.build_export(clients, EMAIL)
    text = json.dumps(doc)
    assert "Decimal" not in text
    assert isinstance(doc["journal"]["entries"][0]["timestamp"], int)


def test_export_includes_consent_attributes(clients):
    doc = dr.build_export(clients, EMAIL)
    assert doc["account"]["age_attested"] == "true"
    assert doc["account"]["policies_accepted"] == POLICY_DATE
    assert "consent_note" not in doc["account"]


def test_export_marks_older_accounts_without_consent(log):
    c = make_clients(log)
    for u in c.cognito.users:
        u["attrs"].pop("custom:age_attested", None)
        u["attrs"].pop("custom:policies_accepted", None)
    doc = dr.build_export(c, EMAIL)
    assert doc["account"]["age_attested"] is None
    assert doc["account"]["consent_note"] == dr.CONSENT_NOTE


def test_export_omits_subscriber_token(clients):
    doc = dr.build_export(clients, EMAIL)
    assert doc["newsletter"]["status"] == "confirmed"
    assert "token" not in doc["newsletter"]
    assert "secret-token" not in json.dumps(doc)


def test_export_quota_is_counts_only(clients):
    doc = dr.build_export(clients, EMAIL)
    assert doc["quota"] == {
        "windows_checked": 4,
        "rows_found": 1,
        "note": "Daily message counters, no content. They expire within about two days.",
    }


def test_newsletter_only_email_export(log):
    c = make_clients(log, with_account=False)
    doc = dr.build_export(c, EMAIL)
    assert doc["account"] is None
    assert doc["newsletter"]["source"] == "support"


# --- Delete ----------------------------------------------------------------


def test_delete_removes_only_this_persons_rows(clients):
    result = dr.delete_all(clients, EMAIL, confirm=EMAIL)
    assert (result.journal, result.chat, result.quota, result.subscriber, result.account) == (
        3, 5, 1, 1, 1,
    )
    assert clients.cognito.deleted == ["someone-uuid"]
    stranger_intact(clients)
    assert dr.verify_gone(clients, EMAIL) == {
        "account": 0, "journal": 0, "chat": 0, "quota": 0, "subscriber": 0,
    }


def test_delete_order_is_tables_first_then_cognito(clients, log):
    dr.delete_all(clients, EMAIL, confirm=EMAIL)
    writes = [entry for entry in log if "delete" in entry]
    assert writes[0] == "journal.batch_delete"
    assert writes.index("chat.batch_delete") > writes.index("journal.batch_delete")
    assert writes.index("subscribers.delete_item") > writes.index("chat.batch_delete")
    assert writes[-1] == "cognito.admin_delete_user"


def test_cognito_is_not_deleted_when_a_table_delete_fails(clients):
    clients.chat.fail_delete = True
    with pytest.raises(ClientError):
        dr.delete_all(clients, EMAIL, confirm=EMAIL)
    assert clients.cognito.deleted == []
    assert any(u["attrs"]["sub"] == SUB for u in clients.cognito.users)


def test_unknown_email_delete_is_a_noop(clients):
    result = dr.delete_all(clients, "nobody@example.com", confirm="nobody@example.com")
    assert (result.journal, result.chat, result.quota, result.subscriber, result.account) == (
        0, 0, 0, 0, 0,
    )
    assert clients.cognito.deleted == []
    stranger_intact(clients)


def test_newsletter_only_email_delete(log):
    c = make_clients(log, with_account=False)
    result = dr.delete_all(c, EMAIL, confirm=EMAIL)
    assert result.subscriber == 1
    assert result.account == 0
    assert c.cognito.deleted == []
    assert not any(r["email"] == EMAIL for r in c.subscribers.rows)


def test_account_without_subscriber_row(log):
    c = make_clients(log, with_subscriber=False)
    result = dr.delete_all(c, EMAIL, confirm=EMAIL)
    assert result.subscriber == 0
    assert result.account == 1


def test_confirm_mismatch_is_refused_before_any_aws_call():
    with pytest.raises(dr.ConfirmationMismatch):
        dr.delete_all(ExplodingClients(), EMAIL, confirm="someone-else@example.com")


def test_pagination_is_followed_for_query_and_scan(log):
    c = make_clients(log, page_size=2)
    doc = dr.build_export(c, EMAIL)
    assert doc["journal"]["entry_count"] == 3
    assert doc["chat"]["message_count"] == 5
    assert log.count("journal.query") == 2
    assert log.count("chat.scan") == 3


def test_ambiguous_account_is_refused_and_deletes_nothing(clients):
    clients.cognito.users.append({"username": "dupe", "attrs": {"sub": "sub-9", "email": EMAIL}})
    with pytest.raises(dr.AmbiguousAccount):
        dr.delete_all(clients, EMAIL, confirm=EMAIL)
    assert clients.cognito.deleted == []
    assert len(clients.journal.rows) == 4


def test_email_is_normalised():
    assert dr.normalize_email("  Someone@Example.COM ") == EMAIL


@pytest.mark.parametrize("bad", ['a"b@example.com', "a\\b@example.com", "nope", "", "a@b"])
def test_unsafe_or_malformed_email_is_rejected(bad):
    with pytest.raises(dr.DataRequestError):
        dr.normalize_email(bad)


def test_delete_is_idempotent(clients):
    dr.delete_all(clients, EMAIL, confirm=EMAIL)
    again = dr.delete_all(clients, EMAIL, confirm=EMAIL)
    assert (again.journal, again.chat, again.quota, again.subscriber, again.account) == (
        0, 0, 0, 0, 0,
    )


# --- CLI -------------------------------------------------------------------


def test_main_exits_2_on_confirm_mismatch_without_building_clients(monkeypatch, capsys):
    monkeypatch.setattr(dr, "build_clients", lambda: pytest.fail("clients must not be built"))
    code = dr.main(["--email", EMAIL, "--action", "delete", "--confirm", "wrong@example.com"])
    assert code == 2
    assert "confirmation" in capsys.readouterr().err.lower()


def test_main_export_writes_file_and_prints_only_counts(monkeypatch, capsys, tmp_path, log):
    monkeypatch.setattr(dr, "build_clients", lambda: make_clients(log))
    out = tmp_path / "export.json"
    summary = tmp_path / "summary.md"
    code = dr.main(
        ["--email", EMAIL, "--action", "export", "--reference", "#7",
         "--out", str(out), "--summary", str(summary)]
    )
    assert code == 0
    doc = json.loads(out.read_text())
    assert doc["chat"]["message_count"] == 5
    printed = capsys.readouterr()
    for text in (printed.out, printed.err, summary.read_text()):
        assert EMAIL not in text
        assert "hello" not in text
        assert "secret-token" not in text
    assert "| chat_messages | 5 |" in summary.read_text()


def test_main_delete_reports_remaining_zero(monkeypatch, capsys, tmp_path, log):
    monkeypatch.setattr(dr, "build_clients", lambda: make_clients(log))
    summary = tmp_path / "summary.md"
    code = dr.main(
        ["--email", EMAIL, "--action", "delete", "--confirm", EMAIL, "--summary", str(summary)]
    )
    assert code == 0
    text = summary.read_text()
    assert "| account | 1 |" in text
    assert "| remaining account | 0 |" in text
    assert EMAIL not in text


def test_main_never_prints_the_address_on_aws_failure(monkeypatch, capsys, log):
    c = make_clients(log)
    c.chat.fail_delete = True
    monkeypatch.setattr(dr, "build_clients", lambda: c)
    code = dr.main(["--email", EMAIL, "--action", "delete", "--confirm", EMAIL])
    assert code == 1
    printed = capsys.readouterr()
    assert EMAIL not in printed.err + printed.out
    assert "DeleteItem Boom" in printed.err
