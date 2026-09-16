"""Geographic restriction on the Experiments.

The chat and journal are refused from places whose law prohibits AI-delivered
mental health services. Location comes from CloudFront's viewer headers, which
are only trusted when the request provably came through CloudFront.
"""

import json
import os

import pytest

import config
import geo
import lambda_function

USER = "cognito-sub-geo"


def event(path="/chat", method="POST", headers=None, body=None):
    return {
        "requestContext": {
            "http": {"method": method, "path": path, "sourceIp": "203.0.113.7"},
            "authorizer": {"jwt": {"claims": {"sub": USER}}},
        },
        "rawPath": path,
        "headers": {"content-type": "application/json", **(headers or {})},
        "body": json.dumps(body or {"message": "hello"}),
    }


def status_and_body(response):
    return response["statusCode"], json.loads(response["body"])


def at(country, region=None, **extra):
    """Headers CloudFront would add for a viewer in this place."""
    headers = {"cloudfront-viewer-country": country}
    if region:
        headers["cloudfront-viewer-country-region"] = region
    headers.update(extra)
    return headers


# --- The list ----------------------------------------------------------------


def test_blocklist_loads_the_four_initial_states():
    assert {("US", "IL"), ("US", "NV"), ("US", "RI"), ("US", "ME")} <= set(geo.BLOCKED)
    assert geo.BLOCKED[("US", "IL")] == "Illinois"


def test_blocklist_file_documents_its_review_cadence():
    path = config.BLOCKED_REGIONS_FILE or os.path.join(
        os.path.dirname(geo.__file__), "blocked_regions.json"
    )
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    assert data["next_review"]
    assert any("REVIEW" in line for line in data["_readme"])


def test_a_country_level_entry_blocks_every_region(monkeypatch, tmp_path):
    path = tmp_path / "blocked.json"
    path.write_text(json.dumps({"blocked": [{"country": "XX", "name": "Nowhere"}]}))
    blocked = geo._load_blocklist(str(path))
    assert blocked == {("XX", None): "Nowhere"}
    monkeypatch.setattr(geo, "BLOCKED", blocked)
    with pytest.raises(geo.RegionBlocked):
        geo.enforce(event(headers=at("XX", "AB")))
    with pytest.raises(geo.RegionBlocked):
        geo.enforce(event(headers=at("xx")))


# --- Enforcement ---------------------------------------------------------------


@pytest.mark.parametrize("path", ["/chat", "/journal", "/api/chat", "/api/journal"])
def test_blocked_state_gets_451_with_a_readable_reason(path):
    method = "POST"
    body = {"message": "hi", "content": "entry"}
    response = lambda_function.lambda_handler(
        event(path, method, headers=at("US", "IL"), body=body),
        None,
    )
    status, payload = status_and_body(response)
    assert status == 451
    assert payload["code"] == "region_blocked"
    assert payload["region"] == "US-IL"
    assert "Illinois" in payload["error"]
    assert "rest of the site" in payload["error"]


def test_blocked_state_never_spends_quota(monkeypatch):
    calls = []
    monkeypatch.setattr(lambda_function.storage, "consume_quota", lambda uid: calls.append(uid))
    lambda_function.lambda_handler(event(headers=at("US", "NV")), None)
    assert calls == []


def test_journal_listing_is_refused_too():
    response = lambda_function.lambda_handler(
        event("/journal", "GET", headers=at("US", "ME")),
        None,
    )
    assert response["statusCode"] == 451


def test_allowed_state_passes_through():
    assert geo.enforce(event(headers=at("US", "TX"))).code == "US-TX"


def test_other_countries_pass_when_not_listed():
    assert geo.enforce(event(headers=at("CA", "ON"))).code == "CA-ON"


def test_header_names_are_case_insensitive():
    with pytest.raises(geo.RegionBlocked):
        geo.enforce(
            event(
                headers={
                    "CloudFront-Viewer-Country": "US",
                    "CloudFront-Viewer-Country-Region": "ri",
                }
            )
        )


# --- Unknown location ----------------------------------------------------------


def test_unknown_location_is_allowed_by_default(monkeypatch):
    monkeypatch.setattr(config, "GEO_BLOCK_UNKNOWN", False)
    assert geo.enforce(event()).code == "unknown"
    # US with no state is also unknown for our purposes: we block by state.
    assert geo.enforce(event(headers=at("US"))).code == "US"


def test_unknown_location_can_be_refused(monkeypatch):
    monkeypatch.setattr(config, "GEO_BLOCK_UNKNOWN", True)
    with pytest.raises(geo.RegionBlocked) as exc:
        geo.enforce(event())
    assert "could not determine" in str(exc.value)
    with pytest.raises(geo.RegionBlocked):
        geo.enforce(event(headers=at("US")))
    # A country we do not block by state needs no state to be resolved.
    assert geo.enforce(event(headers=at("CA"))).code == "CA"


# --- Trust ---------------------------------------------------------------------


def test_geo_headers_are_ignored_without_the_origin_secret_when_one_is_required(monkeypatch):
    monkeypatch.setattr(config, "ORIGIN_VERIFY_SECRET", "edge-secret")
    # Someone calling API Gateway directly and claiming to be in Texas.
    spoof = event(headers=at("US", "TX"))
    with pytest.raises(geo.UntrustedOrigin):
        geo.enforce(spoof)
    status, payload = status_and_body(lambda_function.lambda_handler(spoof, None))
    assert status == 403
    assert "saheeh.ai" in payload["error"]


def test_request_through_cloudfront_is_trusted(monkeypatch):
    monkeypatch.setattr(config, "ORIGIN_VERIFY_SECRET", "edge-secret")
    ok = event(headers=at("US", "TX", **{"x-origin-verify": "edge-secret"}))
    assert geo.enforce(ok).code == "US-TX"
    wrong = event(headers=at("US", **{"x-origin-verify": "edge-secre"}))
    with pytest.raises(geo.UntrustedOrigin):
        geo.enforce(wrong)


def test_anonymous_requests_learn_nothing_about_the_list():
    # Auth is checked first, so a probe without a token never sees a 451.
    e = event(headers=at("US", "IL"))
    del e["requestContext"]["authorizer"]
    assert lambda_function.lambda_handler(e, None)["statusCode"] == 401
