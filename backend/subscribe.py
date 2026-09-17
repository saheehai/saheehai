"""Newsletter list: POST /subscribe, GET /subscribe/confirm, GET /subscribe/unsubscribe.

Public routes, no account. The gates are a Turnstile challenge on sign-up
(verified here, the same way the PreSignUp trigger does it) and a
confirmation link sent by email: an address is not on the list until its
owner clicks. Every address can leave with one click, which the Privacy
Policy promises and CAN-SPAM requires.

What is stored: the address, a random token, the page the person signed up
from, and timestamps. No IP address, no name, nothing else. Unsubscribing
sets a 30-day TTL so the row deletes itself.

The response to POST /subscribe is the same whether the address is new,
pending or already confirmed, so the route cannot be used to check whether
someone is subscribed.
"""

import json
import logging
import re
import secrets
import time

import boto3
from botocore.exceptions import ClientError

import auth
import config

logger = logging.getLogger()
logger.setLevel(logging.INFO)

_dynamodb = boto3.resource("dynamodb", region_name=config.AWS_REGION)
_table = _dynamodb.Table(config.SUBSCRIBER_TABLE)
_ses = boto3.client("ses", region_name=config.AWS_REGION)

# Where a sign-up came from; anything else is recorded as "site".
SOURCES = {"home", "support", "news", "resources", "site"}

# Deliberately loose: it only has to keep garbage out of the table. SES
# and the confirmation click decide whether an address is real.
EMAIL_RE = re.compile(r"^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,63}$")

UNSUBSCRIBE_TTL_SECONDS = 30 * 24 * 3600


class SubscribeError(Exception):
    """Client-safe message and status."""

    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


# --- HTTP plumbing ---------------------------------------------------------


def _headers() -> dict:
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": config.ALLOWED_ORIGIN,
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Vary": "Origin",
        "Cache-Control": "no-store",
    }


def _respond(status: int, payload: dict) -> dict:
    return {"statusCode": status, "headers": _headers(), "body": json.dumps(payload)}


def _error(status: int, message: str) -> dict:
    return _respond(status, {"error": message})


def _parse_body(event: dict) -> dict:
    try:
        body = json.loads(event.get("body") or "{}")
    except ValueError:
        return {}
    return body if isinstance(body, dict) else {}


# --- Email -----------------------------------------------------------------


def _confirm_link(token: str) -> str:
    return f"{config.SITE_URL}/subscribe/confirm?token={token}"


def _unsubscribe_link(token: str) -> str:
    return f"{config.SITE_URL}/subscribe/unsubscribe?token={token}"


def _send_confirmation(email: str, token: str) -> None:
    body = (
        "Hello,\n\n"
        "Someone, probably you, asked to hear from Saheeh AI by email. If it was you, "
        "confirm by opening this link:\n\n"
        f"{_confirm_link(token)}\n\n"
        "If it was not you, do nothing. Nothing is sent until the link is opened, "
        "and the address is removed on its own.\n\n"
        "Saheeh AI is a Texas nonprofit. We send our own updates only, rarely, "
        "and we never sell or share your address.\n\n"
        f"To leave at any time: {_unsubscribe_link(token)}\n"
    )
    _ses.send_email(
        Source=config.NEWSLETTER_FROM,
        Destination={"ToAddresses": [email]},
        Message={
            "Subject": {"Data": "Confirm your email for Saheeh AI", "Charset": "UTF-8"},
            "Body": {"Text": {"Data": body, "Charset": "UTF-8"}},
        },
    )


# --- Routes ----------------------------------------------------------------


def _normalize_email(value) -> str:
    if not isinstance(value, str):
        raise SubscribeError(400, "Please enter an email address")
    email = value.strip().lower()
    if len(email) > 254 or not EMAIL_RE.match(email):
        raise SubscribeError(400, "That does not look like an email address")
    return email


