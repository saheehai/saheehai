#!/usr/bin/env node
/**
 * Manual / emergency deploy.
 *
 * Normal deploys go through GitHub Actions on merge to main (see
 * DEPLOYMENT.md). Use this only when Actions is unavailable, and follow it
 * with a real commit — a manual deploy makes the live site diverge from main.
 *
 * Configuration comes from the environment. An earlier version of this script
 * read the bucket name out of a `saheeh-ai-stack` CloudFormation stack, which
 * no longer describes the live infrastructure.
 *
 *   S3_BUCKET                  target bucket            (default: saheeh.ai)
 *   CLOUDFRONT_DISTRIBUTION_ID distribution to invalidate (optional)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BUCKET = process.env.S3_BUCKET || 'saheeh.ai';
const DISTRIBUTION_ID = process.env.CLOUDFRONT_DISTRIBUTION_ID;
const buildDir = path.join(__dirname, '..', 'build');

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

const fail = (msg, ...details) => {
  console.error(`\n❌ ${msg}`);
  details.forEach((d) => console.error(`   ${d}`));
  process.exit(1);
};

try {
  execSync('aws --version', { stdio: 'ignore' });
} catch {
  fail('AWS CLI is not installed.', 'Visit: https://aws.amazon.com/cli/');
}

if (!fs.existsSync(buildDir)) {
  fail('Build directory not found.', 'Run "npm run build" first.');
}

// A build produced without REACT_APP_API_ENDPOINT will not be able to reach
// the API. Catch that here rather than after it is live.
const bundleDir = path.join(buildDir, 'static', 'js');
if (fs.existsSync(bundleDir)) {
  const bundles = fs
    .readdirSync(bundleDir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => fs.readFileSync(path.join(bundleDir, f), 'utf8'));
  if (!bundles.some((b) => b.includes('execute-api') || b.includes('localhost'))) {
    fail(
      'No API endpoint found in the built bundle.',
      'Rebuild with REACT_APP_API_ENDPOINT set:',
      'REACT_APP_API_ENDPOINT=<endpoint> npm run build'
    );
  }
}

console.log(`🚀 Deploying to s3://${BUCKET}\n`);

try {
  // Hashed assets first, cached forever. HTML must land last so it never
  // references an asset that has not been uploaded yet. Mirrors the steps
  // in .github/workflows/deploy-frontend.yml.
  console.log('📤 Uploading hashed assets...');
  run(
    `aws s3 sync "${buildDir}" "s3://${BUCKET}" --delete ` +
      '--cache-control "public,max-age=31536000,immutable" ' +
      '--exclude "index.html" --exclude "__pages/*" --exclude "news/*" ' +
      // practice-cards/ is published by tools/practice/upload.js and is not
      // part of a build. Without this exclude, --delete wipes the whole deck
      // on every frontend deploy.
      '--exclude "resources/*" --exclude "practice-cards/*" ' +
      '--exclude "sitemap.xml" --exclude "robots.txt" --exclude "*.map"'
  );

  console.log('\n📤 Uploading news, resources, sitemap and robots...');
  for (const folder of ['news', 'resources']) {
    run(
      `aws s3 sync "${path.join(buildDir, folder)}" "s3://${BUCKET}/${folder}/" --delete ` +
        '--exclude "*" --include "*.json" ' +
        '--cache-control "public,max-age=300,must-revalidate" --content-type "application/json"'
    );
  }
  run(
    `aws s3 cp "${path.join(buildDir, 'sitemap.xml')}" "s3://${BUCKET}/sitemap.xml" ` +
      '--cache-control "public,max-age=3600" --content-type "application/xml"'
  );
  run(
    `aws s3 cp "${path.join(buildDir, 'robots.txt')}" "s3://${BUCKET}/robots.txt" ` +
      '--cache-control "public,max-age=3600" --content-type "text/plain"'
  );

  console.log('\n📤 Uploading per-route HTML...');
  const pagesDir = path.join(buildDir, '__pages');
  for (const name of fs.readdirSync(pagesDir)) {
    const key = name.split('__').join('/');
    run(
      `aws s3 cp "${path.join(pagesDir, name)}" "s3://${BUCKET}/${key}" ` +
        '--cache-control "no-cache,no-store,must-revalidate" --content-type "text/html"'
    );
  }

  console.log('\n📤 Uploading index.html...');
  run(
    `aws s3 cp "${path.join(buildDir, 'index.html')}" "s3://${BUCKET}/index.html" ` +
      '--cache-control "no-cache,no-store,must-revalidate" --content-type "text/html"'
  );

  if (DISTRIBUTION_ID) {
    console.log('\n🔄 Invalidating CloudFront...');
    run(
      `aws cloudfront create-invalidation --distribution-id "${DISTRIBUTION_ID}" --paths "/*"`
    );
  } else {
    console.log(
      '\n⚠️  CLOUDFRONT_DISTRIBUTION_ID not set — skipping invalidation.' +
        '\n   Visitors may see the cached build until it expires.'
    );
  }

  console.log('\n✅ Deployment complete.');
} catch (error) {
  fail(`Deployment failed: ${error.message}`);
}
