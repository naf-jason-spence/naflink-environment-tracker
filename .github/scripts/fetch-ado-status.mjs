#!/usr/bin/env node
/**
 * Fetches ADO environment deployment records and writes docs/env-state.json.
 * Called by the GitHub Actions deploy workflow after `ng build`.
 *
 * Required environment variables (set in the workflow):
 *   ADO_PAT           – Personal Access Token (Build: read + Environment: read)
 *   ADO_ORG           – ADO organization name (e.g. NAF-Tech)
 *   ADO_PROJECT       – ADO project name      (e.g. LenderLink.Web)
 *   ADO_PIPELINE_NAME – Release pipeline name (e.g. naflink-web-release-pipeline)
 *
 * Per-environment branch data comes from the ADO Environments Deployment Records
 * API (_apis/distributedtask/environments). This is accurate for YAML pipelines
 * that declare `environment:` on each deployment job (QA, QA2 … UAT2).
 */

import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT     = path.join(__dirname, '../../docs/env-state.json');
const USER_STATE_INPUT = path.join(__dirname, '../../public/env-user-state.json');

const ADO_PAT = process.env.ADO_PAT;
const ADO_ORG = process.env.ADO_ORG ?? 'NAF-Tech';
const ADO_PROJECT = process.env.ADO_PROJECT ?? 'LenderLink.Web';
const ADO_PIPELINE_NAME = process.env.ADO_PIPELINE_NAME ?? 'naflink-web-release-pipeline';

function loadUserState() {
  try {
    if (!fs.existsSync(USER_STATE_INPUT)) return {};
    const raw = fs.readFileSync(USER_STATE_INPUT, 'utf8');
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch {
    return {};
  }
}

// Always write a fallback file first so GitHub Pages never serves a 404.
// The real data overwrites this on success.
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify({
  generatedAt: new Date().toISOString(),
  latestBuild: null,
  userState: loadUserState(),
}, null, 2));

if (!ADO_PAT) {
  const missing = ['ADO_PAT'];
  console.error('Missing required env vars:', missing.join(', '));
  fs.writeFileSync(OUTPUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    latestBuild: null,
    userState: loadUserState(),
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

  // 2. Get the latest build run (for the summary badge)
  const buildsUrl =
    `https://dev.azure.com/${ADO_ORG}/${encodedProject}` +
    `/_apis/build/builds?definitions=${def.id}&$top=1&api-version=7.1`;

  const builds = await get(buildsUrl);
  const build  = builds.value?.[0] ?? null;

  // 3. Per-environment data via the ADO Environments Deployment Records API.
  //    The YAML pipeline declares `environment: 'QA3'` etc. on each deployment
  //    job, so ADO records every deployment against that named environment.
  //    Each record links to the build run → we fetch the build to get sourceBranch.
  const environments = {};

  try {
    // 3a. List all environments in the project
    const envsUrl =
      `https://dev.azure.com/${ADO_ORG}/${encodedProject}` +
      `/_apis/distributedtask/environments?api-version=7.1`;
    const envsData = await get(envsUrl);
    const envList  = envsData.value ?? [];

    console.log(`Found ${envList.length} ADO environments: ${envList.map(e => e.name).join(', ')}`);

    // Only fetch the environments our tracker cares about
    const trackedNames = new Set(['Dev', 'QA', 'QA2', 'QA3', 'QA4', 'QA5', 'UAT', 'UAT2', 'Staging']);
    const relevant = envList.filter(e => trackedNames.has(e.name));

    // 3b. Fetch the latest deployment record for each relevant environment.
    //     Fetch top=20 because skipped deployment jobs (e.g. QA3 is skipped for
    //     'develop' branch runs) create records with result='skipped'. We want
    //     the most recent record that was actually executed (not skipped/canceled).
    const SKIP_RESULTS = new Set(['skipped', 'canceled', 'abandoned']);
    const recordResults = await Promise.all(
      relevant.map(env =>
        get(
          `https://dev.azure.com/${ADO_ORG}/${encodedProject}` +
          `/_apis/distributedtask/environments/${env.id}/environmentdeploymentrecords` +
          `?top=20&api-version=7.1`,
        )
          .then(data => {
            const record = (data.value ?? []).find(r => !SKIP_RESULTS.has(r.result)) ?? null;
            return { env, record };
          })
          .catch(err => {
            console.warn(`Could not fetch records for '${env.name}': ${err.message}`);
            return { env, record: null };
          }),
      ),
    );

    // 3c. Collect unique build IDs so we can fetch sourceBranch in one batch
    const buildIds = [
      ...new Set(recordResults.filter(r => r.record?.owner?.id).map(r => r.record.owner.id)),
    ];
    console.log(`Fetching ${buildIds.length} unique builds for source branches…`);

    const buildMap = new Map();
    await Promise.all(
      buildIds.map(id =>
        get(
          `https://dev.azure.com/${ADO_ORG}/${encodedProject}` +
          `/_apis/build/builds/${id}?api-version=7.1`,
        )
          .then(b => buildMap.set(id, b))
          .catch(err => console.warn(`Could not fetch build ${id}: ${err.message}`)),
      ),
    );

    // 3d. Compose the environments output keyed by ADO environment name
    //     ('QA', 'QA2', 'QA3' …). The Angular service normalises these to match
    //     card names ('QA' → 'qa' matches env.name 'QA'; 'QA3' → 'qa3' matches 'QA3').
    for (const { env, record } of recordResults) {
      if (!record) continue;
      const buildData    = record.owner?.id ? buildMap.get(record.owner.id) : null;
      const sourceBranch = buildData
        ? (buildData.sourceBranch ?? '').replace(/^refs\/heads\//, '')
        : '';
      // requestedFor / finishedOn are often absent on env deployment records for
      // pipeline-triggered runs — fall back to the build record which always has them.
      const deployedBy = record.requestedFor?.displayName
        || buildData?.requestedFor?.displayName
        || '';
      const finishTime = record.finishedOn
        || buildData?.finishTime
        || null;
      environments[env.name] = {
        sourceBranch,
        deployedBy,
        status:      record.result ?? 'unknown',
        finishTime,
        buildNumber: record.owner?.name ?? '',
        releaseId:   record.owner?.id ?? null,
        releaseName: record.owner?.name ?? null,
      };
    }

    console.log(`Environment data collected for: ${Object.keys(environments).join(', ') || '(none)'}`);
  } catch (err) {
    console.warn('Could not fetch environment deployment records (non-fatal):', err.message);
  }

  // 4. Write the status file
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
    ...(Object.keys(environments).length > 0 && { environments }),
    userState: loadUserState(),
  };

  fs.writeFileSync(OUTPUT, JSON.stringify(status, null, 2));
  console.log(`Written ${OUTPUT} — build ${build?.buildNumber ?? '(none)'}`);
}

main().catch(err => {
  console.error('fetch-ado-status failed:', err.message);
  // Write the error into the JSON so it's visible at the URL without needing workflow logs.
  fs.writeFileSync(OUTPUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    latestBuild: null,
    userState: loadUserState(),
    fetchError: err.message
  }, null, 2));
  process.exit(1);
});
