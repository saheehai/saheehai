# Compliance posture

What Saheeh AI does today about the laws people ask about, what is still to
do, and who owns it. Written 2026-09-16 to go with the Terms of Use and
Privacy Policy at `/legal` (source: `frontend/src/content/legal.js`).

This is an engineering record, not a legal opinion. "Compliant" is a
conclusion a lawyer reaches about an organization, not a property of a
codebase. What follows is the evidence they would ask for.

## The shape of the product

- The **site** (`/`, `/help`, `/resources`, `/news`, `/support`, `/mission`,
  `/team`, `/legal`) is static, informational, needs no account, sets no
  cookies, and runs no analytics or tracking. Its one form is the newsletter
  sign-up, which stores an email address only after the owner confirms it.
- The **Experiments** (`/chat`, `/journal`) are beta features behind an
  account. The chat is an AI wellness companion. It is not therapy and is
  never described as therapy. It is secondary to the site, and is labelled
  "(beta)" in the menu and in the notice before first use.

Everything below that concerns personal or health data is about the
Experiments; the site collects nothing beyond a confirmed newsletter address.

## What we collect and where it lives

| Data | Where | Retention | Notes |
|---|---|---|---|
| Email, password hash | Cognito user pool (us-east-1) | Life of account | SRP sign-in; password never reaches our code |
| Consent record: 18+ attestation, date of the Terms accepted | Cognito user attributes `custom:age_attested`, `custom:policies_accepted` | Life of account | Written once at sign-up, required by the PreSignUp trigger, immutable |
| Chat messages and replies | DynamoDB `saheeh_chat_history` | Life of account | Keyed by Cognito `sub`; conversation ownership enforced server-side |
| Journal entries, mood | DynamoDB `saheeh_journal` | Life of account | Keyed by Cognito `sub` |
| Daily quota counters | DynamoDB `saheehai-backend-quota` | ~2 days (TTL) | No content |
| Newsletter address, token, sign-up page, timestamps | DynamoDB `saheehai-backend-subscribers` | Until unsubscribe, then 30 days (TTL) | Double opt-in via SES; no IP, no name. Turnstile on the form |
| Function logs | CloudWatch | 30 days | Ids and errors only; no message or entry text |
| API access logs | CloudWatch | 30 days | Who, what, when, from where, status. No bodies |
| Browser local storage | The person's device | Until sign-out | Session tokens, current chat, draft, last-active time |

Third parties: AWS (everything, including SES for the newsletter),
Cloudflare (Turnstile at account sign-up and on the newsletter form only).
Amazon Bedrock does not retain or train on prompts and completions, and
model invocation logging is **off** in this account (verified 2026-09-16),
so no chat content is copied into logs or S3 by the model service.

## HIPAA

**Applicability.** Saheeh AI is not currently a covered entity. The
Experiments are offered directly to individuals, not through a provider or
plan, and no PHI is received from a covered entity. HIPAA therefore does not
govern the data today. If a clinic, therapist or plan ever sends patients or
data to us, we become a business associate and need a BAA with them and
with AWS before that starts. The Privacy Policy says exactly this.

**Posture anyway.** Because the content is health-adjacent, the Security
Rule's technical safeguards are used as the baseline whether or not the
rule applies:

| Safeguard (45 CFR 164.312) | Status | Where |
|---|---|---|
| Access control: unique user id | Done | Cognito `sub` is the only identity; never caller-supplied |
| Access control: automatic logoff | Done | 30 minutes idle, all tabs (`frontend/src/hooks/useIdleSignOut.js`) |
| Access control: encryption at rest | Done | DynamoDB and S3 default encryption (AWS-owned keys) |
| Audit controls | Done in code | API Gateway access log (`infra/backend.yaml`), function logs, 30-day retention. Needs a deploy |
| Integrity | Partial | Conversation history is server-held and cannot be rewritten by the client. No PITR yet (below) |
| Person or entity authentication | Done | JWT authorizer at the gateway; SRP; email verification; 12-char passwords |
| Transmission security | Done | TLS 1.2+ at CloudFront and API Gateway; HTTPS redirect |

**Still to do, in priority order.** These are account changes, not code,
and some cost a little money. None has been made yet.

1. **Point-in-time recovery** on `saheeh_chat_history` and `saheeh_journal`
   (both currently `DISABLED`). Cheap for tables this size; the difference
   between a bad deploy and lost journals.
   `aws dynamodb update-continuous-backups --table-name saheeh_journal --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true`
2. **CloudTrail** for the account (none configured). Management-event
   logging is free for one trail; it is the audit log for who changed the
   infrastructure.
3. **S3 public access block** on the `saheeh.ai` bucket is fully off and the
   bucket policy is public. That is how S3 website hosting works, and the
   bucket holds only the built site, but it should be swapped for an Origin
   Access Control so only CloudFront can read it. Medium effort; do it when
   the CloudFront `/api/*` behavior is being added (DEPLOYMENT.md).
4. **Response headers policy** on CloudFront: HSTS, `X-Content-Type-Options`,
   a Content-Security-Policy. No cost.
