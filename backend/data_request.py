"""Serve a privacy request for one email address: export what we hold, or delete it.

The Privacy Policy promises that anyone can get a copy of what we hold about
them and can have their account and everything in it deleted within 30 days.
This is the code behind that promise. It is run by
.github/workflows/data-request.yml under the deploy role, never by a Lambda:
the Lambda roles cannot Scan or Delete, so although `sam build` packages this
file with the functions (CodeUri is the whole backend folder) it is inert
there.

Two rules shape everything below.

1. Nothing printed may identify the person or quote their data. The
   repository is public, so a workflow's log and step summary are public.
   Stdout and the summary carry counts only. The export itself goes to a file
   the workflow encrypts before uploading.

2. The Cognito account is deleted last. The only link between an email
   address and the rows in the chat and journal tables is the Cognito `sub`,
   so deleting the account first would strand those rows where nobody could
   find them again. Table deletes run first, and any failure stops the run
   before the account is touched.

Clients are passed in explicitly rather than built at import, so the tests
can hand in fakes and the "Cognito last" rule is directly testable.
"""

import argparse
import json
import os
import re
import sys
import time
from collections.abc import Iterator
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any

import config

# Quota rows live about two days (TTL), keyed by "<sub>#<day window>". There
# is no index, so the candidate keys are computed rather than searched for.
QUOTA_WINDOWS_BACK = 2
QUOTA_WINDOWS_FORWARD = 1

# Like subscribe.EMAIL_RE, and additionally refusing quotes and backslashes:
# the address is embedded in a Cognito ListUsers filter string.
EMAIL_RE = re.compile(r'^[^\s@"\\]{1,64}@[^\s@"\\]{1,253}\.[^\s@"\\]{2,63}$')

# Things a person may reasonably expect in an export that this tool cannot
# reach, so the export says so instead of implying they do not exist.
NOT_INCLUDED = [
    "API access logs and function logs in CloudWatch: IP address, account id, "
    "route and time, never message text. They expire 30 days after being written.",
    "Point-in-time-recovery backups of the newsletter table, kept 35 days.",
]

CONSENT_NOTE = (
    "Accounts created before consent was recorded at sign-up have no attestation "
    "on file; the Terms in force at the time still applied."
)


class DataRequestError(Exception):
    """Operator-facing message. Must never contain an address or stored content."""


class ConfirmationMismatch(DataRequestError):
    pass


class AmbiguousAccount(DataRequestError):
    pass


@dataclass
class Clients:
    cognito: Any
    chat: Any
    journal: Any
    quota: Any
    subscribers: Any
    user_pool_id: str


@dataclass
class DeleteResult:
    journal: int = 0
    chat: int = 0
    quota: int = 0
    subscriber: int = 0
    account: int = 0
    remaining: dict[str, int] = field(default_factory=dict)


def build_clients() -> Clients:
    """Real AWS clients from the environment. Imported lazily so tests never need boto3 wired."""
    import boto3  # only the CLI path needs it; tests inject fakes

    if not config.COGNITO_USER_POOL_ID:
        raise DataRequestError("COGNITO_USER_POOL_ID is not set")
    dynamodb = boto3.resource("dynamodb", region_name=config.AWS_REGION)
    return Clients(
        cognito=boto3.client("cognito-idp", region_name=config.AWS_REGION),
        chat=dynamodb.Table(config.CHAT_TABLE),
        journal=dynamodb.Table(config.JOURNAL_TABLE),
        quota=dynamodb.Table(config.QUOTA_TABLE),
        subscribers=dynamodb.Table(config.SUBSCRIBER_TABLE),
        user_pool_id=config.COGNITO_USER_POOL_ID,
    )


# --- Lookups ---------------------------------------------------------------


def normalize_email(email: str) -> str:
    cleaned = (email or "").strip().lower()
    if not EMAIL_RE.match(cleaned):
        raise DataRequestError("That does not look like an email address")
    return cleaned


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.astimezone(UTC).isoformat()
    return str(value)


