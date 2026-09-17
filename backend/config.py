"""Configuration, read from the environment.

Nothing here is hardcoded to a deployed resource on purpose: the baseline
version of this backend hardcoded table names, the region, and the model id,
which is why the live stack and the committed template had silently diverged.
"""

import os

# --- Turnstile -------------------------------------------------------------

# Cloudflare Turnstile secret, validated server-side when minting a token.
TURNSTILE_SECRET = os.environ.get("TURNSTILE_SECRET", "")
TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

# siteverify echoes back the action and hostname the token was issued for.
# Checking `success` alone is not enough: a token minted by some other widget
# surface, or on a host that merely shares the sitekey, would otherwise pass.
TURNSTILE_ACTION = os.environ.get("TURNSTILE_ACTION", "session")
TURNSTILE_ALLOWED_HOSTNAMES = [
    host.strip()
    for host in os.environ.get(
        "TURNSTILE_ALLOWED_HOSTNAMES", "saheeh.ai,www.saheeh.ai,localhost,127.0.0.1"
    ).split(",")
    if host.strip()
]

# --- Edge ------------------------------------------------------------------

# Shared secret CloudFront attaches to every request it forwards to the API
# (an origin custom header). When set, requests without it are refused, which
# is what makes the CloudFront geo headers trustworthy: nobody can reach the
# function except through the distribution. Empty until the /api/* behavior
# is wired up.
ORIGIN_VERIFY_SECRET = os.environ.get("ORIGIN_VERIFY_SECRET", "")

# Where the Experiments are refused. See blocked_regions.json.
BLOCKED_REGIONS_FILE = os.environ.get("BLOCKED_REGIONS_FILE", "")

# What to do when the viewer's country or state cannot be determined. Off
# while the edge is being wired up (every request would be unknown);
# consider turning it on once CloudFront is in front of the API.
GEO_BLOCK_UNKNOWN = os.environ.get("GEO_BLOCK_UNKNOWN", "false").lower() in ("1", "true", "yes")

# --- CORS ------------------------------------------------------------------

# Exact origin, never "*". A wildcard here is what let any page on the
# internet drive this API from a browser.
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "https://saheeh.ai")

# --- Storage ---------------------------------------------------------------

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
# Only the data-request tool reads this; the functions never talk to Cognito.
COGNITO_USER_POOL_ID = os.environ.get("COGNITO_USER_POOL_ID", "")
CHAT_TABLE = os.environ.get("CHAT_TABLE", "saheeh_chat_history")
JOURNAL_TABLE = os.environ.get("JOURNAL_TABLE", "saheeh_journal")
QUOTA_TABLE = os.environ.get("QUOTA_TABLE", "saheeh_quota")
# One item per account: nickname and a small picture, shown only to its owner.
PROFILE_TABLE = os.environ.get("PROFILE_TABLE", "saheeh_profiles")
# Keys-only index on the chat table (hash user_id, range timestamp) so one
# person's conversations can be found without scanning everyone's. The chat
# table is not managed by the stack, so the index is created by hand
# (DEPLOYMENT.md, "Account routes"). Empty means scan, which only the
# operator tool has permission to do.
CHAT_USER_INDEX = os.environ.get("CHAT_USER_INDEX", "")

# --- Newsletter ------------------------------------------------------------

SUBSCRIBER_TABLE = os.environ.get("SUBSCRIBER_TABLE", "saheeh_subscribers")

# Verified SES identity the confirmation email is sent from, e.g.
# "Saheeh AI <news@saheeh.ai>". Empty means sign-ups are refused with a
# clear message rather than accepted and never confirmed.
NEWSLETTER_FROM = os.environ.get("NEWSLETTER_FROM", "")

# Where the links in those emails point.
SITE_URL = os.environ.get("SITE_URL", "https://saheeh.ai").rstrip("/")

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

# --- Account ---------------------------------------------------------------

# The nickname is the one piece of user text that reaches the system prompt,
# so it is short and drawn from a small alphabet (profile_rules.py).
MAX_NICKNAME_CHARS = int(os.environ.get("MAX_NICKNAME_CHARS", 30))
# The browser resizes a picture to 128px before sending; a JPEG that size is
# well under 20 KB. The cap is generous for PNG and still far below DynamoDB's
# 400 KB item limit.
MAX_AVATAR_BYTES = int(os.environ.get("MAX_AVATAR_BYTES", 96 * 1024))
# Export and delete read a person's whole history. A handful a day is plenty
# for anyone doing it by hand, and stops a script turning them into a cost.
ACCOUNT_ACTION_QUOTA = int(os.environ.get("ACCOUNT_ACTION_QUOTA", 5))
# Lambda cannot return more than 6 MB. Above this the export is handed off to
# the operator workflow instead of failing opaquely.
MAX_EXPORT_BYTES = int(os.environ.get("MAX_EXPORT_BYTES", 5 * 1024 * 1024))
