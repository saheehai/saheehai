"""Configuration, read from the environment.

Nothing here is hardcoded to a deployed resource on purpose: the baseline
version of this backend hardcoded table names, the region, and the model id,
which is why the live stack and the committed template had silently diverged.
"""

import os

# --- Identity / auth -------------------------------------------------------

# HMAC key used to sign device tokens. Supplied by the SAM template as a
# NoEcho parameter. Absence is fatal: an unsigned token is a forgeable token.
DEVICE_TOKEN_SECRET = os.environ.get("DEVICE_TOKEN_SECRET", "")

# Cloudflare Turnstile secret, validated server-side when minting a token.
TURNSTILE_SECRET = os.environ.get("TURNSTILE_SECRET", "")
TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

# How long a device token stays valid. Short enough that a leaked token
# expires on its own, long enough that a visitor is not re-challenged
# constantly mid-conversation.
DEVICE_TOKEN_TTL_SECONDS = int(os.environ.get("DEVICE_TOKEN_TTL_SECONDS", 7 * 24 * 3600))

# --- CORS ------------------------------------------------------------------

# Exact origin, never "*". A wildcard here is what let any page on the
# internet drive this API from a browser.
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "https://saheeh.ai")

# --- Storage ---------------------------------------------------------------

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
CHAT_TABLE = os.environ.get("CHAT_TABLE", "saheeh_chat_history")
JOURNAL_TABLE = os.environ.get("JOURNAL_TABLE", "saheeh_journal")
QUOTA_TABLE = os.environ.get("QUOTA_TABLE", "saheeh_quota")

# --- Model -----------------------------------------------------------------

MODEL_ID = os.environ.get("MODEL_ID", "openai.gpt-oss-120b-1:0")
MAX_OUTPUT_TOKENS = int(os.environ.get("MAX_OUTPUT_TOKENS", 1000))
TEMPERATURE = float(os.environ.get("TEMPERATURE", 0.7))

# --- Abuse limits ----------------------------------------------------------

# Per-identity daily message allowance, enforced in DynamoDB.
DAILY_MESSAGE_QUOTA = int(os.environ.get("DAILY_MESSAGE_QUOTA", 50))
QUOTA_WINDOW_SECONDS = int(os.environ.get("QUOTA_WINDOW_SECONDS", 86400))

# Input caps. Without these a single request can be made arbitrarily
# expensive regardless of how many requests the quota allows.
MAX_MESSAGE_CHARS = int(os.environ.get("MAX_MESSAGE_CHARS", 4000))
MAX_HISTORY_MESSAGES = int(os.environ.get("MAX_HISTORY_MESSAGES", 40))
MAX_JOURNAL_CHARS = int(os.environ.get("MAX_JOURNAL_CHARS", 20000))
MAX_JOURNAL_TITLE_CHARS = int(os.environ.get("MAX_JOURNAL_TITLE_CHARS", 200))
MAX_JOURNAL_TAGS = int(os.environ.get("MAX_JOURNAL_TAGS", 20))


class ConfigError(RuntimeError):
    """Raised at startup when a required secret is missing."""


def validate() -> None:
    """Fail fast on missing secrets rather than degrading into an open API."""
    missing = [
        name
        for name, value in (
            ("DEVICE_TOKEN_SECRET", DEVICE_TOKEN_SECRET),
            ("TURNSTILE_SECRET", TURNSTILE_SECRET),
        )
        if not value
    ]
    if missing:
        raise ConfigError(f"Missing required environment variables: {', '.join(missing)}")