def handle_subscribe(event: dict) -> dict:
    if not config.NEWSLETTER_FROM:
        # Fail closed and say so: a sign-up we cannot confirm is a sign-up
        # we cannot honour.
        raise SubscribeError(503, "Email sign-ups are not open yet. Please check back soon.")

    body = _parse_body(event)

    token = body.get("turnstile_token")
    if not isinstance(token, str) or not auth.verify_turnstile(token, auth.source_ip(event)):
        raise SubscribeError(400, "Verification failed. Please try again.")

    email = _normalize_email(body.get("email"))
    source = body.get("source") if body.get("source") in SOURCES else "site"
    now = int(time.time())
    new_token = secrets.token_urlsafe(32)

    try:
        # A confirmed address keeps its row and its token untouched, so a
        # repeat sign-up can neither reset someone's subscription nor be
        # used to tell whether the address is on the list.
        _table.update_item(
            Key={"email": email},
            UpdateExpression=(
                "SET #s = :pending, #t = :token, created_at = :now, #src = :src "
                "REMOVE expires_at, unsubscribed_at"
            ),
            ConditionExpression="attribute_not_exists(#s) OR #s <> :confirmed",
            ExpressionAttributeNames={"#s": "status", "#t": "token", "#src": "source"},
            ExpressionAttributeValues={
                ":pending": "pending",
                ":confirmed": "confirmed",
                ":token": new_token,
                ":now": now,
                ":src": source,
            },
        )
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "ConditionalCheckFailedException":
            raise
        # Already confirmed. Same answer as a fresh sign-up, and no email.
        return _respond(200, {"ok": True})

    _send_confirmation(email, new_token)
    return _respond(200, {"ok": True})


def _row_for_token(event: dict) -> dict:
    params = event.get("queryStringParameters") or {}
    token = params.get("token", "")
    if not isinstance(token, str) or not (20 <= len(token) <= 64):
        raise SubscribeError(400, "That link is not valid")

    response = _table.query(
        IndexName="by_token",
        KeyConditionExpression="#t = :token",
        ExpressionAttributeNames={"#t": "token"},
        ExpressionAttributeValues={":token": token},
        Limit=1,
    )
    items = response.get("Items") or []
    if not items:
        raise SubscribeError(400, "That link is not valid, or it has already been used")
    return items[0]


def handle_confirm(event: dict) -> dict:
    row = _row_for_token(event)
    if row.get("status") != "confirmed":
        _table.update_item(
            Key={"email": row["email"]},
            UpdateExpression="SET #s = :confirmed, confirmed_at = :now REMOVE expires_at",
            ExpressionAttributeNames={"#s": "status"},
            ExpressionAttributeValues={":confirmed": "confirmed", ":now": int(time.time())},
        )
    return _respond(200, {"ok": True})


def handle_unsubscribe(event: dict) -> dict:
    row = _row_for_token(event)
    now = int(time.time())
    _table.update_item(
        Key={"email": row["email"]},
        UpdateExpression="SET #s = :gone, unsubscribed_at = :now, expires_at = :ttl",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={
            ":gone": "unsubscribed",
            ":now": now,
            ":ttl": now + UNSUBSCRIBE_TTL_SECONDS,
        },
    )
    return _respond(200, {"ok": True})


# --- Entry point -----------------------------------------------------------

_ROUTES = {
    ("POST", "/subscribe"): handle_subscribe,
    ("GET", "/subscribe/confirm"): handle_confirm,
    ("GET", "/subscribe/unsubscribe"): handle_unsubscribe,
}


def lambda_handler(event, context):
    request = (event.get("requestContext") or {}).get("http", {})
    method = request.get("method", "")
    path = request.get("path", "") or event.get("rawPath", "")

    for prefix in ("/api", "/prod"):
        if path.startswith(prefix + "/"):
            path = path[len(prefix) :]
    path = path.rstrip("/") or "/"

    if method == "OPTIONS":
        return {"statusCode": 204, "headers": _headers(), "body": ""}

    handler = _ROUTES.get((method, path))
    if handler is None:
        return _error(404, "Not found")

    try:
        return handler(event)
    except SubscribeError as exc:
        return _error(exc.status, str(exc))
    except ClientError:
        logger.exception("AWS call failed for %s %s", method, path)
        return _error(502, "Could not complete that right now. Please try again.")
    except Exception:
        logger.exception("Unhandled error for %s %s", method, path)
        return _error(500, "Internal error")
