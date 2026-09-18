"""Repo-wide checks on things the website promises out loud.

These are not unit tests of any module. They are the promises in the footer,
the Terms and the Privacy Policy, written down somewhere that fails a build.
They live in `backend/tests` because `pytest` is what CI runs and there is no
frontend test runner yet, so this is the only place a cross-file invariant
can be enforced. If a frontend runner ever lands, the frontend half of this
belongs there instead.

Nothing here talks to AWS or to a model. It reads files.
"""

import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
PROMPT = (ROOT / "backend" / "system_prompt.txt").read_text()
RESOURCES = (ROOT / "frontend" / "src" / "content" / "resources.js").read_text()
LEGAL = (ROOT / "frontend" / "src" / "content" / "legal.js").read_text()
SITE_NAV = (ROOT / "frontend" / "src" / "components" / "SiteNav.js").read_text()

FRONTEND_SRC = ROOT / "frontend" / "src"


# --- The crisis lines ------------------------------------------------------
#
# AI-RISK.md rates confabulation High and says the mitigation is that crisis
# numbers are fixed strings in the prompt rather than generated. That is only
# true while the strings are actually there.


@pytest.mark.parametrize(
    "number,who",
    [
        ("988", "the Suicide and Crisis Lifeline"),
        ("741741", "Crisis Text Line"),
        ("1-800-799-7233", "the domestic violence hotline"),
        ("1-800-662-4357", "the SAMHSA helpline"),
        ("911", "emergency services"),
    ],
)
def test_the_companion_still_has_the_crisis_numbers(number, who):
    assert number in PROMPT, f"{who} is gone from system_prompt.txt"


def test_the_crisis_numbers_agree_across_the_site():
    """resources.js says to change both places. This is what notices.

    The list on /help, quoted in the footer, is the same list the companion
    is told to refer people to. A number corrected in one place and not the
    other sends somebody to a line that has moved.
    """
    pattern = re.compile(r"\b(988|741741|1-800-\d{3}-\d{4}|911)\b")
    in_prompt = set(pattern.findall(PROMPT))
    on_the_site = set(pattern.findall(RESOURCES))

    # The site carries support lines the companion is not given (NAMI, for
    # one), so this is one-directional: nothing the companion hands out may
    # be missing from the page a person is sent to.
    missing = in_prompt - on_the_site
    assert not missing, f"the companion gives out numbers that are not in resources.js: {missing}"


def test_the_companion_still_says_it_is_not_a_provider():
    assert "not a mental health provider" in PROMPT.lower()


def test_the_companion_still_has_a_crisis_response_format():
    """The protocol is what turns a disclosure into a phone number."""
    assert "CRISIS RESPONSE" in PROMPT.upper()


# --- What the Terms enumerate ----------------------------------------------


def test_every_experiment_in_the_menu_is_named_in_the_terms():
    """Terms section 1 lists the Experiments by name, so the list can go stale.

    Adding a fourth one to the header without amending the Terms leaves the
    site offering something its own agreement does not describe.
    """
    labels = re.findall(r"\{\s*label:\s*'([^']+)',\s*tag:\s*'beta'", SITE_NAV)
    assert labels, "could not find the EXPERIMENTS list in SiteNav.js"

    # Only the sentence in section 1 that defines the term counts. Searching
    # the whole file passes on any stray word: "Practice" also appears in
    # "Texas Civil Practice and Remedies Code", and "chat" appears throughout
    # the Privacy Policy.
    definition = re.search(
        r'Under "Experiments" the Site also(.*?)\(the "Experiments"\)',
        LEGAL,
        re.S,
    )
    assert definition, "could not find the Experiments definition in Terms section 1"
    defined = definition.group(1).lower()

    for label in labels:
        assert label.lower() in defined, (
            f'"{label}" is in the Experiments menu but Terms section 1 does not define it. '
            "Amend section 1 and bump LAST_UPDATED."
        )



# --- No cookies, no analytics, no tracking ---------------------------------


def test_nothing_in_the_frontend_tracks_anybody():
    """The Privacy Policy says there is no analytics, advertising or tracking.

    Cloudflare Turnstile on the sign-up form is the one third party, and it
    is disclosed in its own addendum, so it is allowed here.
    """
    forbidden = re.compile(
        r"google-analytics|googletagmanager|gtag\(|mixpanel|posthog|hotjar|"
        r"fbq\(|amplitude|segment\.com|document\.cookie",
        re.I,
    )
    offenders = []
    for path in FRONTEND_SRC.rglob("*.js"):
        # legal.js and the policy pages talk *about* cookies and analytics.
        if path.name in ("legal.js",):
            continue
        for number, line in enumerate(path.read_text().splitlines(), 1):
            if forbidden.search(line):
                offenders.append(f"{path.relative_to(ROOT)}:{number}")
    assert not offenders, f"tracking code on a site that promises none: {offenders}"
