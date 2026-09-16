---
title: Saheeh AI is back online
date: 2026-09-16
summary: The site is up again with accounts, a private journal, and a chat that is much harder to misuse. Here is what changed and what we are working on next.
---

We took the site down for a while after someone found a way to misuse the
chat. It is back, and it came back different.

## What changed

**Accounts.** Everyone now signs in with an email and password. Your journal
is tied to your account and nobody else can read it, not even by guessing.

**A chat that keeps its own memory.** The assistant's side of a conversation
is now stored on our side rather than sent up from the browser, so it can no
longer be rewritten by whoever is talking to it.

**Fair limits.** Each account has a daily allowance, enforced where it counts.

**Everything ships from GitHub.** The whole site, front and back, now lives in
[one public repository](https://github.com/saheehai/saheehai) and deploys on
merge. If you are curious how it is put together, it is all there.

## What we are working on

- Email that reaches you: confirmation and reset emails currently come from a
  default sender that is easy to miss. That is next.
- This news section, so you can see what is changing without reading commits.

If something looks wrong, or you have an idea, open an issue on the
repository. We read them.
