/**
 * The bit of Anthropic SDK setup that generate.js and review.js share.
 *
 * Sonnet writes the cards and a second Sonnet pass checks them. Sonnet is a
 * deliberate choice rather than a cost saving: this is high volume, and the
 * thing that makes a card safe is the rules in rules.js plus a person
 * reading it, not the size of the model that drafted it.
 */

const fs = require('fs');
const path = require('path');

const MODEL = 'claude-sonnet-5';

let Anthropic;
try {
  Anthropic = require('@anthropic-ai/sdk');
} catch {
  console.error(
    '\nThe Anthropic SDK is not installed.\n' +
      '  cd tools/practice && npm install\n'
  );
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    '\nANTHROPIC_API_KEY is not set. Get a key from console.anthropic.com and\n' +
      'export it, or run `ant auth login` if you use the Anthropic CLI.\n'
  );
  process.exit(1);
}

const client = new Anthropic();

const brief = (name) => fs.readFileSync(path.join(__dirname, name), 'utf8');

/**
 * One request, streamed.
 *
 * Streaming rather than a plain create because these responses are long and
 * a non-streaming request with a high max_tokens can hit the HTTP timeout.
 * Adaptive thinking, because a card that weighs two defensible answers is
 * exactly the kind of thing worth thinking about first.
 */
async function ask({ system, user, schema, maxTokens = 16000, effort = 'high' }) {
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    output_config: {
      effort,
      format: { type: 'json_schema', schema },
    },
    system,
    messages: [{ role: 'user', content: user }],
  });

  const message = await stream.finalMessage();

  if (message.stop_reason === 'refusal') {
    const why = message.stop_details ? message.stop_details.category : 'unknown';
    throw new Error(`the model declined this request (${why})`);
  }

  const text = message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');

  try {
    return { data: JSON.parse(text), usage: message.usage };
  } catch {
    throw new Error('the model did not return usable JSON');
  }
}

/** Runs `worker` over `items`, a few at a time, in order. */
async function inBatches(items, size, worker) {
  const results = [];
  for (let i = 0; i < items.length; i += size) {
    const slice = items.slice(i, i + size);
    results.push(...(await Promise.all(slice.map(worker))));
  }
  return results;
}

/** Retries the transient failures and nothing else. */
async function withRetries(label, fn, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = err && err.status;
      const worthRetrying = !status || status === 429 || status >= 500;
      if (!worthRetrying || attempt === attempts) break;
      const wait = 2 ** attempt * 1000;
      console.log(`  ${label}: ${err.message}. Retrying in ${wait / 1000}s`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  throw lastError;
}

module.exports = { MODEL, ask, brief, inBatches, withRetries };
