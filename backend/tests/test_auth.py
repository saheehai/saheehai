"""Device token and identity tests.

These cover the properties the baseline backend did not have: that identity
cannot be forged, and that source IP is read from the right place.
"""

import base64
import json
import time

import pytest

import auth


def test_issued_token_verifies_back_to_its_subject():
    token, user_id, expires_at = auth.issue_token()
    assert auth.verify_token(token) == user_id
    assert expires_at > time.time()


def test_issue_token_can_carry_an_existing_identity():
    """A renewing visitor keeps its journal instead of getting a new id."""
    _, original_id, _ = auth.issue_token()
    token, carried_id, _ = auth.issue_token(original_id)
    assert carried_id == original_id
    assert auth.verify_token(token) == original_id


@pytest.mark.parametrize(
    "token",
    ["", "garbage", "only-one-part", "a.b.c", "....", "Bearer x"],
    ids=["empty", "garbage", "one-part", "three-parts", "dots", "prefixed"],
)
def test_malformed_tokens_are_rejected(token):
    with pytest.raises(auth.AuthError):
        auth.verify_token(token)


def test_tampered_payload_is_rejected():
    """The core property: a caller cannot rewrite the subject.

    This is what stops `GET /journal` from being pointed at another user.
    """
    token, _, _ = auth.issue_token()
    _, signature = token.split(".")

    forged_payload = auth._b64url_encode(
        json.dumps({"sub": "victim", "iat": 0, "exp": int(time.time()) + 999}).encode()
    )

    with pytest.raises(auth.AuthError, match="Bad signature"):
        auth.verify_token(f"{forged_payload}.{signature}")


def test_token_signed_with_a_different_key_is_rejected():
    import hashlib
    import hmac

    payload = auth._b64url_encode(
        json.dumps({"sub": "attacker", "exp": int(time.time()) + 999}).encode()
    )
    wrong_sig = auth._b64url_encode(
        hmac.new(b"wrong-key", payload.encode(), hashlib.sha256).digest()
    )

    with pytest.raises(auth.AuthError):
        auth.verify_token(f"{payload}.{wrong_sig}")


def test_expired_token_is_rejected():
    token, _, _ = auth.issue_token()
    payload_b64, _ = token.split(".")
    payload = json.loads(auth._b64url_decode(payload_b64))
    payload["exp"] = int(time.time()) - 1

    stale = auth._b64url_encode(json.dumps(payload, separators=(",", ":")).encode())
    with pytest.raises(auth.AuthError, match="expired"):
        auth.verify_token(f"{stale}.{auth._sign(stale)}")


def test_token_without_subject_is_rejected():
    payload = auth._b64url_encode(
        json.dumps({"exp": int(time.time()) + 999}, separators=(",", ":")).encode()
    )
    with pytest.raises(auth.AuthError, match="subject"):
        auth.verify_token(f"{payload}.{auth._sign(payload)}")


def test_unreadable_payload_is_rejected():
    payload = base64.urlsafe_b64encode(b"not json").decode().rstrip("=")
    with pytest.raises(auth.AuthError):
        auth.verify_token(f"{payload}.{auth._sign(payload)}")


class TestBearerExtraction:
    def test_reads_bearer_header(self):
        event = {"headers": {"authorization": "Bearer abc123"}}
        assert auth.bearer_token_from_event(event) == "abc123"

    def test_header_name_is_case_insensitive(self):
        event = {"headers": {"Authorization": "Bearer abc123"}}
        assert auth.bearer_token_from_event(event) == "abc123"

    @pytest.mark.parametrize(
        "event",
        [{}, {"headers": None}, {"headers": {}}, {"headers": {"authorization": "Basic x"}}],
    )
    def test_missing_or_wrong_scheme_yields_empty(self, event):
        assert auth.bearer_token_from_event(event) == ""


class TestSourceIp:
    def test_reads_v2_location(self):
        """The baseline read the v1 location and always got 'unknown'."""
        event = {"requestContext": {"http": {"sourceIp": "203.0.113.7"}}}
        assert auth.source_ip(event) == "203.0.113.7"

    def test_v1_shape_does_not_resolve(self):
        event = {"requestContext": {"identity": {"sourceIp": "203.0.113.7"}}}
        assert auth.source_ip(event) == "unknown"

    def test_missing_context_is_unknown(self):
        assert auth.source_ip({}) == "unknown"


class TestTurnstile:
    def test_empty_token_never_calls_cloudflare(self, monkeypatch):
        def explode(*args, **kwargs):
            raise AssertionError("should not have made a network call")

        monkeypatch.setattr(auth.urllib.request, "urlopen", explode)
        assert auth.verify_turnstile("") is False

    def test_network_failure_fails_closed(self, monkeypatch):
        """A Cloudflare outage must not turn into an open API."""

        def explode(*args, **kwargs):
            raise OSError("cloudflare unreachable")

        monkeypatch.setattr(auth.urllib.request, "urlopen", explode)
        assert auth.verify_turnstile("some-token") is False

    @staticmethod
    def _siteverify_returning(payload):
        """Stand in for Cloudflare's siteverify response."""

        class FakeResponse:
            def read(self):
                return json.dumps(payload).encode()

            def __enter__(self):
                return self

            def __exit__(self, *exc):
                return False

        return lambda *args, **kwargs: FakeResponse()

    def test_accepts_a_good_token(self, monkeypatch):
        monkeypatch.setattr(
            auth.urllib.request,
            "urlopen",
            self._siteverify_returning(
                {"success": True, "action": "session", "hostname": "saheeh.ai"}
            ),
        )
        assert auth.verify_turnstile("good") is True

    def test_rejects_unsuccessful_verification(self, monkeypatch):
        monkeypatch.setattr(
            auth.urllib.request,
            "urlopen",
            self._siteverify_returning({"success": False, "error-codes": ["invalid-input"]}),
        )
        assert auth.verify_turnstile("bad") is False

    def test_rejects_a_token_minted_for_another_action(self, monkeypatch):
        """success alone is not enough: the action must match too."""
        monkeypatch.setattr(
            auth.urllib.request,
            "urlopen",
            self._siteverify_returning(
                {"success": True, "action": "some-other-surface", "hostname": "saheeh.ai"}
            ),
        )
        assert auth.verify_turnstile("replayed") is False

    def test_rejects_a_token_solved_on_another_host(self, monkeypatch):
        monkeypatch.setattr(
            auth.urllib.request,
            "urlopen",
            self._siteverify_returning(
                {"success": True, "action": "session", "hostname": "evil.example"}
            ),
        )
        assert auth.verify_turnstile("wrong-host") is False

    def test_allows_localhost_for_development(self, monkeypatch):
        monkeypatch.setattr(
            auth.urllib.request,
            "urlopen",
            self._siteverify_returning(
                {"success": True, "action": "session", "hostname": "localhost"}
            ),
        )
        assert auth.verify_turnstile("dev") is True
