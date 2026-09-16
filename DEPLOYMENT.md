# Saheeh AI — Development & Deployment

GitHub is the source of truth. Merging to `main` deploys; nothing is deployed from a laptop in the normal course of work.

## Architecture

```
Browser ──▶ CloudFront (saheeh.ai) ──▶ S3 bucket (static React build)
   │
   ├──────▶ Cognito user pool  (sign up / sign in, SRP)
   │              └── PreSignUp Lambda verifies a Turnstile challenge
   │
   └──────▶ API Gateway ──▶ Lambda ──▶ Bedrock
              │      │          └────▶ DynamoDB (chat, journal, quota)
              │      └── per-account daily quota
              └── JWT authorizer validates the Cognito token
```

The browser never talks to Bedrock directly and holds no AWS credentials.

**Accounts are required.** Every API route needs a signed-in user. API Gateway's
JWT authorizer validates the token against the user pool before the Lambda is
invoked, so an unauthenticated request never reaches application code, and
`user_id` is the Cognito `sub` — never anything the caller sent.

Sign-up runs from the browser straight to Cognito, so the **PreSignUp trigger is
the only server-side place a check can stand between a script and unlimited
accounts**. It verifies a Turnstile token passed in `clientMetadata`. Without
it the per-account quota would be meaningless, because accounts would be free.

> An earlier design gave browsers direct Bedrock access via a Cognito *Identity*
> Pool, and a later one issued anonymous HMAC device tokens. Both are gone.

## Repository layout

```
frontend/   React app (CRA). The only env var it reads is REACT_APP_API_ENDPOINT.
backend/    Lambda source for /chat and /journal.
infra/      CloudFormation / SAM templates.
.github/    CI and deployment workflows.
```

## Local development

```bash
cd frontend
npm ci
cp .env.example .env.local     # then set REACT_APP_API_ENDPOINT
npm start
```

`REACT_APP_API_ENDPOINT` is **required and has no fallback**. If it is unset,
API calls fail with an explicit error rather than silently pointing at
production. This is deliberate: a hardcoded fallback is how the previous API
URL ended up baked into every published bundle.

## How deployment works

| Workflow | Trigger | Effect |
|---|---|---|
| `ci.yml` | every PR, and pushes to `main` | Builds the frontend with warnings-as-errors, lints/tests the backend, validates templates, and fails if a hardcoded API endpoint reappears in source. |
| `deploy-frontend.yml` | push to `main` touching `frontend/**` | Builds, syncs to S3, invalidates CloudFront, smoke-tests the site. |
| `deploy-backend.yml` | push to `main` touching `backend/**` or `infra/backend.yaml` | `sam build && sam deploy`, then verifies an unauthenticated `POST /chat` is rejected. |

Path filters mean a frontend-only commit never redeploys the backend, and
vice versa. Both deploy workflows use `concurrency` groups so two runs cannot
race to the same bucket or stack.

### Cache headers

Hashed assets (`main.<hash>.js`) upload with `max-age=31536000,immutable`;
`index.html` uploads with `no-cache`. Assets go up **before** `index.html`, so
the new HTML never references an asset that has not landed yet. Reversing this
serves users a stale app indefinitely.

## One-time AWS setup

### 1. Create the GitHub OIDC deploy role

No long-lived AWS keys are stored in GitHub. GitHub Actions federates into a
scoped IAM role instead.

```bash
aws cloudformation deploy \
  --template-file infra/github-oidc.yaml \
  --stack-name saheehai-github-oidc \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
      GitHubOrg=saheehai \
      GitHubRepo=saheehai \
      SiteBucketName=saheeh.ai \
      CloudFrontDistributionId=<DISTRIBUTION_ID>
```

If the account already has a GitHub OIDC provider, add
`CreateOIDCProvider=false` — an account may only have one per URL.

Two things about this role are easy to get wrong:

**The OIDC subject depends on whether the job declares an environment.** A job
with `environment: production` presents
`repo:saheehai/saheehai:environment:production`, *not*
`repo:saheehai/saheehai:ref:refs/heads/main`. The trust policy accepts both.
The environment subject carries no branch, so what actually pins deploys to
`main` is the deployment branch policy on the GitHub `production` environment
(Settings → Environments → production → deployment branches). If you remove
that restriction, any branch can deploy.

**SAM artifacts go to a pre-made bucket.** `sam deploy --resolve-s3` would
provision its own bucket via a managed stack, which requires the deploy role
to hold `s3:CreateBucket`, `s3:TagResource` and `s3:DeleteBucket`. The bucket
is instead created out of band and passed with `--s3-bucket`, so the role has
Get/Put/List on that one bucket and no bucket-lifecycle rights at all.

Then read the role ARN:

```bash
aws cloudformation describe-stacks --stack-name saheehai-github-oidc \
  --query "Stacks[0].Outputs[?OutputKey=='DeployRoleArn'].OutputValue" --output text
```

The role's trust policy is scoped to `refs/heads/main`, so pull requests —
including those from forks — cannot reach AWS at all.

### 2. Configure the repository

Under **Settings → Secrets and variables → Actions**:

**Variables** (not secret; the endpoint is public in the bundle regardless):

| Variable | Example |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::<account>:role/saheehai-github-actions-deploy` |
| `AWS_REGION` | `us-east-1` |
| `S3_BUCKET` | `saheeh.ai` |
| `CLOUDFRONT_DISTRIBUTION_ID` | `E1234567890ABC` |
| `API_ENDPOINT` | `https://<api-id>.execute-api.us-east-1.amazonaws.com` |
| `COGNITO_USER_POOL_ID` | `us-east-1_XXXXXXXXX` (backend stack output) |
| `COGNITO_CLIENT_ID` | app client id (backend stack output) |
| `SITE_URL` | `https://saheeh.ai` |
| `BACKEND_STACK_NAME` | `saheehai-backend` |

