#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USER_STATE_FILE = path.join(__dirname, '../../public/env-user-state.json');

const envId = (process.env.ENV_ID ?? '').trim().toLowerCase();
const action = (process.env.ENV_ACTION ?? '').trim().toLowerCase();
const user = (process.env.ENV_USER ?? 'unknown').trim() || 'unknown';
const notes = (process.env.ENV_NOTES ?? '').trim();
const branchOrRepo = (process.env.ENV_BRANCH_OR_REPO ?? '').trim();

const allowedIds = new Set(['qa1', 'qa2', 'qa3', 'qa4', 'qa5', 'uat1', 'uat2']);
const allowedActions = new Set(['free', 'occupied']);

if (!allowedIds.has(envId)) {
  throw new Error(`Unsupported envId '${envId}'.`);
}
if (!allowedActions.has(action)) {
  throw new Error(`Unsupported action '${action}'.`);
}

function loadState() {
  try {
    if (!fs.existsSync(USER_STATE_FILE)) return {};
    const raw = fs.readFileSync(USER_STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch {
    return {};
  }
}

const now = new Date().toISOString();
const state = loadState();

if (action === 'free') {
  state[envId] = {
    status: 'free',
    freedAt: now,
    freedBy: user,
    notes,
    branchOrRepo: '',
    lockedBy: '',
  };
} else {
  state[envId] = {
    status: 'occupied',
    freedAt: null,
    freedBy: user,
    notes,
    branchOrRepo,
    lockedBy: user,
  };
}

fs.mkdirSync(path.dirname(USER_STATE_FILE), { recursive: true });
fs.writeFileSync(USER_STATE_FILE, JSON.stringify(state, null, 2));

console.log(`Updated ${envId} -> ${action}`);
