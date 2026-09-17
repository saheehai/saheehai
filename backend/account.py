"""The Account page's routes: profile, export, delete data, delete account.

These are the self-service side of the Privacy Policy's "see, correct,
delete". The identity is the caller's own Cognito subject, and only ever
that: nothing here accepts an email or a user id from the request. The
collection and delete helpers are shared with the operator tool in
data_request.py so a person gets the same export either way.

Two rules from the rest of the backend hold here too. Nothing a person
wrote is logged: counts and subjects only. And the function holds no Cognito
permission: after "delete account" removes the rows, the browser deletes
the Cognito user itself with the person's own session, so the account goes
last, the same order the operator tool keeps.
"""

import json
import logging

import auth
import config
import data_request
import profile_rules
import storage
from responses import error, headers, parse_body, respond

logger = logging.getLogger()

# What "delete my data" asks the person to type. Fixed and unmistakable.
DELETE_DATA_CONFIRMATION = "DELETE"


def _clients() -> data_request.Clients:
    tables = storage.tables()
    return data_request.Clients(
        cognito=None,
        chat=tables["chat"],
        journal=tables["journal"],
        quota=tables["quota"],
        subscribers=None,
        user_pool_id="",
        profiles=tables["profiles"],
        chat_index=config.CHAT_USER_INDEX,
    )


def _limited(user_id: str) -> dict | None:
    """A 429 response when the person has used today's account actions, else None."""
    try:
        storage.consume_account_quota(user_id)
    except storage.QuotaExceeded as exc:
        return error(429, str(exc))
    return None


# --- Profile ---------------------------------------------------------------


def handle_profile_get(event: dict, user_id: str) -> dict:
    profile = storage.get_profile(user_id)
    # Someone who has never opened the page still needs to see which way the
    # switches are set, so the defaults answer rather than an empty object.
    return respond(200, {"profile": profile or dict(storage.SHARE_DEFAULTS)})


def handle_profile_save(event: dict, user_id: str) -> dict:
    """Replace the profile with what was sent. Empty fields clear."""
    body = parse_body(event)
    try:
        nickname = profile_rules.clean_nickname(body.get("nickname"))
        avatar = profile_rules.validate_avatar(body.get("avatar"))
        shares = profile_rules.clean_shares(body)
    except profile_rules.ProfileError as exc:
        return error(400, str(exc))
    return respond(
        200, {"profile": storage.save_profile(user_id, nickname, avatar, **shares)}
    )


# --- Export ----------------------------------------------------------------


def handle_export(event: dict, user_id: str) -> dict:
    limited = _limited(user_id)
    if limited:
        return limited

    claims = auth.claims_from_event(event)
    email = str(claims.get("email") or "")
    account = {
        "sub": user_id,
        "email": email,
        "email_verified": claims.get("email_verified"),
        "age_attested": claims.get("custom:age_attested"),
        "policies_accepted": claims.get("custom:policies_accepted"),
    }
    if not account["age_attested"]:
        account["consent_note"] = data_request.CONSENT_NOTE

    clients = _clients()
    doc = data_request.compose_export(
        email=email,
        reference="self-service",
        account=account,
        chat_rows=data_request.collect_chat(clients, user_id),
        journal_rows=data_request.collect_journal(clients, user_id),
        quota_rows=data_request.collect_quota(clients, user_id),
        newsletter_row=None,
        profile_row=data_request.collect_profile(clients, user_id),
    )
    # The newsletter list is a separate store keyed by address, outside what
    # this function can read. Say so rather than implying there is nothing.
    doc["newsletter"] = {
        "note": "Newsletter sign-ups are kept separately by email address. Every "
        "email we send has an unsubscribe link, and the address is deleted "
        "within 30 days of unsubscribing."
    }

    body = json.dumps(doc, default=str, ensure_ascii=False)
    if len(body.encode("utf-8")) > config.MAX_EXPORT_BYTES:
        return error(
            413,
            "Your export is too large to download here. Contact us and we will send it to you.",
        )
    return {"statusCode": 200, "headers": headers(), "body": body}


# --- Delete ----------------------------------------------------------------


def _deleted_counts(result: data_request.DeleteResult) -> dict:
    return {
        "journal": result.journal,
        "chat": result.chat,
        "quota": result.quota,
        "profile": result.profile,
    }


def handle_delete_data(event: dict, user_id: str) -> dict:
    """Chats, journal and profile gone; the account stays."""
    body = parse_body(event)
    if body.get("confirm") != DELETE_DATA_CONFIRMATION:
        return error(400, f"Type {DELETE_DATA_CONFIRMATION} to confirm")

    limited = _limited(user_id)
    if limited:
        return limited

    result = data_request.delete_rows(_clients(), user_id, keep_account_counters=True)
    counts = _deleted_counts(result)
    logger.info("Deleted data for %s: %s", user_id, counts)
    return respond(200, {"deleted": counts})


def handle_delete_account(event: dict, user_id: str) -> dict:
    """Everything in the tables, then tell the browser to remove the account.

    Confirmation is the address on the token, typed by the person, the same
    check the operator tool makes. What remains is counted and returned so the
    browser refuses to delete the Cognito user while rows are still there.
    """
    claims = auth.claims_from_event(event)
    email = str(claims.get("email") or "").strip().lower()
    body = parse_body(event)
    confirm = body.get("confirm")
    if not email or not isinstance(confirm, str) or confirm.strip().lower() != email:
        return error(400, "Type your email address to confirm")

    limited = _limited(user_id)
    if limited:
        return limited

    clients = _clients()
    result = data_request.delete_rows(clients, user_id, keep_account_counters=True)
    remaining = data_request.count_rows(clients, user_id)
    counts = _deleted_counts(result)
    logger.info("Deleted account data for %s: %s, remaining %s", user_id, counts, remaining)
    return respond(
        200,
        {
            "deleted": counts,
            "remaining": {k: v for k, v in remaining.items()},
            "next": "delete_cognito_user",
        },
    )