def find_account(clients: Clients, email: str) -> dict | None:
    """The Cognito account for an address, or None. Refuses to guess between two."""
    result = clients.cognito.list_users(
        UserPoolId=clients.user_pool_id, Filter=f'email = "{email}"', Limit=2
    )
    users = result.get("Users", [])
    if not users:
        return None
    if len(users) > 1:
        raise AmbiguousAccount("More than one account matches that address")
    user = users[0]
    attrs = {a["Name"]: a["Value"] for a in user.get("Attributes", [])}
    return {
        # The internal username is what admin_delete_user needs; with email as
        # the sign-in alias it is a UUID, not the address.
        "username": user["Username"],
        "sub": attrs.get("sub"),
        "email": attrs.get("email"),
        "email_verified": attrs.get("email_verified"),
        "status": user.get("UserStatus"),
        "enabled": user.get("Enabled"),
        "created_at": _iso(user.get("UserCreateDate")),
        "updated_at": _iso(user.get("UserLastModifiedDate")),
        "age_attested": attrs.get("custom:age_attested"),
        "policies_accepted": attrs.get("custom:policies_accepted"),
    }


def _paginate(method, **kwargs) -> Iterator[dict]:
    """Follow LastEvaluatedKey until DynamoDB stops returning one."""
    start = None
    while True:
        if start is not None:
            kwargs["ExclusiveStartKey"] = start
        page = method(**kwargs)
        yield from page.get("Items", [])
        start = page.get("LastEvaluatedKey")
        if not start:
            return


def collect_journal(clients: Clients, sub: str) -> list[dict]:
    return list(
        _paginate(
            clients.journal.query,
            KeyConditionExpression="user_id = :uid",
            ExpressionAttributeValues={":uid": sub},
            ScanIndexForward=True,
        )
    )


def collect_chat(clients: Clients, sub: str) -> list[dict]:
    """Every chat row for one person.

    The chat table is keyed by conversation, and nothing on the server lists a
    person's conversations, so this reads the whole table and filters. Fine at
    today's size; a keys-only index on user_id is the fix if that changes.
    """
    return list(
        _paginate(
            clients.chat.scan,
            FilterExpression="user_id = :uid",
            ExpressionAttributeValues={":uid": sub},
        )
    )


def quota_keys(sub: str, now: float | None = None) -> list[str]:
    window = int(now if now is not None else time.time()) // config.QUOTA_WINDOW_SECONDS
    return [
        f"{sub}#{w}"
        for w in range(window - QUOTA_WINDOWS_BACK, window + QUOTA_WINDOWS_FORWARD + 1)
    ]


def collect_quota(clients: Clients, sub: str) -> list[dict]:
    rows = []
    for key in quota_keys(sub):
        item = clients.quota.get_item(Key={"quota_key": key}).get("Item")
        if item:
            rows.append(item)
    return rows


def find_subscriber(clients: Clients, email: str) -> dict | None:
    return clients.subscribers.get_item(Key={"email": email}).get("Item")


# --- Export ----------------------------------------------------------------


def to_plain(value: Any) -> Any:
    """DynamoDB types into JSON types, recursively."""
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    if isinstance(value, dict):
        return {k: to_plain(v) for k, v in value.items()}
    if isinstance(value, list | tuple):
        return [to_plain(v) for v in value]
    if isinstance(value, set | frozenset):
        return sorted(to_plain(v) for v in value)
    if isinstance(value, datetime):
        return _iso(value)
    return value


