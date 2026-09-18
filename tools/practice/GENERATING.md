# Writing more Practice cards

The deck that ships today is ten cards, hand written and in `deck/`. This is
how to grow it, and roughly what it costs.

Everything here runs on your machine, by hand. Nothing in CI generates cards,
no API key lives in the repo or in GitHub, and no card reaches the site
without you having read it.

## Once, before the first run

```sh
cd tools/practice
npm install
export ANTHROPIC_API_KEY=sk-ant-...      # console.anthropic.com
```

`node_modules/` and `out/` are gitignored. The briefs, the taxonomy and the
approved deck are not: those are the parts worth reviewing in a pull request.

## The four steps

```sh
node generate.js --concept cbt-basics --count 20   # Sonnet writes
node review.js --concept cbt-basics                # rules, then a critic pass
open out/review/cbt-basics.html                    # you read
node approve.js --concept cbt-basics --by "Your Name"
node upload.js --dry-run                           # then without --dry-run
```

Do one concept end to end before doing thirty. The first batch is where you
find out whether `prompt.md` is asking for the right thing, and fixing the
brief is much cheaper than fixing four hundred cards.

### 1. Generate

```sh
node generate.js --dry-run                    # what it would write, and how much
node generate.js --concept dbt-basics         # one concept to its target
node generate.js                              # the whole taxonomy, about 1000
```

Writes to `out/raw/<concept>.json`, appending after every batch, so an
interrupted run picks up where it stopped rather than starting again. Each
batch is shown the prompts that already exist for its concept so it does not
rewrite the same card in different words, and anything that comes back as a
near duplicate is dropped before it is saved.

What gets written is set by `taxonomy.json`: the concepts, how many cards
each should have, and the mix of kinds. About a third of every concept is
`both` cards, which have no right answer. That ratio is deliberate. A deck of
mostly right-answer cards teaches that therapy has right answers, which is
not true and leaves someone worse off than before they played.

`brief` in the taxonomy is the scope handed to the model. A vague brief is
how a concept ends up with forty cards that are all the same card, so keep it
narrow and concrete.

### 2. Review

```sh
node review.js --rules-only     # free, no API calls, catches most of it
node review.js                  # rules, then the critic pass
```

Pass one is `rules.js`, which is deterministic: shape, length caps, verdict
counts, and the content rules that are not negotiable (nothing that asks the
player about themselves, nothing that scores their coping, no methods, no
medication, no clinical roleplay, no em dashes). A card that trips one of
those is dropped outright and is never offered a rewrite, because those are
not matters of taste.

Pass two gives each surviving card to Sonnet along with the guide it claims
to teach from, using `critic.md`. It returns keep, fix or drop. A fix is run
back through the rules and a second failure is a drop.

Rejections land in `out/rejected/` with the reason. Read a few before your
next run. They are the fastest way to work out what `prompt.md` is getting
wrong. It is usually better to edit the brief than to argue with the
output.

### 3. Read them yourself

```sh
open out/review/<concept>.html
```

One page per concept, one card per row, both option notes visible. Read for
the four things the machine cannot check:

- a claim that is subtly untrue (the worst thing this feature can produce,
  because it will be believed)
- an option nobody would ever pick, which makes the card teach nothing
- a note that talks down to whoever picked the other option
- anything that sounds like an app rather than a person

Cards outlined in orange are sensitive. Read those individually. Everything
else can honestly be read in batches of a concept at a time.

### 4. Approve, then publish

```sh
node approve.js --concept cbt-basics --by "Your Name"
node approve.js --card <id> --by "Your Name"     # sensitive cards, one at a time
```

Approving moves cards into `deck/`, sets `status: published` and writes your
name into `reviewed_by`. `--concept` and `--all` deliberately skip sensitive
cards; each of those has to be named. `upload.js` refuses to publish a draft,
so nothing you have not signed off can reach anybody.

```sh
node upload.js --dry-run     # prints the keys and the invalidation path
node upload.js               # asks before it writes anything live
```

Cards go to the site bucket under `practice-cards/`, served by the same
CloudFront distribution as the guides. This is independent of any code
deploy: you can fix a card at four in the afternoon without shipping the
frontend.

Set `CLOUDFRONT_DISTRIBUTION_ID` before uploading if you want the change
visible immediately. Without it the cards appear as the five minute cache
expires.

**One thing to know about the bucket.** Both frontend deploy paths run
`aws s3 sync build/ --delete`, and both carry an `--exclude "practice-cards/*"`
so the deck survives. If that exclude ever disappears, the next frontend
deploy silently deletes every card. It is in
`.github/workflows/deploy-frontend.yml` and `frontend/scripts/deploy.js`.

## Working locally

```sh
node upload.js --local     # writes to frontend/public/practice-cards/
```

`npm start` in `frontend/` does this for you. `--local` includes drafts, so
you can look at cards before approving them. `npm run build` does not, which
is right: production reads cards from the bucket, not from a build.

## What it costs

Sonnet, ten cards a batch, plus one critic call per surviving card. In the
region of a few dollars for a thousand cards. Two things worth knowing:

- `--rules-only` is free. Run it first every time. It catches shape and
  content problems without spending anything.
- For a run of several hundred or more, the Batch API is half price and this
  is exactly the kind of work it is for: no latency pressure at all. It is
  not wired up here because a resumable sequential run is easier to watch and
  easier to stop. If you are regenerating the whole deck regularly, it is
  worth adding.

## Growing past the guides

Nine concepts in `taxonomy.json` have `"guide": null`: ACT, grounding, panic,
sleep, boundaries, self-compassion, and a few others. Their cards ship
without a "more in the guide" link, and the generator is told to stay on well
established ground because it has no guide to teach from.

That list is a content backlog. Write the guide in `resources/`, set the slug
in the taxonomy, and every card on that concept gains a link with no
regeneration. That is the direction the feature is supposed to pull: the game
is an index into the guides, not a replacement for them.

## If you change the card shape

`rules.js` is the contract, and it is the only place the caps and the content
rules live. The browser does its own much smaller check in
`frontend/src/utils/deck.js`: required fields and verdict counts, enough to
drop a card rather than render half of one. It deliberately does not repeat
the length caps.

If you widen what a card may contain, widen `prompt.md` and `critic.md` in
the same commit, or the generator will keep writing to the old shape and the
critic will keep rejecting the new one.
