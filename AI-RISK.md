# AI risk management

How Saheeh AI manages the risks of the AI in its product, organised around
the [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
(AI RMF 1.0, January 2023) and its
[Generative AI Profile](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
(NIST AI 600-1, July 2024). Written 2026-09-17 to go with
[COMPLIANCE.md](COMPLIANCE.md), which covers the laws, and the Terms and
Privacy Policy at `/legal`.

The AI RMF is voluntary. Nobody certifies against it and nobody is required
to use it. We use it because it is the most careful public description of
what it takes to build AI that people can trust, and because a wellness
companion that talks to people on hard days deserves that level of care.

**We hold this repository to the AI RMF.** Every change to the companion, its
prompt, its model, or the data it touches is expected to keep the controls
below true, and to add to this file when it changes what the system does.
Texas's Responsible AI Governance Act, which we are subject to, gives a
deployer that follows the NIST AI RMF a defense in enforcement; the sections
below are also our evidence under that Act (see COMPLIANCE.md, "Texas:
TRAIGA").

This is an engineering record. It says what exists, what is missing, and who
owns the gap. Where we fall short of the framework, it says so.

## What the AI here is

One system: the **companion**, a chat at `/chat` behind an account. It is a
general-purpose language model (`openai.gpt-oss-120b-1:0`, called through
Amazon Bedrock) with a system prompt in `backend/system_prompt.txt` that
limits it to supportive wellness conversation, psychoeducation, and pointing
people to real help. It is not therapy, not a diagnostic tool, and not a
crisis service. It is labelled beta and secondary to the site.

The journal at `/journal` stores what people write; no model reads it. The
rest of the site is static. So everything below is about the companion.

## The seven characteristics of trustworthy AI

NIST defines trustworthy AI as valid and reliable, safe, secure and
resilient, accountable and transparent, explainable and interpretable,
privacy-enhanced, and fair with harmful bias managed. What each means here:

| Characteristic | What we do | Where | Gap |
|---|---|---|---|
| Valid and reliable | The companion is scoped to a task a general model does reliably: supportive conversation with a fixed crisis protocol. It is told it can be wrong and to say so. | `backend/system_prompt.txt` (scope, "Transparency", crisis format) | No systematic evaluation of prompt behaviour over time. See MEASURE. |
| Safe | Crisis-resources protocol in the prompt, 988 in every page footer and in the notice before first use, geographic refusal where AI therapy is restricted, a daily message cap, no medical or medication advice by design. | prompt "Critical safety protocols"; `frontend/src/components/SiteFooter.js`, `DisclaimerModal.js`; `backend/geo.py`; `backend/storage.py` quota | Safety behaviour is asserted by the prompt, not measured against a test set. |
| Secure and resilient | Every request is authenticated (Cognito JWT), sign-up is gated by Turnstile and a server-side trigger, the server holds conversation history so a client cannot forge the model's own turns, CORS is one origin, IAM roles are scoped to what each function needs. | `backend/auth.py`, `backend/presignup.py`, `backend/lambda_function.py`, `infra/backend.yaml` | The API is not yet behind CloudFront, so the geo signal and origin check are partial (DEPLOYMENT.md). |
| Accountable and transparent | People are told they are talking to AI before the first message, in the Terms, and by the companion itself. The whole system is open source, including the prompt. A named nonprofit board is accountable. | `DisclaimerModal.js`; Terms §5; prompt "Ethical commitments"; `/team` | Board members are not yet named on the site. |
| Explainable and interpretable | Not applicable in the usual sense: there is no automated decision about a person to explain. What the companion is and is not is stated plainly on every surface. | Terms §5, About page, Resources hub | |
| Privacy-enhanced | The model receives only the current conversation; nothing is used to train it (Bedrock's policy, invocation logging off). Logs hold no message text and expire in 30 days. Anyone can get a copy of their data or have it deleted. | COMPLIANCE.md "What we collect"; `backend/data_request.py` | |
| Fair, harmful bias managed | The prompt requires inclusive, gender-neutral language and no assumptions about identity or beliefs, and refuses dehumanising framing. The service is free, so cost does not decide who gets it. | prompt "Inclusivity", "Cultural sensitivity" | No bias testing of outputs across groups. See MEASURE. |

## The four functions

The AI RMF organises the work into GOVERN, MAP, MEASURE and MANAGE. The
tables use NIST's category numbers so the mapping can be checked against
the framework.

### GOVERN: policies, accountability, culture

| Category | Status | Where |
|---|---|---|
| 1. Policies and practices for managing AI risk are in place and transparent | Done | This file, COMPLIANCE.md, the Terms and Privacy Policy, all public in the repo |
| 2. Accountability structures are in place | Partial | A three-member nonprofit board is accountable; members to be named on `/team` |
| 3. Diversity, equity, inclusion and accessibility in teams | Gap | A volunteer organisation of three; the Support page asks for clinicians, translators and people with lived experience |
| 4. A culture of critical thinking and safety first | Done in practice | Every prompt and backend change goes through a pull request and CI; the repo's care note asks contributors to hold the line on privacy |
| 5. Engagement with affected people and communities | Partial | Contact route and public issue tracker exist; no advisory input from clinicians or users yet |
| 6. Third-party software and data risks are addressed | Done | The only AI dependency is the Bedrock model, chosen for its data policy; see MANAGE 3 |

### MAP: context, purpose, impacts

| Category | Status | Where |
|---|---|---|
| 1. Context is established and understood | Done | Purpose, limits and who it is not for are written down: Terms §5, this file, COMPLIANCE.md "The shape of the product" |
| 2. The system is categorised | Done | Generative AI, third-party foundation model, conversational, no autonomous action, no decisions about people |
| 3. Capabilities, goals, benefits and costs are understood | Done | Benefit: a free, always-available place to reflect and be pointed to help. Cost: confabulation and over-reliance, addressed below |
| 4. Risks of all components including third parties are mapped | Done | Generative AI risks table below |
| 5. Impacts on individuals and society are characterised | Done | The people most likely here are in distress and priced out of care; that is why the crisis path is on every page and the companion is told to send people to humans |

### MEASURE: testing and metrics

| Category | Status | Where |
|---|---|---|
| 1. Methods and metrics are identified | Partial | Backend behaviour has 130 automated tests (auth, quota, geo, sign-up gating, data requests). The companion's conversational behaviour has none |
| 2. The system is evaluated for trustworthiness | Gap | No test set of prompts checking crisis handling, refusal of medical advice, or bias. This is the largest gap in this file |
| 3. Identified risks are tracked over time | Partial | This file and the issue tracker; no incident log yet beyond COMPLIANCE.md's history |
| 4. Feedback on measurement is gathered | Gap | No user feedback mechanism inside the chat |

### MANAGE: responding to risk

| Category | Status | Where |
|---|---|---|
| 1. Risks are prioritised and responded to | Done | The 2026-09 abuse incident led to a rebuilt backend: authentication, server-held history, a working quota, scoped roles, logs without content |
| 2. Strategies to maximise benefit and minimise harm | Done | Companion is secondary to the site; crisis lines come first; guides and find-care links exist so the chat is never the only door |
| 3. Third-party risks are managed | Done | Model provider chosen for no-training data policy; single model, pinned by id; no plugins or tools given to the model |
| 4. Response, recovery and communication plans | Partial | Kill switch: the API can be disabled at the gateway and the site stays up. Data-request workflow covers deletion. No written incident communication plan |

## Generative AI risks

NIST AI 600-1 names twelve risks specific to generative AI. For each, how
much it applies to a supportive chat that takes no actions, and what stands
against it.

| Risk (NIST AI 600-1 §2) | Here | Control |
|---|---|---|
| 2.1 CBRN information | Low. The companion is not a research assistant. | Prompt scope; the model's own refusals |
| 2.2 Confabulation | **High.** A confident wrong answer about medication or a hotline number could hurt. | Crisis numbers and referral text are fixed strings in the prompt, not generated; the companion is told to acknowledge uncertainty and never to diagnose or advise on medication; the site's own guides carry sourced facts |
| 2.3 Dangerous, violent or hateful content | Medium. | Prompt forbids it; the model's safety training; a daily cap limits probing |
| 2.4 Data privacy | **High.** People share health information. | Nothing is used for training; the model sees only the current conversation; logs hold no text; export and delete on request; 30-day log expiry |
| 2.5 Environmental impact | Low. Short conversations, capped per day, one model call per message. | Output capped at 1000 tokens |
| 2.6 Harmful bias and homogenisation | Medium. | Inclusive-language rules in the prompt; no personalisation, so the same care for everyone. Untested; see MEASURE 2 |
| 2.7 Human-AI configuration | **High.** Over-reliance on a chat instead of care is the central risk of this product. | Companion is told to avoid dependency and to suggest closing the app; beta label; disclaimer before first use; crisis line on every page; daily message cap; idle sign-out |
| 2.8 Information integrity | Medium. | Referral resources are fixed text; guides link every fact to its source, carry a Draft label until reviewed, and name their reviewer; the companion cannot browse |
| 2.9 Information security | Medium. Prompt injection via forged history was the 2026-09 abuse vector. | History is server-held; every call authenticated; input length capped; no tools or plugins for the model |
| 2.10 Intellectual property | Low. | The model is licensed through Bedrock; the prompt is our own |
| 2.11 Obscene, degrading or abusive content | Medium. | Prompt scope; model safety training; Terms §9 acceptable use; quota |
| 2.12 Value chain and component integration | Medium. One third-party model we do not control. | Pinned model id; provider chosen for its data policy; the prompt is versioned in the repo so a model swap can be re-tested |

## Practices we are adopting from the framework

The framework's suggested actions that fit an organisation this size, with
an owner. Dates are targets, not promises.

1. **A behaviour test set for the companion** (MEASURE 2). A fixed list of
   prompts covering crisis statements, requests for diagnosis or medication
   advice, self-harm minimisation, and hateful framing, with the expected
   shape of each answer, run against the live prompt and model before any
   prompt or model change merges. Owner: engineering. Target: before the
   next prompt change.
2. **A model and prompt change log** (MEASURE 3, MANAGE 4). A dated entry
   in this file each time the model id or `system_prompt.txt` changes, with
   the test-set result. Owner: whoever makes the change.
3. **Clinical review of the prompt** (GOVERN 5, MAP 5). One licensed
   clinician reads the system prompt and the crisis protocol and is named
   here as having done so, the same way guides carry a reviewer. Owner:
   board. Target: with the first volunteer clinician.
4. **In-chat feedback** (MEASURE 4). A one-tap "this was not helpful" on a
   reply, stored as a count with no content. Owner: engineering.
5. **An incident record** (MANAGE 4). A dated section in COMPLIANCE.md for
   anything that harmed or nearly harmed a person, what changed after, and
   who was told. The 2026-09 abuse incident is the first entry.
6. **Name the board on the site** (GOVERN 2). Owner: board.

## Review

This file is reviewed whenever the model, the prompt, or the data flow
changes, and at least quarterly alongside `backend/blocked_regions.json`.
Last reviewed: 2026-09-17.

## Sources

- NIST AI RMF 1.0: https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf
- NIST AI RMF Playbook: https://airc.nist.gov/airmf-resources/playbook/
- NIST AI 600-1, Generative AI Profile: https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf
- NIST Trustworthy and Responsible AI Resource Center: https://airc.nist.gov/
