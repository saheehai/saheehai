"""Where a request comes from, and whether the Experiments may be used there.

Some US states prohibit AI-delivered mental health services outright, and the
list is growing. The chat and journal are refused from those places; the
informational site is static and never reaches this code, so it stays open
everywhere.

Location comes from CloudFront. The API sits behind the site's distribution
(the /api/* behavior), and CloudFront adds `CloudFront-Viewer-Country` and,
for the US and a few other countries, `CloudFront-Viewer-Country-Region`
(the state code) to every request it forwards. That is free, needs no
database in the package and no third-party lookup, and is accurate enough at
state level for this purpose.

Those headers are only trustworthy if the request really came through
CloudFront. Anyone can call the API Gateway URL directly and type a header.
So CloudFront also attaches a secret `x-origin-verify` header, and once
`ORIGIN_VERIFY_SECRET` is configured every request must carry it: a request
without it is refused before the location is even read. Until the secret is
configured (the distribution not yet wired) the headers are used if present
and their absence is logged, so the check can be deployed ahead of the edge.

The blocked list lives in blocked_regions.json next to this file, so a legal
change is a data change and a deploy, not a code change.
"""

import hmac
import json
import logging
import os
from dataclasses import dataclass

import config

logger = logging.getLogger()

COUNTRY_HEADER = "cloudfront-viewer-country"
REGION_HEADER = "cloudfront-viewer-country-region"
ORIGIN_VERIFY_HEADER = "x-origin-verify"


class UntrustedOrigin(Exception):
    """The request did not come through CloudFront."""


class RegionBlocked(Exception):
    def __init__(self, message: str, region: str):
        super().__init__(message)
        self.region = region


@dataclass(frozen=True)
class Location:
    country: str | None  # ISO 3166-1 alpha-2, e.g. "US"
    region: str | None  # ISO 3166-2 subdivision, e.g. "IL"

    @property
    def code(self) -> str:
        if not self.country:
            return "unknown"
        return f"{self.country}-{self.region}" if self.region else self.country


def _load_blocklist(path: str) -> dict[tuple[str, str | None], str]:
    """Map of (country, region-or-None) -> display name."""
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    blocked = {}
    for entry in data.get("blocked", []):
        country = str(entry.get("country", "")).strip().upper()
        if len(country) != 2:
            raise ValueError(f"blocked_regions.json: bad country in {entry!r}")
        region = entry.get("region")
        region = str(region).strip().upper() or None if region is not None else None
        name = str(entry.get("name") or (f"{country}-{region}" if region else country))
        blocked[(country, region)] = name
    return blocked


BLOCKED = _load_blocklist(
    config.BLOCKED_REGIONS_FILE or os.path.join(os.path.dirname(__file__), "blocked_regions.json")
)


def _headers(event: dict) -> dict:
    return {str(k).lower(): str(v) for k, v in (event.get("headers") or {}).items()}


def locate(event: dict) -> Location:
    """Read the viewer's location from the request.

    Raises UntrustedOrigin if an origin secret is configured and the request
    does not carry it.
    """
    headers = _headers(event)

    if config.ORIGIN_VERIFY_SECRET:
        supplied = headers.get(ORIGIN_VERIFY_HEADER, "")
        if not hmac.compare_digest(supplied, config.ORIGIN_VERIFY_SECRET):
            raise UntrustedOrigin()

    country = headers.get(COUNTRY_HEADER, "").strip().upper() or None
    region = headers.get(REGION_HEADER, "").strip().upper() or None
    return Location(country=country, region=region)


def enforce(event: dict) -> Location:
    """Refuse the request if it comes from a blocked place.

    Returns the location so the caller can log it. Raises RegionBlocked or
    UntrustedOrigin.
    """
    location = locate(event)

    if location.country is None or (
        location.region is None and any(c == location.country for c, r in BLOCKED if r)
    ):
        # No country at all, or a country where we block by state but no
        # state was supplied. Neither can be resolved with confidence.
        if config.GEO_BLOCK_UNKNOWN:
            raise RegionBlocked(
                "We could not determine where you are connecting from, so the "
                "wellness companion and journal are unavailable. The rest of the "
                "site is unaffected.",
                location.code,
            )
        logger.warning("Location could not be resolved (%s); allowing", location.code)
        return location

    name = BLOCKED.get((location.country, None)) or BLOCKED.get((location.country, location.region))
    if name:
        raise RegionBlocked(
            f"The wellness companion and journal are not available in {name}, "
            "where the law restricts AI-delivered mental health services. The "
            "rest of the site is unaffected.",
            location.code,
        )
    return location
