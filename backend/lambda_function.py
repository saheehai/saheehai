"""Saheeh AI backend: /chat and /journal.

Request handling rules, all of which the baseline version broke:

  * Identity is the Cognito `sub` claim, validated by API Gateway's JWT
    authorizer before the request reaches this function. It is never read
    from the request body.
  * Conversation history is read from storage, never accepted from the caller.
  * Quota is enforced atomically in DynamoDB, not in per-container memory.
  * Message content is never written to logs.
  * Internal error text is never returned to the caller.
"""

import json
import logging
import os
import uuid

import boto3
from botocore.exceptions import ClientError

import auth
import config
import storage

logger = logging.getLogger()
logger.setLevel(logging.INFO)

_bedrock = boto3.client("bedrock-runtime", region_name=config.AWS_REGION)

with open(os.path.join(os.path.dirname(__file__), "system_prompt.txt"), encoding="utf-8") as fh:
    SYSTEM_PROMPT = fh.read()


# --- HTTP plumbing ---------------------------------------------------------


def _headers() -> dict:
    return {
        "Content-Type": "application/json",
        # A single exact origin. The baseline sent "*", which let any page on
        # the internet drive this API from a visitor's browser.
        "Access-Control-Allow-Origin": config.ALLOWED_ORIGIN,
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Vary": "Origin",
        "Cache-Control": "no-store",
    }


def _respond(status: int, payload: dict) -> dict:
    return {"statusCode": status, "headers": _headers(), "body": json.dumps(payload, default=str)}


def _error(status: int, message: str) -> dict:
    """Client-safe errors only.

    Every string reaching this function is one we wrote. Exception text is
    logged, never returned: the baseline put str(e) in the response body,
    which leaks table names and stack internals to anyone probing the API.
    """
    return _respond(status, {"error": message})


def _parse_body(event: dict) -> dict:
    try:
        body = json.loads(event.get("body") or "{}")
    except ValueError:
        return {}
    return body if isinstance(body, dict) else {}


def _clean_text(value, limit: int) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip()[:limit]


# --- Routes ----------------------------------------------------------------


def handle_chat(event: dict, user_id: str) -> dict:
    body = _parse_body(event)

    message = _clean_text(body.get("message"), config.MAX_MESSAGE_CHARS)
    if not message:
        return _error(400, "Message required")

    conversation_id = body.get("conversation_id")
    if not isinstance(conversation_id, str) or not conversation_id:
        conversation_id = str(uuid.uuid4())

    try:
        history = storage.get_conversation_history(conversation_id, user_id)
    except storage.ConversationForbidden:
        # Deliberately 404, not 403: confirming that a conversation exists
        # would let a caller enumerate valid conversation ids. Logged (ids
        # only) because the common cause is a browser holding on to a
        # conversation from a previous identity, which is worth seeing.
        logger.warning(
            "Conversation %s is not owned by the caller; refusing", conversation_id
        )
        return _error(404, "Conversation not found")

    try:
        usage = storage.consume_quota(user_id)
    except storage.QuotaExceeded as exc:
        return _error(429, str(exc))

    messages = [
        {"role": item["role"], "content": [{"text": item["content"]}]} for item in history
    ]
    messages.append({"role": "user", "content": [{"text": message}]})

    try:
        response = _bedrock.converse(
            modelId=config.MODEL_ID,
            messages=messages,
            system=[{"text": SYSTEM_PROMPT}],
            inferenceConfig={
                "maxTokens": config.MAX_OUTPUT_TOKENS,
                "temperature": config.TEMPERATURE,
            },
        )
    except ClientError:
        # Do not bill the caller for our failure.
        storage.release_quota(user_id)
        logger.exception("Bedrock converse failed")
        return _error(502, "The assistant is unavailable right now")

    reply = next(
        (
            block["text"]
            for block in response["output"]["message"]["content"]
            if "text" in block
        ),
        "",
    )
    if not reply:
        storage.release_quota(user_id)
        logger.error("Bedrock returned no text content")
        return _error(502, "The assistant is unavailable right now")

    asked_at = storage.save_chat_message(conversation_id, user_id, "user", message)
    timestamp = storage.save_chat_message(
        conversation_id, user_id, "assistant", reply, after=asked_at
    )

    return _respond(
        200,
        {
            "response": reply,
            "conversation_id": conversation_id,
            "timestamp": timestamp,
            "quota": usage,
        },
    )


def handle_journal_save(event: dict, user_id: str) -> dict:
    body = _parse_body(event)

    content = _clean_text(body.get("content"), config.MAX_JOURNAL_CHARS)
    if not content:
        return _error(400, "Content required")

    tags = body.get("tags")
    if isinstance(tags, list):
        tags = [_clean_text(tag, 50) for tag in tags[: config.MAX_JOURNAL_TAGS]]
        tags = [tag for tag in tags if tag]
    else:
        tags = []

    result = storage.save_journal_entry(
        user_id,
        content,
        title=_clean_text(body.get("title"), config.MAX_JOURNAL_TITLE_CHARS) or None,
        mood=_clean_text(body.get("mood"), 50) or None,
        tags=tags,
    )
    return _respond(200, result)


def handle_journal_list(event: dict, user_id: str) -> dict:
    params = event.get("queryStringParameters") or {}
    try:
        limit = max(1, min(int(params.get("limit", 20)), 100))
    except (TypeError, ValueError):
        limit = 20

    # Note there is no user_id parameter. The baseline read one from the query
    # string, so GET /journal?user_id=X returned anyone's entries.
    return _respond(200, {"entries": storage.get_journal_entries(user_id, limit)})


# --- Entry point -----------------------------------------------------------

_AUTHENTICATED_ROUTES = {
    ("POST", "/chat"): handle_chat,
    ("POST", "/journal"): handle_journal_save,
    ("GET", "/journal"): handle_journal_list,
}


def lambda_handler(event, context):
    request = (event.get("requestContext") or {}).get("http", {})
    method = request.get("method", "")
    path = request.get("path", "") or event.get("rawPath", "")

    # Stage prefixes should not reach here (the API is deployed on $default),
    # but strip a known one rather than 404 if that changes.
    for prefix in ("/prod",):
        if path.startswith(prefix + "/"):
            path = path[len(prefix) :]
    path = path.rstrip("/") or "/"

    if method == "OPTIONS":
        return {"statusCode": 204, "headers": _headers(), "body": ""}

    handler = _AUTHENTICATED_ROUTES.get((method, path))
    if handler is None:
        return _error(404, "Not found")

    try:
        user_id = auth.user_id_from_event(event)
    except auth.AuthError:
        # Reached only if the authorizer is misconfigured: API Gateway
        # rejects an invalid or absent token before we are invoked.
        logger.error("Request passed the authorizer with no usable subject claim")
        return _error(401, "Authentication required")

    try:
        return handler(event, user_id)
    except ClientError:
        logger.exception("AWS call failed for %s %s", method, path)
        return _error(502, "Upstream service error")
    except Exception:
        # Log the detail, return none of it.
        logger.exception("Unhandled error for %s %s", method, path)
        return _error(500, "Internal error")