5. **AWS BAA** (accept in AWS Artifact) and **Cloudflare** terms review,
   only if and when a covered entity relationship starts.
6. **Written policies**: risk analysis, incident response, workforce access
   review. Required if HIPAA ever applies; sensible now for a two-person
   AWS account. Root MFA is on; both IAM users should have MFA too.

## Texas: TRAIGA (Responsible AI Governance Act, effective 2026-01-01)

Applies to anyone deploying an AI system in Texas. It is intent-based: it
prohibits developing or deploying AI with the intent to manipulate people
into self-harm or crime, to discriminate against protected classes, to
produce sexual content involving minors, or (for government) to identify
people biometrically or score them socially. It also requires health-care
service providers to disclose AI use to patients.

| Requirement | Status | Where |
|---|---|---|
| Disclose to the person that they are interacting with AI | Done | Modal before first chat; Terms §5; the companion's own greeting |
| No prohibited intent or use | Done by design | System prompt limits the companion to supportive wellness conversation; abuse controls in the backend; Terms §5 and §9 |
| Not a health-care provider under the Act's disclosure duty | N/A today | Becomes relevant only if used within a provider's care |
| Route for complaints | Done | Terms §5 names the Texas Attorney General as enforcer and gives our contact |
| Cure period awareness | Note | The Act gives 60 days to cure after AG notice. Keep the contact channel monitored |

Related Texas law already reflected: the Texas Data Privacy and Security
Act (rights in Privacy Policy §7; no sale, no targeted advertising, no
profiling) and the Charitable Immunity and Liability Act (Terms §13).

## Other US states: AI-delivered therapy bans

Illinois, Nevada, Rhode Island and Maine are refused the Experiments
entirely (`backend/blocked_regions.json`, enforced in `backend/geo.py`,
HTTP 451). The list is reviewed quarterly; `next_review` is in the file.
Enforcement is only as good as the location signal: it needs the API behind
CloudFront (DEPLOYMENT.md), and until then unresolved locations are
allowed and logged.

## GDPR and UK GDPR

**Applicability.** Not today: no establishment in the EU/UK, the service is
not directed at people there, no tracking of behaviour, zero known EU users.
Article 3(2) is not triggered by the mere reachability of a website.

**Written to extend, not rewrite.** The Privacy Policy already has the
pieces GDPR would require, in generic form:

- Purposes and legal bases (Privacy §2, §7) named as contract and
  legitimate interests, which is what they would be.
- Rights of access, correction, deletion, objection, restriction and
  complaint, offered to everyone (§7) with a 45-day response time (GDPR
  would need 30).
- Retention periods (§4), processors (§3), international transfer (§7: data
  is in the US), children (§8), breach notice (§5).

If EU/UK users become a reality, the remaining work is: name a
representative (Art. 27) if required, shorten the response time to 30 days,
adopt the EU standard contractual clauses (AWS's DPA already includes them),
keep a record of processing (this file is most of it), and reassess whether
the health-content exemption in Art. 9 needs explicit consent for the chat.
No cookie banner is needed while there are no cookies.

## Where the promises live

| Promise | Enforced by |
|---|---|
| "We collect only what the service needs" | `backend/lambda_function.py` reads only `message`, `conversation_id`, journal fields |
| "Logs hold no message text" | Function logs log ids and errors; access log format has no body |
| "Cleared when you sign out" | `PERSONAL_LOCAL_KEYS` in `frontend/src/App.js` |
| "Signed out after inactivity" | `useIdleSignOut`, 30 minutes |
| "Not used to train AI models" | Bedrock's data policy; invocation logging off |
| "Not available in [state]" | `backend/geo.py` + CloudFront viewer headers |
| "Nothing is sent until you click the confirmation link" | `backend/subscribe.py`: pending until `/subscribe/confirm` |
| "Unsubscribing deletes the address within 30 days" | `expires_at` TTL set on unsubscribe; table TTL enabled |
| "See what we hold about you, and get a copy" | `backend/data_request.py --action export`, run by `.github/workflows/data-request.yml`; runbook in DEPLOYMENT.md |
| "Delete your account, chat history and journal within 30 days" | `backend/data_request.py --action delete`: tables first, Cognito last, then a remaining-rows check; same workflow |
| "You must be 18 or older" and "you agree to the Terms" | Two separate boxes on sign-up; `backend/presignup.py` rejects a sign-up without them; recorded as `custom:age_attested` and `custom:policies_accepted` |
| "You are talking to an AI" | `DisclaimerModal`, Terms §5 |

## Operational access

Data requests run in GitHub Actions under the deploy role, which holds
`dynamodb:*` and `cognito-idp:*` on every resource. That is enough, and more
than the job needs; a narrower role is a follow-up. Only the `saheehai`
GitHub account can start the workflow, and each run is logged with who ran
it, when, and which issue it served. The repository is public, so the
workflow prints counts only and encrypts the export before it leaves the
runner.

## Review

Re-read this file, `blocked_regions.json` and the `/legal` text every
quarter, and whenever a feature touches what is collected, where it is
stored, or who it is shown to. Update `LAST_UPDATED` in
`frontend/src/content/legal.js` when the public text changes.
