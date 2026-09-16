"""Identity and Turnstile verification.

Identity is the Cognito `sub` claim. API Gateway's JWT authorizer validates
signature, issuer, audience and expiry before the function is invoked, so
these tests cover what happens on this side of that boundary: reading the
claim, and refusing when there isn't one.
"""

import json

import pytest

import auth


class TestUserIdFromEvent:
    @staticmethod
    def event_with(claims):
        return {"requestContext": {"authorizer": {"jwt": {"claims": claims}}}}

    def test_reads_the_subject_claim(self):
        event = self.event_with({"sub": "9f1c-user", "email": "a@example.com"})
        assert auth.user_id_from_event(event) == "9f1c-user"

    @pytest.mark.parametrize(
        "event",
        [
            {},
            {"requestContext": {}},
            {"requestContext": {"authorizer": {}}},
            {"requestContext": {"authorizer": {"jwt": {}}}},
            {"requestContext": {"authorizer": {"jwt": {"claims": {}}}}},
        ],
        ids=["empty", "no-authorizer", "no-jwt", "no-claims", "claims-without-sub"],
    )
    def test_refuses_when_there_is_no_subject(self, event):
        with pytest.raises(auth.AuthError):
            auth.user_id_from_event(event)

    @pytest.mark.parametrize("value", ["", None, 123, {"nested": "object"}])
    def test_refuses_a_non_string_or_empty_subject(self, value):
        with pytest.raises(auth.AuthError):
            auth.user_id_from_event(self.event_with({"sub": value}))

    def test_identity_is_not_taken_from_the_request_body(self):
        """The body must never influence identity, whatever it claims."""
        event = self.event_with({"sub": "real-user"})
        event["body"] = json.dumps({"user_id": "victim", "sub": "victim"})
        assert auth.user_id_from_event(event) == "real-user"


class TestSourceIp:
    def test_reads_v2_location(self):
        event = {"requestContext": {"http": {"sourceIp": "203.0.113.7"}}}
        assert auth.source_ip(event) == "203.0.113.7"

    def test_v1_shape_does_not_resolve(self):
        """The baseline read this location and silently got 'unknown'."""
        event = {"requestContext": {"identity": {"sourceIp": "203.0.113.7"}}}
        assert auth.source_ip(event) == "unknown"

    def test_missing_context_is_unknown(self):
        assert auth.source_ip({}) == "unknown"


class TestTurnstile:
    @staticmethod
    def _siteverify_returning(payload):
        class FakeResponse:
            def read(self):
                return json.dumps(payload).encode()

            def __enter__(self):
                return self

            def __exit__(self, *exc):
                return False

        return lambda *args, **kwargs: FakeResponse()

    def test_empty_token_never_calls_cloudflare(self, monkeypatch):
        def explode(*args, **kwargs):
            raise AssertionError("should not have made a network call")

        monkeypatch.setattr(auth.urllib.request, "urlopen", explode)
        assert auth.verify_turnstile("") is False

    def test_network_failure_fails_closed(self, monkeypatch):
        """A Cloudflare outage must not become an open sign-up."""

        def explode(*args, **kwargs):
            raise OSError("cloudflare unreachable")

        monkeypatch.setattr(auth.urllib.request, "urlopen", explode)
        assert auth.verify_turnstile("some-token") is False

    def test_accepts_a_good_token(self, monkeypatch):
        monkeypatch.setattr(
            auth.urllib.request,
            "urlopen",
            self._siteverify_returning(
                {"success": True, "action": "signup", "hostname": "saheeh.ai"}
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
        """success alone is not enough; the action must match too."""
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
                {"success": True, "action": "signup", "hostname": "evil.example"}
            ),
        )
        assert auth.verify_turnstile("wrong-host") is False

    def test_allows_localhost_for_development(self, monkeypatch):
        monkeypatch.setattr(
            auth.urllib.request,
            "urlopen",
            self._siteverify_returning(
                {"success": True, "action": "signup", "hostname": "localhost"}
            ),
        )
        assert auth.verify_turnstile("dev") is True
