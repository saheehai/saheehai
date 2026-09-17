"""HTTP plumbing shared by the route modules.

Every string in an error response is one we wrote. Exception text is logged
by the caller and never returned: the baseline put str(e) in the body, which
leaked table names and stack internals to anyone probing the API.
"""

import json

import config


def headers() -> dict:
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


def respond(status: int, payload: dict) -> dict:
    return {"statusCode": status, "headers": headers(), "body": json.dumps(payload, default=str)}


def error(status: int, message: str) -> dict:
    """Client-safe errors only."""
    return respond(status, {"error": message})


def parse_body(event: dict) -> dict:
    try:
        body = json.loads(event.get("body") or "{}")
    except ValueError:
        return {}
    return body if isinstance(body, dict) else {}


def clean_text(value, limit: int) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip()[:limit]
