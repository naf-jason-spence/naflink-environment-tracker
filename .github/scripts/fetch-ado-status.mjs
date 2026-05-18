#!/usr/bin/env node
/**
 * Fetches the latest build from Azure DevOps and writes docs/ado-status.json.
 * Called by the GitHub Actions deploy workflow after `ng build`.
 *
 * Required environment variables (set in the workflow):
 *   ADO_PAT           – Personal Access Token  (Build: read scope)
 *   ADO_ORG           – ADO organization name  (e.g. NAF-Tech)
 *   ADO_PROJECT       – ADO project name       (e.g. LenderLink.Web)
 *   ADO_PIPELINE_NAME – Build pipeline name    (e.g. naflink-web-release-pipeline)
 */

import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT     = path.join(__dirname, '../../docs/ado-status.json');

const { ADO_PAT, ADO_ORG, ADO_PROJECT, ADO_PIPELINE_NAME } = process.env;

// Always write a fallback file first so GitHub Pages never serves a 404.
// The real data overwrites this on success.
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify({ generatedAt: null, latestBuild: null }, null, 2));

if (!ADO_PAT || !ADO_ORG || !ADO_PROJECT || !ADO_PIPELINE_NAME) {
  const missing = ['ADO_PAT', 'ADO_ORG', 'ADO_PROJECT', 'ADO_PIPELINE_NAME']
    .filter(k => !process.env[k]);
  console.error('Missing required env vars:', missing.join(', '));
  fs.writeFileSync(OUTPUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    latestBuild: null,
    fetchError: `Missing env vars: ${missing.join(', ')}`,
  }, null, 2));
  process.exit(1);
}

const encodedProject = encodeURIComponent(ADO_PROJECT);
const auth = `Basic ${Buffer.from(`:${ADO_PAT}`).toString('base64')}`;

// ── HTTP helper ───────────────────────────────────────────────────────────────
function get(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Authorization: auth, Accept: 'application/json' } }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`HTTP ${res.statusCode} from ${url}`));
        return;
      }
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`Bad JSON from ${url}: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Find the build definition by name
  const defsUrl =
    `https://dev.azure.com/${ADO_ORG}/${encodedProject}` +
    `/_apis/build/definitions?name=${encodeURIComponent(ADO_PIPELINE_NAME)}&api-version=7.1`;

  const defs = await get(defsUrl);

  if (!defs.value?.length) {
    throw new Error(`No build definition named '${ADO_PIPELINE_NAME}' found in ${ADO_ORG}/${ADO_PROJECT}`);
  }

  const def = defs.value[0];
  console.log(`Found definition: ${def.name} (id=${def.id})`);

  // 2. Get the latest build run
  const buildsUrl =
    `https://dev.azure.com/${ADO_ORG}/${encodedProject}` +
    `/_apis/build/builds?definitions=${def.id}&$top=1&api-version=7.1`;

  const builds = await get(buildsUrl);
  const build  = builds.value?.[0] ?? null;

  // 3. Write the status file
  const status = {
    generatedAt: new Date().toISOString(),
    latestBuild: build ? {
      buildId:        build.id,
      buildNumber:    build.buildNumber,
      sourceBranch:   (build.sourceBranch ?? '').replace(/^refs\/heads\//, ''),
      commitSha:      build.sourceVersion ?? '',
      status:         build.status  ?? 'none',
      result:         build.result  ?? 'none',
      requestedFor:   build.requestedFor?.displayName ?? '',
      startTime:      build.startTime  ?? null,
      finishTime:     build.finishTime ?? null,
      definitionName: build.definition?.name ?? ADO_PIPELINE_NAME,
    } : null,
  };

  fs.writeFileSync(OUTPUT, JSON.stringify(status, null, 2));
  console.log(`Written ${OUTPUT} — build ${build?.buildNumber ?? '(none)'}`);
}

main().catch(err => {
  console.error('fetch-ado-status failed:', err.message);
  // Write the error into the JSON so it's visible at the URL without needing workflow logs.
  fs.writeFileSync(OUTPUT, JSON.stringify({ generatedAt: new Date().toISOString(), latestBuild: null, fetchError: err.message }, null, 2));
  process.exit(1);
});
