"""What a person may put on their profile: a nickname and a small picture.

Both are validated here, before storage. The nickname matters most: it is
the only user-written text that reaches the companion's system prompt, so it
is short and limited to letters, digits, spaces and a little punctuation: no
line breaks, quotes, brackets or markup, so it always reads as a quoted name
inside the one sentence that mentions it. Thirty letters can still spell a
short phrase; the framing and the daily caps are what bound that.

The picture is validated as bytes, never decoded as an image. There is no
image library in the function, so there is no image parser to attack. The
browser has already cropped and resized it; the server checks that the
result is a real JPEG, PNG or WebP of modest size, and stores it as sent.
"""

import base64
import binascii
import re

import config

# Unicode letters and digits (\w minus underscore, checked separately),
# spaces, and the punctuation that turns up in real names.
_NICKNAME_RE = re.compile(r"^[\w .'\-]+$")
_HAS_LETTER_OR_DIGIT = re.compile(r"[^\W_]")

# Decoded bytes must start with one of these, matching the declared type.
_MAGIC = {
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/webp": (b"RIFF",),
}

_DATA_URL_RE = re.compile(r"^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$")


class ProfileError(ValueError):
    """A client-safe message about what was wrong with the input."""


def clean_nickname(value) -> str | None:
    """A nickname fit for the prompt, or None when the field is empty.

    Raises ProfileError for anything that is neither empty nor acceptable.
    """
    if value is None:
        return None
    if not isinstance(value, str):
        raise ProfileError("Nickname must be text")

    cleaned = " ".join(value.split())
    if not cleaned:
        return None
    if len(cleaned) > config.MAX_NICKNAME_CHARS:
        raise ProfileError(f"Nickname must be {config.MAX_NICKNAME_CHARS} characters or fewer")
    if "_" in cleaned or not _NICKNAME_RE.match(cleaned):
        raise ProfileError("Nickname can use letters, numbers, spaces, apostrophes and hyphens")
    if not _HAS_LETTER_OR_DIGIT.search(cleaned):
        raise ProfileError("Nickname needs at least one letter or number")
    return cleaned


def validate_avatar(value) -> str | None:
    """A data URL holding a small JPEG, PNG or WebP, or None when empty.

    Raises ProfileError otherwise. The URL is returned as given so the
    browser gets back exactly what it stored.
    """
    if value is None or value == "":
        return None
    if not isinstance(value, str):
        raise ProfileError("Picture must be an image")

    # Base64 grows by 4/3; refuse oversize input before decoding it.
    if len(value) > config.MAX_AVATAR_BYTES * 4 // 3 + 64:
        raise ProfileError("Picture is too large")

    match = _DATA_URL_RE.match(value)
    if not match:
        raise ProfileError("Picture must be a JPEG, PNG or WebP")
    mime, payload = match.groups()

    try:
        raw = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ProfileError("Picture could not be read") from exc

    if len(raw) > config.MAX_AVATAR_BYTES:
        raise ProfileError("Picture is too large")
    if not raw.startswith(_MAGIC[mime]):
        raise ProfileError("Picture does not match its type")
    if mime == "image/webp" and raw[8:12] != b"WEBP":
        raise ProfileError("Picture does not match its type")
    return value


def clean_shares(body: dict) -> dict:
    """The two "what may the companion see" switches, as real booleans.

    A missing key keeps the default rather than silently switching something
    off, so an older client that does not know about these cannot turn a
    person's nickname sharing off by omission. Anything present must be a
    true boolean: a string like "false" is a bug in the caller, and quietly
    reading it as true is how a person ends up sharing a journal they never
    agreed to share.
    """
    shares = {}
    for key, default in (("share_nickname", True), ("share_journal", False)):
        value = body.get(key)
        if value is None:
            shares[key] = default
        elif isinstance(value, bool):
            shares[key] = value
        else:
            raise ProfileError("Sharing choices must be true or false")
    return shares
