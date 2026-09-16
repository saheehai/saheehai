"""Caller identity and Turnstile verification.

Identity comes from Cognito. API Gateway validates the JWT against the user
pool before the request reaches this function, so by the time a handler runs
the claims can be trusted; `user_id_from_event` just reads them.

This module previously minted its own HMAC-signed device tokens, which was
the anonymous-identity scheme that Cognito accounts replace.
"""

import json
import urllib.parse
import urllib.request

import config


class AuthError(Exception):
    """Caller could not be identified. Always surfaces as 401."""


def user_id_from_event(event: dict) -> str:
    """Cognito subject for the caller.

    API Gateway's JWT authorizer has already checked the signature, issuer,
    audience and expiry, so an untrusted token cannot reach this point. A
    missing claim therefore means a misconfigured authorizer, not a forged
    request - either way there is no identity, so refuse.
    """
    claims = (
        (event.get("requestContext") or {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims", {})
    )

    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject:
        raise AuthError("No subject claim on the request")

    return subject


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
