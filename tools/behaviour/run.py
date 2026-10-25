#!/usr/bin/env python3
"""Run the behaviour cases against the live prompt and the live model.

AI-RISK.md, practice 1: a fixed list of prompts run before any prompt or
model change merges. This is it.

It talks to Bedrock directly rather than through the API, on purpose. The
thing under test is `backend/system_prompt.txt` and `MODEL_ID`, not the
Lambda around them, and going through the API would spend a real account's
daily allowance and write rows to the chat table for a person who does not
exist.

    AWS_PROFILE=saheehai python3 tools/behaviour/run.py
    AWS_PROFILE=saheehai python3 tools/behaviour/run.py --samples 5
    AWS_PROFILE=saheehai python3 tools/behaviour/run.py --case crisis-plan -v

It costs money, a few cents a run at the default of three samples over
sixteen cases. It needs `bedrock:InvokeModel` and it does not need any of
the site's tables.

**Three samples, not one.** The live temperature is 0.7, so one sample is an
anecdote. A case passes only when every sample passes: these are safety
floors, and a floor that holds two times in three is not a floor.

A case's `checks` decide that. Its `style` is printed and never counted,
because house style is not a safety floor and the one rule in there, the em
dash, failed every sample of every case on two models while it was counted,
and hid everything else in the output.

Exit code is 0 when every case passed and 1 otherwise, so this can gate a
merge. The last thing it prints is the line to paste into the AI-RISK.md
change log, because a result nobody wrote down is a result nobody has.
"""

import argparse
import json
import os
import re
import sys
from collections import Counter
from datetime import date
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(HERE))

from graders import grade  # noqa: E402

PROMPT_FILE = ROOT / "backend" / "system_prompt.txt"
CASES_FILE = HERE / "cases.json"

# Read from backend/config.py rather than repeated here, so the suite cannot
# drift from what is deployed by someone changing one and not the other.
CONFIG = (ROOT / "backend" / "config.py").read_text()


def _config_default(name, cast, fallback):
    match = re.search(
        rf'^{name} = .*?os\.environ\.get\(\s*"{name}",\s*([^)]+)\)', CONFIG, re.M
    )
    if not match:
        return fallback
    return cast(match.group(1).strip().strip('"').strip("'"))


MODEL_ID = os.environ.get("MODEL_ID") or _config_default(
    "MODEL_ID", str, "global.anthropic.claude-haiku-4-5-20251001-v1:0"
)
TEMPERATURE = float(os.environ.get("TEMPERATURE") or _config_default("TEMPERATURE", float, 0.7))
MAX_TOKENS = int(os.environ.get("MAX_OUTPUT_TOKENS") or _config_default(
    "MAX_OUTPUT_TOKENS", int, 1000
))
REGION = os.environ.get("AWS_REGION", "us-east-1")


def ask(client, prompt, message):
    """One turn, cold. No history, no nickname block, no journal block.

    The prompt has to hold on the first message from someone it knows
    nothing about, which is also the most common shape of a real first
    conversation.
    """
    response = client.converse(
        modelId=MODEL_ID,
        messages=[{"role": "user", "content": [{"text": message}]}],
        system=[{"text": prompt}],
        inferenceConfig={"maxTokens": MAX_TOKENS, "temperature": TEMPERATURE},
    )
    return next(
        (b["text"] for b in response["output"]["message"]["content"] if "text" in b), ""
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--samples", type=int, default=3, help="replies per case (default 3)")
    parser.add_argument("--case", action="append", help="run only this case id; repeatable")
    parser.add_argument("--category", action="append", help="run only this category; repeatable")
    parser.add_argument("-v", "--verbose", action="store_true", help="print every reply")
    parser.add_argument("--json", type=Path, help="write the full result here")
    args = parser.parse_args()

    import boto3

    prompt = PROMPT_FILE.read_text()
    cases = json.loads(CASES_FILE.read_text())["cases"]
    if args.case:
        cases = [c for c in cases if c["id"] in args.case]
    if args.category:
        cases = [c for c in cases if c["category"] in args.category]
    if not cases:
        sys.exit("no cases matched")

    client = boto3.client("bedrock-runtime", region_name=REGION)

    print(f"model      {MODEL_ID}")
    print(f"prompt     {PROMPT_FILE.relative_to(ROOT)} ({len(prompt)} chars)")
    print(f"settings   temperature {TEMPERATURE}, maxTokens {MAX_TOKENS}")
    print(f"running    {len(cases)} cases x {args.samples} samples\n")

    results = []
    failed_cases = 0
    style_notes = Counter()

    for case in cases:
        samples = []
        for _ in range(args.samples):
            try:
                reply = ask(client, prompt, case["message"])
            except Exception as exc:  # noqa: BLE001 - a failed call is a failed case
                samples.append({"reply": "", "failures": [["call", str(exc)]]})
                continue
            samples.append(
                {
                    "reply": reply,
                    "failures": [list(f) for f in grade(reply, case["checks"])],
                    "style": [list(f) for f in grade(reply, case.get("style", []))],
                }
            )

        bad = [s for s in samples if s["failures"]]
        ok = not bad
        if not ok:
            failed_cases += 1
        for sample in samples:
            for check, _problem in sample.get("style", []):
                style_notes[check] += 1

        mark = "pass" if ok else "FAIL"
        good = len(samples) - len(bad)
        print(f"[{mark}] {case['id']}  ({case['category']}, {good}/{len(samples)})")
        for sample in bad:
            for check, problem in sample["failures"]:
                print(f"         {check}: {problem}")
        if args.verbose or bad:
            for sample in (samples if args.verbose else bad):
                body = sample["reply"].strip() or "(no reply)"
                print("         | " + body.replace("\n", "\n         | ")[:1500] + "\n")

        results.append({**case, "samples": samples, "passed": ok})

    total = len(cases)
    passed = total - failed_cases
    by_category = Counter(c["category"] for c in results if not c["passed"])

    print(f"\n{passed}/{total} cases passed, {args.samples} samples each")
    if by_category:
        print("failing categories: " + ", ".join(f"{k} ({v})" for k, v in by_category.items()))

    # Reported, never counted. A house-style rule is not a safety floor, and
    # while the em dash sat in `checks` it failed every sample of every case
    # on both models and pushed everything that mattered off the screen.
    samples_run = total * args.samples
    for check, n in style_notes.most_common():
        print(f"style     {check}: {n} of {samples_run} samples (not counted)")

    if args.json:
        args.json.write_text(
            json.dumps(
                {
                    "date": date.today().isoformat(),
                    "model": MODEL_ID,
                    "temperature": TEMPERATURE,
                    "samples": args.samples,
                    "passed": passed,
                    "total": total,
                    "style_notes": dict(style_notes),
                    "cases": results,
                },
                indent=2,
            )
        )
        print(f"full result written to {args.json}")

    print("\nFor the AI-RISK.md change log:")
    print(
        f"  Behaviour test set: {passed}/{total} cases passed "
        f"({args.samples} samples each, {MODEL_ID}, {date.today().isoformat()})."
    )

    return 1 if failed_cases else 0


if __name__ == "__main__":
    sys.exit(main())
