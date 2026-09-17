<div align="center">

<img src=".github/assets/banner.svg" alt="I love you, and you are going to do great things!" width="100%">

<br>

**A nonprofit making health information and support easier to reach: free guides to paying for care, a private journal, and an AI companion in beta.**

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

## Publishing news and guides

Two folders at the top of the repo are content, not code:

- [`news/`](news/): short posts about what is changing. Copy
  `news/_template.md` to a file named like `2026-09-16-back-online.md` (the
  date it goes up, then a short slug), fill in the front matter, write, merge.
- [`resources/`](resources/): plain-language guides, in three tracks,
  "paying for care", "mental health basics" and "the foundations". Copy
  `resources/_template.md` to a file named like `hospital-charity-care.md`
  (no date: guides are updated, not dated). A guide starts as
  `status: draft`, is shown on the site with a "Draft" label so a reviewer
  can read it in place, and becomes `published` with a `reviewed_by` line
  once a clinician or benefits counselor has read it. An optional `order`
  number puts a guide ahead of its track-mates; without it, newest first.

Nothing else to touch: the build turns both folders into the JSON the pages
read, writes the sitemap, and prerenders a static HTML shell per route for
crawlers. A malformed file fails the build with a message saying which file
and why.

Crisis lines and the "find care" list on `/help` live in
`frontend/src/content/resources.js`; the board on `/team` lives in
`frontend/src/content/team.json` and the page appears once that list has an
entry. The contact inbox and EIN, when they exist, go in
`frontend/src/content/site.js`.

## A note on care

This app holds what people write on their hardest days. That shapes the
engineering: accounts are real, journals are private to their owner, message
content stays out of logs, and nothing is retained longer than it needs to be.
If you contribute, please hold that line.

<div align="center">
<br>
<sub>Made with care 🤍</sub>
</div>
