"""Sign-up gating.

Sign-up runs from the browser straight to Cognito, so this trigger is the
only server-side check standing between a script and an unlimited supply of
accounts. A per-account quota is worth nothing if accounts are free to mint,
so these tests care most about the ways it could wrongly say yes.
"""

import pytest

import auth
import presignup

CONSENT = {"age_attested": "18+", "policies_accepted": "2026-09-16"}


def ok_metadata(**overrides):
    return {"turnstile_token": "good", **CONSENT, **overrides}


def signup_event(client_metadata=None):
    return {
        "triggerSource": "PreSignUp_SignUp",
        "request": {
            "userAttributes": {"email": "someone@example.com"},
            "clientMetadata": client_metadata,
        },
        "response": {},
    }


@pytest.fixture
def turnstile_ok(monkeypatch):
    monkeypatch.setattr(auth, "verify_turnstile", lambda token, ip=None: True)


@pytest.fixture
def turnstile_fails(monkeypatch):
    monkeypatch.setattr(auth, "verify_turnstile", lambda token, ip=None: False)


def test_allows_signup_with_a_valid_token(turnstile_ok):
    result = presignup.lambda_handler(signup_event(ok_metadata()), None)
    assert result["response"]["autoConfirmUser"] is False
    assert result["response"]["autoVerifyEmail"] is False


def test_does_not_auto_confirm(turnstile_ok):
    """An address must be proven before it can be used for account recovery."""
    result = presignup.lambda_handler(signup_event(ok_metadata()), None)
    assert result["response"]["autoConfirmUser"] is False


@pytest.mark.parametrize(
    "metadata",
    [None, {}, {**CONSENT}, {**CONSENT, "turnstile_token": ""}, {**CONSENT, "something_else": "x"}],
    ids=["none", "empty", "consent-only", "blank-token", "wrong-key"],
)
def test_rejects_signup_without_a_token(metadata, turnstile_ok):
    with pytest.raises(presignup.SignUpRejected):
        presignup.lambda_handler(signup_event(metadata), None)


def test_rejects_signup_when_verification_fails(turnstile_fails):
    with pytest.raises(presignup.SignUpRejected):
        presignup.lambda_handler(signup_event(ok_metadata(turnstile_token="bad")), None)


@pytest.mark.parametrize(
    "value",
    [None, "", "yes", "true", "17", "18"],
    ids=["absent", "blank", "yes", "true", "seventeen", "bare-18"],
)
def test_rejects_signup_without_age_attestation(value, turnstile_ok):
    """Only the exact value the form sends counts; anything else is a script guessing."""
    metadata = ok_metadata()
    if value is None:
        del metadata["age_attested"]
    else:
        metadata["age_attested"] = value
    with pytest.raises(presignup.SignUpRejected, match="18 or older"):
        presignup.lambda_handler(signup_event(metadata), None)


@pytest.mark.parametrize("value", [None, "", "   "], ids=["absent", "blank", "spaces"])
def test_rejects_signup_without_policy_acceptance(value, turnstile_ok):
    metadata = ok_metadata()
    if value is None:
        del metadata["policies_accepted"]
    else:
        metadata["policies_accepted"] = value
    with pytest.raises(presignup.SignUpRejected, match="Terms and Privacy Policy"):
        presignup.lambda_handler(signup_event(metadata), None)


def test_turnstile_is_checked_before_consent(turnstile_fails):
    """A script without a real token should learn nothing about the consent rules."""
    with pytest.raises(presignup.SignUpRejected, match="Verification failed"):
        presignup.lambda_handler(signup_event({"turnstile_token": "bad"}), None)


def test_rejection_messages_do_not_leak_internals(turnstile_ok):
    with pytest.raises(presignup.SignUpRejected) as info:
        presignup.lambda_handler(signup_event(ok_metadata(age_attested="")), None)
    text = str(info.value).lower()
    assert "metadata" not in text
    assert "lambda" not in text
    assert "cognito" not in text


def test_fails_closed_when_the_secret_is_missing(monkeypatch):
    """A misconfigured trigger must not become an open door."""
    monkeypatch.setattr(presignup.config, "TURNSTILE_SECRET", "")
    monkeypatch.setattr(auth, "verify_turnstile", lambda token, ip=None: True)

    with pytest.raises(presignup.SignUpRejected):
        presignup.lambda_handler(signup_event({"turnstile_token": "good"}), None)


def test_rejection_message_does_not_leak_internals(turnstile_fails):
    """The message reaches the browser, so it must say nothing useful."""
    with pytest.raises(presignup.SignUpRejected) as excinfo:
        presignup.lambda_handler(signup_event({"turnstile_token": "bad"}), None)

    message = str(excinfo.value).lower()
    for leak in ("secret", "turnstile", "cloudflare", "lambda", "aws"):
        assert leak not in message
