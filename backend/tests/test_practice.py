"""Practice: the gate, the thumbs, and what a vote is allowed to remember.

The cards themselves are static files on the CDN and never come through this
function. What is pinned down here is the pair of things that do: that
Practice is refused where the other Experiments are refused, and that a vote
records a card without recording a person. The last one is the point of the
whole route. A table that knows which cards someone disliked is a table that
knows what they were reading about on a bad day, and there is no reason for
this site to hold that.
"""

import json

import pytest

import lambda_function
import practice
import storage

USER = "cognito-sub-abc123"
OTHER_USER = "cognito-sub-victim"
CARD = "cbt-evidence-both-ways-01"


def event(method, path, body=None, sub=USER, query=None):
    """An API Gateway v2 event with (or without) validated JWT claims."""
    request_context = {
        "http": {"method": method, "path": path, "sourceIp": "203.0.113.7"},
    }
    if sub is not None:
        request_context["authorizer"] = {"jwt": {"claims": {"sub": sub, "email": "a@b.test"}}}

    return {
        "requestContext": request_context,
        "rawPath": path,
        "headers": {"content-type": "application/json"},
        "body": json.dumps(body) if body is not None else None,
        "queryStringParameters": query,
    }


def body_of(response):
    return json.loads(response["body"])


@pytest.fixture
def votes(monkeypatch):
    """Captures what would have been written, and lets the quota through."""
    written = []
    monkeypatch.setattr(
        storage, "record_card_vote", lambda card_id, vote: written.append((card_id, vote))
    )
    monkeypatch.setattr(storage, "consume_practice_quota", lambda uid: {"used": 1})
    return written


def call(method, path, body=None, sub=USER, query=None):
    response = lambda_function.lambda_handler(event(method, path, body, sub, query), None)
    return response["statusCode"], body_of(response)


# --- Routing ---------------------------------------------------------------


def test_the_gate_answers_for_a_signed_in_person():
    status, payload = call("GET", "/practice")
    assert status == 200
    assert payload["ok"] is True
    assert "can have mistakes" in payload["notice"]


@pytest.mark.parametrize("method", ["GET", "POST"])
def test_practice_is_reachable_under_the_api_prefix(votes, method):
    """CloudFront forwards /api/*, so both routes need both Events entries."""
    body = {"card_id": CARD, "vote": "up"} if method == "POST" else None
    status, _ = call(method, "/api/practice", body)
    assert status == 200


def test_practice_is_an_experiment_so_it_is_geo_enforced():
    """Not a behaviour test of geo.py, a wiring test.

    Practice has no model in it, which makes it tempting to file with the
    account routes that stay available everywhere. It sits under Experiments
    in the Terms, so it has to be refused where they are.
    """
    assert ("GET", "/practice") in lambda_function._EXPERIMENT_ROUTES
    assert ("POST", "/practice") in lambda_function._EXPERIMENT_ROUTES
    assert ("GET", "/practice") not in lambda_function._ACCOUNT_ROUTES


# --- Identity comes from the token, never the request ----------------------


def test_a_vote_stores_the_card_and_never_the_person(votes, monkeypatch):
    seen = {}
    monkeypatch.setattr(storage, "consume_practice_quota", lambda uid: seen.update(identity=uid))

    status, _ = call("POST", "/practice", {"card_id": CARD, "vote": "down"})

    assert status == 200
    # The quota is spent against the token subject, so a vote still costs the
    # person who cast it something.
    assert seen["identity"] == USER
    # What is written names a card and a direction. Nothing else.
    assert votes == [(CARD, "down")]


def test_a_user_id_in_the_body_cannot_become_the_identity(votes, monkeypatch):
    seen = {}
    monkeypatch.setattr(storage, "consume_practice_quota", lambda uid: seen.update(identity=uid))

    status, _ = call(
        "POST",
        "/practice",
        {"card_id": CARD, "vote": "up", "user_id": OTHER_USER, "sub": OTHER_USER},
    )

    assert status == 200
    assert seen["identity"] == USER


def test_the_gate_refuses_a_request_with_no_subject():
    status, _ = call("GET", "/practice", sub=None)
    assert status == 401


# --- What a vote is allowed to be ------------------------------------------


@pytest.mark.parametrize(
    "card_id",
    [
        pytest.param("", id="empty"),
        pytest.param("../../../etc/passwd", id="traversal"),
        pytest.param("x" * 81, id="too-long"),
        pytest.param(12, id="not-a-string"),
    ],
)
def test_a_vote_needs_a_real_card_id(votes, card_id):
    status, payload = call("POST", "/practice", {"card_id": card_id, "vote": "up"})
    assert status == 400
    assert payload["error"] == "That is not a card."
    assert votes == []


@pytest.mark.parametrize("vote", ["", "UP", "sideways", None])
def test_a_vote_is_up_or_down(votes, vote):
    status, payload = call("POST", "/practice", {"card_id": CARD, "vote": vote})
    assert status == 400
    assert payload["error"] == "A vote is up or down."
    assert votes == []


def test_votes_are_capped_so_one_account_cannot_bury_a_card(monkeypatch):
    written = []
    monkeypatch.setattr(storage, "record_card_vote", lambda *a: written.append(a))

    def full(identity):
        raise storage.QuotaExceeded("That is enough card feedback for today.")

    monkeypatch.setattr(storage, "consume_practice_quota", full)

    status, payload = call("POST", "/practice", {"card_id": CARD, "vote": "down"})

    assert status == 429
    assert "enough card feedback" in payload["error"]
    # Nothing is written once the allowance is gone.
    assert written == []


# --- Logging ---------------------------------------------------------------


def test_a_vote_logs_the_subject_but_not_what_they_voted_on(votes, caplog):
    """Subject and card together would rebuild the record this route avoids."""
    import logging

    with caplog.at_level(logging.INFO):
        call("POST", "/practice", {"card_id": CARD, "vote": "down"})

    assert USER in caplog.text
    assert CARD not in caplog.text


def test_the_notice_on_the_page_and_the_notice_here_are_the_same():
    """The page shows this line and the API repeats it, so they can drift.

    Reads the real file rather than a second copy of the string, because a
    test that compares a literal to itself would pass through exactly the
    change it exists to catch.
    """
    from pathlib import Path

    page = Path(__file__).resolve().parents[2] / "frontend" / "src" / "PracticePage.js"
    assert page.exists(), f"{page} moved; update this test"
    assert practice.AI_NOTICE in page.read_text()
