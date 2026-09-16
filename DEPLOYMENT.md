# Saheeh AI — Development & Deployment

GitHub is the source of truth. Merging to `main` deploys; nothing is deployed from a laptop in the normal course of work.

## Architecture

```
Browser ──▶ CloudFront (saheeh.ai) ──▶ S3 bucket (static React build)
   │
   └──────▶ API Gateway ──▶ Lambda ──▶ Bedrock
                   │            └────▶ DynamoDB (chat history, journal)
                   └── Turnstile authorizer + WAF rate limits
```

The browser never talks to Bedrock directly and holds no AWS credentials.

> An earlier design did give browsers direct Bedrock access via a Cognito
> Identity Pool. That was abandoned. If you find `REACT_APP_COGNITO_*` or
> `REACT_APP_BEDROCK_*` referenced anywhere, it is leftover from that design —
> no code reads them.

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
| `API_ENDPOINT` | `https://<new-api-id>.execute-api.us-east-1.amazonaws.com/prod` |
| `SITE_URL` | `https://saheeh.ai` |
| `BACKEND_STACK_NAME` | `saheehai-backend` |

**Secrets:**

| Secret | Purpose |
|---|---|
| `TURNSTILE_SECRET` | Cloudflare Turnstile secret key, validated server-side by the authorizer. |

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
