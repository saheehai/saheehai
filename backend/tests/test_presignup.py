"""Sign-up gating.

Sign-up runs from the browser straight to Cognito, so this trigger is the
only server-side check standing between a script and an unlimited supply of
accounts. A per-account quota is worth nothing if accounts are free to mint,
so these tests care most about the ways it could wrongly say yes.
"""

import pytest

import auth
import presignup


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
    result = presignup.lambda_handler(signup_event({"turnstile_token": "good"}), None)
    assert result["response"]["autoConfirmUser"] is False
    assert result["response"]["autoVerifyEmail"] is False


def test_does_not_auto_confirm(turnstile_ok):
    """An address must be proven before it can be used for account recovery."""
    result = presignup.lambda_handler(signup_event({"turnstile_token": "good"}), None)
    assert result["response"]["autoConfirmUser"] is False


@pytest.mark.parametrize(
    "metadata",
    [None, {}, {"turnstile_token": ""}, {"something_else": "x"}],
    ids=["none", "empty", "blank-token", "wrong-key"],
)
def test_rejects_signup_without_a_token(metadata, turnstile_ok):
    with pytest.raises(presignup.SignUpRejected):
        presignup.lambda_handler(signup_event(metadata), None)


def test_rejects_signup_when_verification_fails(turnstile_fails):
    with pytest.raises(presignup.SignUpRejected):
        presignup.lambda_handler(signup_event({"turnstile_token": "bad"}), None)


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
