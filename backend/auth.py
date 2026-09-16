"""Device identity.

The baseline backend took `user_id` straight from the request body, so any
caller could claim any identity and read any journal. Identity here is
server-issued instead: a visitor proves it is a real browser via Cloudflare
Turnstile, and receives an HMAC-signed token carrying an opaque user id. The
token is unforgeable without the signing key, so `user_id` can be trusted.

Tokens are deliberately minimal — stdlib only, no PyJWT — so the Lambda
package stays dependency-free beyond boto3.
"""

import base64
import hashlib
import hmac
import json
import time
import urllib.parse
import urllib.request
import uuid

import config


class AuthError(Exception):
    """Caller could not be authenticated. Always surfaces as 401."""


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _sign(payload_b64: str) -> str:
    digest = hmac.new(
        config.DEVICE_TOKEN_SECRET.encode("utf-8"),
        payload_b64.encode("ascii"),
        hashlib.sha256,
    ).digest()
    return _b64url_encode(digest)


def issue_token(user_id: str | None = None) -> tuple[str, str, int]:
    """Mint a signed device token. Returns (token, user_id, expires_at)."""
    now = int(time.time())
    expires_at = now + config.DEVICE_TOKEN_TTL_SECONDS
    user_id = user_id or f"u_{uuid.uuid4().hex}"

    payload = {"sub": user_id, "iat": now, "exp": expires_at}
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    return f"{payload_b64}.{_sign(payload_b64)}", user_id, expires_at


def verify_token(token: str) -> str:
    """Validate a device token and return its user id.

    Raises AuthError on anything suspect. Never trust the payload before the
    signature has been checked.
    """
    if not token:
        raise AuthError("Missing token")

    parts = token.split(".")
    if len(parts) != 2:
        raise AuthError("Malformed token")

    payload_b64, provided_sig = parts

    # compare_digest, not ==, so the comparison does not leak the signature
    # one byte at a time through timing.
    if not hmac.compare_digest(_sign(payload_b64), provided_sig):
        raise AuthError("Bad signature")

    try:
        payload = json.loads(_b64url_decode(payload_b64))
    except (ValueError, TypeError) as exc:
        raise AuthError("Unreadable payload") from exc

    if not isinstance(payload, dict):
        raise AuthError("Unreadable payload")

    if int(payload.get("exp", 0)) < int(time.time()):
        raise AuthError("Token expired")

    user_id = payload.get("sub")
    if not isinstance(user_id, str) or not user_id:
        raise AuthError("Token has no subject")

    return user_id


def bearer_token_from_event(event: dict) -> str:
    """Pull the bearer token out of an API Gateway v2 event.

    Header names arrive lowercased on HTTP APIs, but normalise anyway rather
    than depending on that.
    """
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    authorization = headers.get("authorization", "")
    if not authorization.lower().startswith("bearer "):
        return ""
    return authorization[7:].strip()


def verify_turnstile(turnstile_token: str, remote_ip: str | None = None) -> bool:
    """Check a Turnstile token with Cloudflare.

    This is the step that makes scripted access expensive: a token can only
    be obtained by solving the challenge in a real browser, and each one is
    single-use.
    """
    if not turnstile_token:
        return False

    fields = {"secret": config.TURNSTILE_SECRET, "response": turnstile_token}
    if remote_ip and remote_ip != "unknown":
        fields["remoteip"] = remote_ip

    request = urllib.request.Request(
        config.TURNSTILE_VERIFY_URL,
        data=urllib.parse.urlencode(fields).encode("utf-8"),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            result = json.loads(response.read())
    except Exception:
        # Fail closed. A Cloudflare outage must not become an open API.
        return False

    if not result.get("success"):
        return False

    # siteverify echoes the action and hostname the token was issued under.
    # Without these checks a token minted against a different surface, or on
    # another host sharing the sitekey, would be accepted here.
    if config.TURNSTILE_ACTION and result.get("action") != config.TURNSTILE_ACTION:
        return False

    hostname = result.get("hostname")
    if config.TURNSTILE_ALLOWED_HOSTNAMES and hostname not in config.TURNSTILE_ALLOWED_HOSTNAMES:
        return False

    return True


def source_ip(event: dict) -> str:
    """Source IP from an API Gateway v2 event.

    The baseline read requestContext.identity.sourceIp, which is the REST/v1
    shape. On an HTTP API that key does not exist, so it silently resolved to
    'unknown' for every caller and the rate limiter keyed every visitor into a
    single shared bucket.
    """
    return (
        (event.get("requestContext") or {}).get("http", {}).get("sourceIp")
        or "unknown"
    )
