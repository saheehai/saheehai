<div align="center">

<img src=".github/assets/banner.svg" alt="I love you, and you are going to do great things!" width="100%">

<br>

**A gentle wellness companion — chat and journal, in one quiet place.**

[saheeh.ai](https://saheeh.ai)

</div>

<br>

## What this is

Saheeh AI is a small wellness app. It is not a therapist and does not pretend to be one

Built with React on the front and a Python Lambda on the back, served from S3
behind CloudFront.

## Repository

```
frontend/   React app (Create React App)
backend/    Python Lambda — chat and journal API
infra/      CloudFormation and SAM templates
```

## Working on it

```bash
cd frontend
npm ci
cp .env.example .env.local     # then fill in the two values it asks for
npm start
```

```bash
cd backend
pip install -r requirements-dev.txt
pytest tests/ -q
```

Everything deploys from GitHub: open a pull request, let CI go green, merge.
Only what you changed redeploys. The full picture — architecture, the AWS
setup, and the pipeline's sharper edges — lives in
[DEPLOYMENT.md](DEPLOYMENT.md).

## A note on care

This app holds what people write on their hardest days. That shapes the
engineering: accounts are real, journals are private to their owner, message
content stays out of logs, and nothing is retained longer than it needs to be.
If you contribute, please hold that line.

<div align="center">
<br>
<sub>Made with care 🤍</sub>
</div>