def group_conversations(messages: list[dict]) -> list[dict]:
    by_id: dict[str, list[dict]] = {}
    for row in messages:
        by_id.setdefault(row["conversation_id"], []).append(row)
    conversations = []
    for conversation_id, rows in by_id.items():
        rows.sort(key=lambda r: int(r["timestamp"]))
        conversations.append(
            {
                "conversation_id": conversation_id,
                "first_message_at": int(rows[0]["timestamp"]),
                "messages": [
                    {
                        "timestamp": int(r["timestamp"]),
                        "role": r.get("role"),
                        "content": r.get("content"),
                        "model": r.get("model"),
                    }
                    for r in rows
                ],
            }
        )
    conversations.sort(key=lambda c: c["first_message_at"])
    return conversations


def _journal_entry(row: dict) -> dict:
    return {
        "entry_id": row.get("entry_id"),
        "timestamp": int(row["timestamp"]),
        "created_at": row.get("created_at"),
        "title": row.get("title"),
        "mood": row.get("mood"),
        "tags": list(row.get("tags") or []),
        "content": row.get("content"),
    }


def _newsletter_view(row: dict | None) -> dict | None:
    if not row:
        return None
    # Never the token: it is the unsubscribe credential.
    keys = ("status", "created_at", "source", "confirmed_at", "unsubscribed_at", "expires_at")
    return {k: row.get(k) for k in keys}


def build_export(clients: Clients, email: str, reference: str = "") -> dict:
    account = find_account(clients, email)
    chat_rows: list[dict] = []
    journal_rows: list[dict] = []
    quota_rows: list[dict] = []
    if account:
        journal_rows = collect_journal(clients, account["sub"])
        chat_rows = collect_chat(clients, account["sub"])
        quota_rows = collect_quota(clients, account["sub"])
        if not account["age_attested"]:
            account = {**account, "consent_note": CONSENT_NOTE}

    journal_rows.sort(key=lambda r: int(r["timestamp"]))
    conversations = group_conversations(chat_rows)

    return to_plain(
        {
            "generated_at": datetime.now(UTC).isoformat(),
            "request": {"email": email, "reference": reference},
            "policy": {
                "privacy": f"{config.SITE_URL}/legal#privacy",
                "terms": f"{config.SITE_URL}/legal#terms",
                "sections": [
                    "Privacy Policy section 4, How long we keep it",
                    "Privacy Policy section 7, Your choices and rights",
                ],
            },
            "account": account,
            "chat": {
                "conversation_count": len(conversations),
                "message_count": len(chat_rows),
                "conversations": conversations,
            },
            "journal": {
                "entry_count": len(journal_rows),
                "entries": [_journal_entry(r) for r in journal_rows],
            },
            "newsletter": _newsletter_view(find_subscriber(clients, email)),
            "quota": {
                "windows_checked": QUOTA_WINDOWS_BACK + QUOTA_WINDOWS_FORWARD + 1,
                "rows_found": len(quota_rows),
                "note": "Daily message counters, no content. They expire within about two days.",
            },
            "not_included": NOT_INCLUDED,
        }
    )


def export_counts(doc: dict) -> dict[str, int]:
    return {
        "account": 1 if doc["account"] else 0,
        "conversations": doc["chat"]["conversation_count"],
        "chat_messages": doc["chat"]["message_count"],
        "journal_entries": doc["journal"]["entry_count"],
        "newsletter": 1 if doc["newsletter"] else 0,
        "quota_rows": doc["quota"]["rows_found"],
    }


# --- Delete ----------------------------------------------------------------


def _batch_delete(table, rows: list[dict], key_names: tuple[str, str]) -> int:
    if not rows:
        return 0
    with table.batch_writer(overwrite_by_pkeys=list(key_names)) as batch:
        for row in rows:
            batch.delete_item(Key={k: row[k] for k in key_names})
    return len(rows)


def _delete_one(table, key: dict) -> int:
    response = table.delete_item(Key=key, ReturnValues="ALL_OLD")
    return 1 if response.get("Attributes") else 0


