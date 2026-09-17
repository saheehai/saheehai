"""DynamoDB access: conversations, journal entries, and the request quota."""

import time
import uuid
from datetime import UTC, datetime

import boto3
from botocore.exceptions import ClientError

import config

_dynamodb = boto3.resource("dynamodb", region_name=config.AWS_REGION)
_chat_table = _dynamodb.Table(config.CHAT_TABLE)
_journal_table = _dynamodb.Table(config.JOURNAL_TABLE)
_quota_table = _dynamodb.Table(config.QUOTA_TABLE)
_profile_table = _dynamodb.Table(config.PROFILE_TABLE)

# Second quota key family, for export and delete (see consume_account_quota).
ACCOUNT_QUOTA_SUFFIX = "account"


class QuotaExceeded(Exception):
    """Identity has used its allowance for the current window."""


class ConversationForbidden(Exception):
    """Conversation exists but belongs to a different identity."""


def _now_ms() -> int:
    return int(time.time() * 1000)


# --- Quota -----------------------------------------------------------------


def consume_quota(identity: str) -> dict:
    """Atomically claim one unit of quota for this window.

    The baseline kept counts in a module-level dict, which meant per-container
    state: it reset on cold start and every concurrent container had its own
    counter, so the limit was unenforceable. A conditional UpdateItem is
    atomic across every container at once.

    Returns usage info, or raises QuotaExceeded.
    """
    window = int(time.time()) // config.QUOTA_WINDOW_SECONDS
    return _claim(
        f"{identity}#{window}",
        window,
        config.DAILY_MESSAGE_QUOTA,
        f"Daily limit of {config.DAILY_MESSAGE_QUOTA} messages reached",
    )


def consume_account_quota(identity: str) -> dict:
    """One unit of the much smaller allowance for export and delete.

    Those read a person's entire history, so they are capped separately from
    chat: a script cannot spend the chat allowance on them, and a person who
    has used up their chat messages can still get their data out.
    """
    window = int(time.time()) // config.QUOTA_WINDOW_SECONDS
    return _claim(
        f"{identity}#{ACCOUNT_QUOTA_SUFFIX}#{window}",
        window,
        config.ACCOUNT_ACTION_QUOTA,
        "You have reached today's limit for this. Please try again tomorrow.",
    )


def _claim(key: str, window: int, limit: int, exceeded: str) -> dict:
    expires_at = (window + 2) * config.QUOTA_WINDOW_SECONDS  # TTL reaps old rows

    try:
        response = _quota_table.update_item(
            Key={"quota_key": key},
            UpdateExpression="SET expires_at = :exp ADD request_count :one",
            ConditionExpression=(
                "attribute_not_exists(request_count) OR request_count < :limit"
            ),
            ExpressionAttributeValues={":one": 1, ":exp": expires_at, ":limit": limit},
            ReturnValues="UPDATED_NEW",
        )
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise QuotaExceeded(exceeded) from exc
        raise

    used = int(response["Attributes"]["request_count"])
    return {"used": used, "limit": limit, "remaining": max(0, limit - used)}


def release_quota(identity: str) -> None:
    """Give back a unit when the downstream call failed.

    Best effort: a caller should not be charged for our own 500.
    """
    window = int(time.time()) // config.QUOTA_WINDOW_SECONDS
    try:
        _quota_table.update_item(
            Key={"quota_key": f"{identity}#{window}"},
            UpdateExpression="ADD request_count :minus_one",
            ConditionExpression="request_count > :zero",
            ExpressionAttributeValues={":minus_one": -1, ":zero": 0},
        )
    except ClientError:
        pass


# --- Conversations ---------------------------------------------------------


def save_chat_message(
    conversation_id: str, user_id: str, role: str, content: str, after: int | None = None
) -> int:
    """Store one turn and return its timestamp (the sort key).

    `after` keeps a reply strictly later than the message it answers. The two
    are written back to back, and a shared millisecond would make the second
    put overwrite the first, leaving a history that starts with the
    assistant's turn.
    """
    timestamp = _now_ms()
    if after is not None and timestamp <= after:
        timestamp = after + 1
    _chat_table.put_item(
        Item={
            "conversation_id": conversation_id,
            "timestamp": timestamp,
            "user_id": user_id,
            "role": role,
            "content": content,
            "model": config.MODEL_ID,
        }
    )
    return timestamp


