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
    key = f"{identity}#{window}"
    expires_at = (window + 2) * config.QUOTA_WINDOW_SECONDS  # TTL reaps old rows

    try:
        response = _quota_table.update_item(
            Key={"quota_key": key},
            UpdateExpression="SET expires_at = :exp ADD request_count :one",
            ConditionExpression=(
                "attribute_not_exists(request_count) OR request_count < :limit"
            ),
            ExpressionAttributeValues={
                ":one": 1,
                ":exp": expires_at,
                ":limit": config.DAILY_MESSAGE_QUOTA,
            },
            ReturnValues="UPDATED_NEW",
        )
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            raise QuotaExceeded(
                f"Daily limit of {config.DAILY_MESSAGE_QUOTA} messages reached"
            ) from exc
        raise

    used = int(response["Attributes"]["request_count"])
    return {
        "used": used,
        "limit": config.DAILY_MESSAGE_QUOTA,
        "remaining": max(0, config.DAILY_MESSAGE_QUOTA - used),
    }


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


def save_chat_message(conversation_id: str, user_id: str, role: str, content: str) -> int:
    timestamp = _now_ms()
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