def delete_all(clients: Clients, email: str, *, confirm: str) -> DeleteResult:
    """Everything, in dependency order, the account last.

    Raises ConfirmationMismatch before touching AWS. Any failure in a table
    delete propagates and leaves the account in place, so the rows can still
    be found on a retry.
    """
    if (confirm or "").strip().lower() != email:
        raise ConfirmationMismatch("The confirmation does not match the email address")

    result = DeleteResult()
    account = find_account(clients, email)

    if account:
        sub = account["sub"]
        result.journal = _batch_delete(
            clients.journal, collect_journal(clients, sub), ("user_id", "timestamp")
        )
        result.chat = _batch_delete(
            clients.chat, collect_chat(clients, sub), ("conversation_id", "timestamp")
        )
        result.quota = sum(
            _delete_one(clients.quota, {"quota_key": key}) for key in quota_keys(sub)
        )

    # Newsletter rows are keyed by address and exist with or without an account.
    result.subscriber = _delete_one(clients.subscribers, {"email": email})

    if account:
        clients.cognito.admin_delete_user(
            UserPoolId=clients.user_pool_id, Username=account["username"]
        )
        result.account = 1

    return result


def verify_gone(clients: Clients, email: str) -> dict[str, int]:
    """What is still there. A signed-in session can write rows for up to an hour after deletion."""
    account = find_account(clients, email)
    remaining = {"account": 1 if account else 0, "journal": 0, "chat": 0, "quota": 0}
    if account:
        remaining["journal"] = len(collect_journal(clients, account["sub"]))
        remaining["chat"] = len(collect_chat(clients, account["sub"]))
        remaining["quota"] = len(collect_quota(clients, account["sub"]))
    remaining["subscriber"] = 1 if find_subscriber(clients, email) else 0
    return remaining


# --- CLI -------------------------------------------------------------------


def write_summary(path: str | None, title: str, counts: dict) -> None:
    lines = [f"### Data request: {title}", "", "| What | Count |", "|---|---|"]
    lines += [f"| {k} | {v} |" for k, v in counts.items()]
    text = "\n".join(lines) + "\n"
    if path:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(text)
    print(text)


def _parse(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("--email", required=True)
    parser.add_argument("--action", required=True, choices=["export", "delete"])
    parser.add_argument("--confirm", default="", help="delete only: the email again")
    parser.add_argument("--reference", default="", help="issue number for the audit trail")
    parser.add_argument("--out", default="export.json", help="where the export is written")
    parser.add_argument("--summary", default=os.environ.get("GITHUB_STEP_SUMMARY"))
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse(argv)
    try:
        email = normalize_email(args.email)
        if args.action == "delete" and (args.confirm or "").strip().lower() != email:
            raise ConfirmationMismatch("The confirmation does not match the email address")
    except DataRequestError as exc:
        print(f"Refused: {exc}", file=sys.stderr)
        return 2

    try:
        clients = build_clients()
        if args.action == "export":
            doc = build_export(clients, email, args.reference)
            with open(args.out, "w", encoding="utf-8") as fh:
                json.dump(doc, fh, indent=2, ensure_ascii=False)
            counts = export_counts(doc)
            counts["reference"] = args.reference or "(none)"
            write_summary(args.summary, "export", counts)
            return 0

        result = delete_all(clients, email, confirm=args.confirm)
        result.remaining = verify_gone(clients, email)
        counts = {k: v for k, v in asdict(result).items() if k != "remaining"}
        counts.update({f"remaining {k}": v for k, v in result.remaining.items()})
        counts["reference"] = args.reference or "(none)"
        write_summary(args.summary, "delete", counts)
        if any(result.remaining.values()):
            print("Some rows remain; run the delete again in an hour.", file=sys.stderr)
            return 1
        return 0
    except DataRequestError as exc:
        print(f"Failed: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:  # broad on purpose: the message may echo the address
        code = getattr(exc, "response", {}).get("Error", {}).get("Code", type(exc).__name__)
        op = getattr(exc, "operation_name", "")
        print(f"Failed: {op} {code}".strip(), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