**Secrets:**

| Secret | Purpose |
|---|---|
| `TURNSTILE_SECRET` | Cloudflare Turnstile secret key, verified by the PreSignUp trigger. |
| `ORIGIN_VERIFY_SECRET` | Random string CloudFront attaches to API requests as `x-origin-verify`. Leave unset until the `/api/*` behavior exists (see below); once set, the API refuses anything that did not come through CloudFront. |

Delete any legacy `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` secrets once
OIDC is confirmed working. They are a standing liability.

### 3. Protect `main`

**Settings → Branches → Add rule** for `main`: require the `CI` status check,
require a pull request, and disallow direct pushes.

## Manual deploy (emergency only)

```bash
cd frontend
REACT_APP_API_ENDPOINT=<endpoint> npm run build
aws s3 sync build/ s3://saheeh.ai --delete
aws cloudfront create-invalidation --distribution-id <id> --paths "/*"
```

Use this only when Actions is unavailable. A manual deploy makes the live site
diverge from `main`, so follow it with a real commit.

## Troubleshooting

**Deep links 404 (`/journal`, `/mission`).** The app uses `BrowserRouter`, so
those are real HTTP paths. CloudFront needs a custom error response mapping
403/404 → `/index.html` with status 200.

**Site returns `NoSuchWebsiteConfiguration`.** The S3 bucket lost its static
website configuration. Re-enable it with `index.html` as both index and error
document.

**Sign-up fails with "Verification required".** The PreSignUp trigger did not
receive a Turnstile token in `clientMetadata`. Check that `REACT_APP_TURNSTILE_SITE_KEY`
is set in the build, and that the widget's domain list in Cloudflare covers the
host you are on — including `localhost` for local development.

**The user pool is retained on stack delete.** `DeletionPolicy: Retain`, because
it holds real accounts. Deleting the stack leaves the pool behind; a template
change that would *replace* it is the dangerous case, since that would orphan
every account.

**CI fails on a warning.** Intentional — `CI=true` makes react-scripts treat
warnings as errors. Fix the warning.

**`sam build` fails with "Binary validation failed for python".** The workflow's
Python must match the Lambda runtime — `sam build` shells out to a matching
interpreter to install dependencies. Both are pinned to 3.13; changing the
function runtime means changing `actions/setup-python` too.

**Deep links 404 rather than 200.** S3 website hosting serves `index.html` for
unknown paths but keeps the 404 status. The CloudFront distribution rewrites
403/404 to `/index.html` with status 200. Both halves are needed.

**Deploy fails with "Repository variable X is not set."** Add it under
Settings → Secrets and variables → Actions → Variables.


## Putting the API behind CloudFront

The browser currently calls the API Gateway URL directly. Routing it through
the site's CloudFront distribution instead does three things: API calls
become same-origin (`https://saheeh.ai/api/...`), CloudFront adds the
viewer's country and US state to every request, and the function can refuse
requests that did not come through the edge.

The geographic restriction on the Experiments (`backend/geo.py`,
`backend/blocked_regions.json`) depends on those headers. Until this is
wired up every request is "unknown" and is allowed through (logged as such),
so the code can ship first and the edge follow.

The distribution (`E1OJ7HUYX27R2J`) is console-managed, so this is a
one-time manual change. The backend stack creates the two policies it needs
and prints their ids as outputs.

1. Deploy the backend so `ApiCachePolicyId`, `ApiOriginRequestPolicyId` and
   `ApiOriginDomain` exist in the stack outputs.
2. Generate a secret and store it as the `ORIGIN_VERIFY_SECRET` repository
   secret: `openssl rand -hex 32`.
3. In CloudFront, on the distribution:
   - **Add an origin.** Domain: the `ApiOriginDomain` output. Protocol:
     HTTPS only. Add a custom header `x-origin-verify` with the secret.
   - **Add a behavior.** Path pattern `/api/*`, the new origin, viewer
     protocol HTTPS only, allowed methods GET/HEAD/OPTIONS/PUT/POST/PATCH/
     DELETE, cache policy `saheehai-backend-api-no-cache`, origin request
     policy `saheehai-backend-api-origin`, no response headers policy.
4. Redeploy the backend (a push to `main` touching `backend/**` or
   `infra/**`, or a manual run) so the function picks up the secret.
5. Set the `API_ENDPOINT` repository variable to `https://saheeh.ai/api`
   and redeploy the frontend.
6. Check `/journal` and the chat work, then set the `GEO_BLOCK_UNKNOWN`
   repository variable to `true` if you want unresolved locations refused
   rather than allowed.

To undo: clear `ORIGIN_VERIFY_SECRET`, point `API_ENDPOINT` back at the
execute-api URL, redeploy both. The behavior can stay.

## Geographic restriction

Where the Experiments are refused is data, not code:
`backend/blocked_regions.json`. Each entry is a country code, optionally a
state or province code, and the name shown to the person refused. Editing
the file and merging is enough; the deploy workflow picks it up.

**The list needs regular review.** State laws on AI-delivered mental health
services moved quickly in 2025 and are still moving in 2026. The file
carries a `next_review` date; when you review it, update the date. The
informational site is never affected by this list.

The check returns HTTP 451 with a readable message. It runs after
authentication (an anonymous probe learns nothing about the list) and before
any quota is spent.
