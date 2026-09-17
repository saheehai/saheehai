"""Cognito PreSignUp trigger: require a Turnstile challenge to create an account.

Sign-up runs from the browser directly against Cognito, never through our API,
so this trigger is the only point where a server-side check can stand between
a script and an unlimited supply of accounts. Without it the per-account quota
is decorative: mint more accounts, get more quota.

The Turnstile token arrives in `clientMetadata`, which the frontend passes to
`signUp()`. So do the two consent statements from the sign-up form: that the
person is 18 or older, and that they have read the Privacy Policy and agree
to the Terms. The boxes on the form are the only place a person can tick
them, but a script can call Cognito directly, so this is where they count.
Raising any exception here rejects the sign-up.
"""

import logging

import auth
import config

logger = logging.getLogger()
logger.setLevel(logging.INFO)


# Exact value the form sends when the 18+ box is ticked.
AGE_ATTESTATION = "18+"


class SignUpRejected(Exception):
    """Message surfaces to the caller, so it must not leak internals."""


def lambda_handler(event, context):
    if not config.TURNSTILE_SECRET:
        # Fail closed. A misconfigured trigger must not become an open door.
        logger.error("TURNSTILE_SECRET is not set; rejecting sign-up")
        raise SignUpRejected("Sign-up is temporarily unavailable")

    metadata = event.get("request", {}).get("clientMetadata") or {}
    token = metadata.get("turnstile_token", "")

    if not token:
        raise SignUpRejected("Verification required")

    if not auth.verify_turnstile(token):
        # No user identifier in the log line: this fires before an account
        # exists, and the email is the thing being protected.
        logger.warning("Rejected sign-up: Turnstile verification failed")
        raise SignUpRejected("Verification failed")

    # Consent, checked after Turnstile so a script without a token learns
    # nothing about the other rules.
    if metadata.get("age_attested") != AGE_ATTESTATION:
        raise SignUpRejected("You must be 18 or older to create an account")
    if not (metadata.get("policies_accepted") or "").strip():
        raise SignUpRejected("Please accept the Terms and Privacy Policy")

    # Leave confirmation to Cognito's own email flow rather than
    # auto-confirming, so an address is proven before it can be used for
    # account recovery.
    event["response"]["autoConfirmUser"] = False
    event["response"]["autoVerifyEmail"] = False
    return event
