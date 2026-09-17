# Working on saheeh.ai

Short notes for anyone (or any assistant) changing this repo. The longer
records are README.md (layout), DEPLOYMENT.md (pipeline and AWS),
COMPLIANCE.md (laws and promises) and AI-RISK.md (the companion).

## What we are building, and for whom

Saheeh AI is a small Texas nonprofit. The site makes health information and
support easier to reach: free plain-language guides on paying for care and
on mental health basics, a private journal, and an AI wellness companion in
beta. The people who land here are often on a hard day, often on a phone,
and often priced out of care.

Three things follow from that and shape every decision:

- **The site is the product; the companion is secondary.** Chat and journal
  are "Experiments", labelled beta, never framed as therapy. A crisis line
  (988) is on every page, and the companion is told to send people to
  humans.
- **Privacy is the point.** Accounts are real, journals are private to
  their owner, logs hold no message text, nothing trains a model, and
  anyone can download or delete their data from the Account page. Do not
  add tracking, analytics or cookies. Anything the companion learns about
  a person is something they switched on themselves, and every such switch
  defaults to the quieter setting unless there is a reason it cannot.
- **It should read as care, not as an app.** Copy sounds like a person:
  short, warm, direct, no jargon, no em dashes, no assumptions about who
  the reader is. Emojis only in light moments.

## Colour palette

Defined once as custom properties in `frontend/src/App.css` and mirrored
in `COLORS` in `frontend/src/utils/constants.js` for the older inline-style
components. Change both together.

| Token | Value | Used for |
|---|---|---|
| `--cream` | `#FFF8E7` | Page background, cards, text on brown |
| `--light-cream` | `#F5E6D3` | Assistant bubbles, hover fills, secondary surfaces |
| `--brown` | `#6B4423` | Header, primary buttons, headings, links, user bubbles |
| `--brown-dark` | `#5A3619` | Primary hover, avatar fallback |
| `--dark-brown` | `#5D4E37` | Body text |
| `--medium-brown` | `#7A5C3C` | Muted text: hints, dates, fine print (about 5.7:1 on cream; do not lighten it, the old `#8B6B47` was marginal) |
| `--brown-line` | `rgba(93, 78, 55, 0.2)` | Borders and dividers |

Accents: success `#2F855A` on `#F0FFF4`, error `#D2691E`, destructive
actions `#9b3a1f`. Nothing else. One hue family on purpose: the site should
feel like paper and wood, not a dashboard.

## Visual language

- **Type:** Inter. Scale roughly h1 32 to 36 / h2 22 to 24 / h3 17 to 18 /
  body 15 to 16 / small 13 to 14, weights 500 and 600 only.
- **Radius:** 8 px for pills, inputs and menu items; 12 px for buttons and
  dialogs' inner panels; 14 to 16 px for cards and sections. Avoid new
  values.
- **Borders:** 2 px `--brown-line` on cards and inputs; 1 px for dividers.
- **Header:** fixed, 56 px, brown, brand left, the same buttons in the same
  order on every page. Labels drop to icons under 640 px. The far right is
  the account pill (picture, nickname, caret) with Account and Sign out in
  its menu.
- **Buttons:** primary is brown on cream, 12 px radius. Secondary is the
  outlined `.page-heading__action`. Disabled uses a flat muted fill, not
  opacity. Destructive buttons use the `--danger` modifier.
- **Chat:** user bubbles brown with white text, tail bottom-right;
  assistant bubbles light cream with a 2 px outline, tail bottom-left. The
  companion's replies render a deliberately small slice of Markdown (bold,
  italic, simple lists) through `utils/messageFormat.js`, built from React
  elements only. Never hand model output to `dangerouslySetInnerHTML`, and
  if you widen the subset, widen the prompt's formatting rules to match. No avatars beside
  bubbles: colour, tail and alignment already say who is speaking, and a
  circle per turn would crowd a phone. The identity cue lives in the
  header.
- **Density:** low. One icon per card, generous whitespace, one accent.
  When in doubt, remove something.
- **Motion:** short and eased (`--ease-out`); everything animated is listed
  under `prefers-reduced-motion`.
- **Focus:** a visible 2 px outline everywhere, cream inside the header.
- **Mobile:** must work at 400 px with no horizontal scroll. Tap targets
  at least 40 px where the label is hidden.

New pages use the CSS-class side of the codebase (`SiteNav`, `.page-content`,
`.page-heading`, `.news` for articles), not the inline `COMMON_STYLES`.
Signed-in pages are not added to `frontend/src/content/pages.json`, which
feeds the sitemap and prerender.

## Findings from the 2026-09-17 UX review

Done in the account work: account pill replaces Sign Out; form labels tied
to inputs; muted brown darkened; intro links on Resources and Support
styled.

Done since: `/signin` has a close control and Escape (its backdrop was
already `inert`, so that half of the finding was stale); the crisis
numbers on `/help` and in the footer are full-width rows at least 44 px
tall; assistant bubbles carry the standard 2 px outline instead of
sitting at about 1.16:1 against the page.

Still open, roughly in priority order:

1. The chat greeting "Ask me anything!" is generic-chatbot voice. Name the
   limits inside the chat shell, with a visible beta chip.
2. No 404 page: unknown paths silently rewrite to `/`. No `href="/signin"`
   anywhere, so sign-in is not linkable; its title is bare.
3. Naming drift: "Chat" on the home page, "the companion" in prose,
   "Experiments" in the nav, footer and Terms. Pick one.
4. Radius ladder has five values and the auth card and menu panel use 1 px
   borders where cards use 2 px. Wrap the header nav in `<nav>`; make
   navigating buttons links; add a skip link.
5. A guide is publicly labelled DRAFT on `/resources`; hide or explain it.
   The home page promises guides that do not exist yet.
6. `/legal` would benefit from a plain-language summary above the text.
   The italic closing line on the home page is unattributed.

## Rules that are easy to break

- Never hardcode the API endpoint in `frontend/src`; CI greps for it.
- Never log message text, journal text, nicknames or email addresses.
- Only the profile row decides what the companion is given. A request body
  must never be able to switch sharing on, and a missing switch keeps its
  default rather than turning something off.
- Identity is always the token's `sub`; never read a user id from a request.
- Every new authenticated route gets two `Events` entries in
  `infra/backend.yaml` (bare and `/api/`) and a "comes from the token" test.
- Bump `LAST_UPDATED` in `frontend/src/content/legal.js` when the legal
  text changes, and update COMPLIANCE.md when what is collected changes.
- Backend: `ruff check .` and `pytest tests/ -q` in `backend/`. Frontend:
  `CI=true npm run build` (warnings are errors).