def get_conversation_history(conversation_id: str, user_id: str) -> list[dict]:
    """Load history for a conversation, scoped to its owner.

    Two things changed from the baseline. History is read from storage rather
    than accepted from the request body, so a caller can no longer forge the
    model's side of the conversation. And ownership is checked, so a guessed
    or leaked conversation_id does not expose someone else's messages.
    """
    response = _chat_table.query(
        KeyConditionExpression="conversation_id = :cid",
        ExpressionAttributeValues={":cid": conversation_id},
        ScanIndexForward=True,
        Limit=config.MAX_HISTORY_MESSAGES,
    )
    items = response.get("Items", [])

    if any(item.get("user_id") != user_id for item in items):
        raise ConversationForbidden(conversation_id)

    return [
        {"role": item["role"], "content": item["content"]}
        for item in items
        if item.get("role") in ("user", "assistant")
    ]


# --- Journal ---------------------------------------------------------------


def save_journal_entry(
    user_id: str,
    content: str,
    title: str | None = None,
    mood: str | None = None,
    tags: list | None = None,
) -> dict:
    timestamp = _now_ms()
    entry_id = str(uuid.uuid4())

    item = {
        "user_id": user_id,
        "timestamp": timestamp,
        "entry_id": entry_id,
        "content": content,
        "created_at": datetime.now(UTC).isoformat(),
    }
    if title:
        item["title"] = title
    if mood:
        item["mood"] = mood
    if tags:
        item["tags"] = tags

    _journal_table.put_item(Item=item)
    return {"entry_id": entry_id, "timestamp": timestamp}


def get_journal_entries(user_id: str, limit: int = 20) -> list[dict]:
    """Entries for one identity.

    user_id comes from the verified device token, never from the request, so
    this can no longer be pointed at another user's entries.
    """
    response = _journal_table.query(
        KeyConditionExpression="user_id = :uid",
        ExpressionAttributeValues={":uid": user_id},
        ScanIndexForward=False,
        Limit=limit,
    )
    return response.get("Items", [])


# --- Profile ---------------------------------------------------------------


# What the companion may see, when the person has said nothing either way.
# Sharing the nickname is the whole reason most people set one, so it starts
# on. The journal starts off and only ever moves on a deliberate choice.
SHARE_DEFAULTS = {"share_nickname": True, "share_journal": False}


def get_profile(user_id: str) -> dict | None:
    """Nickname, picture and sharing choices, or None when nothing is set."""
    item = _profile_table.get_item(Key={"user_id": user_id}).get("Item")
    if not item:
        return None
    profile = {
        "nickname": item.get("nickname"),
        "avatar": item.get("avatar"),
        "updated_at": item.get("updated_at"),
    }
    # A row written before these existed has neither attribute, so an old
    # profile keeps the behaviour it had: nickname shared, journal not.
    for key, default in SHARE_DEFAULTS.items():
        value = item.get(key)
        profile[key] = default if value is None else bool(value)
    return profile


def save_profile(
    user_id: str,
    nickname: str | None,
    avatar: str | None,
    *,
    share_nickname: bool = True,
    share_journal: bool = False,
) -> dict:
    """Store what is set; an empty profile is removed rather than kept as a blank row.

    "Empty" means no nickname and no picture *and* nothing shared with the
    companion. Someone who clears their name but leaves the journal switched
    on still has a choice worth keeping, so that row stays.
    """
    shares = {"share_nickname": bool(share_nickname), "share_journal": bool(share_journal)}
    if not nickname and not avatar and shares == SHARE_DEFAULTS:
        delete_profile(user_id)
        return {"nickname": None, "avatar": None, "updated_at": None, **SHARE_DEFAULTS}

    item = {"user_id": user_id, "updated_at": datetime.now(UTC).isoformat(), **shares}
    if nickname:
        item["nickname"] = nickname
    if avatar:
        item["avatar"] = avatar
    _profile_table.put_item(Item=item)
    return {
        "nickname": nickname,
        "avatar": avatar,
        "updated_at": item["updated_at"],
        **shares,
    }


def delete_profile(user_id: str) -> int:
    response = _profile_table.delete_item(Key={"user_id": user_id}, ReturnValues="ALL_OLD")
    return 1 if response.get("Attributes") else 0


def tables() -> dict:
    """The function's own table objects, for code that takes them as arguments."""
    return {
        "chat": _chat_table,
        "journal": _journal_table,
        "quota": _quota_table,
        "profiles": _profile_table,
    }
