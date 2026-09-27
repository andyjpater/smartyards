import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Remembers Discord IDs of things we created (messages, forum posts, reminders
// already sent) so re-running edits in place instead of duplicating.
const DEFAULT_DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../data');
const dataDir = () => process.env.SHMS_DATA_DIR || DEFAULT_DATA_DIR;

export function loadState(guildId) {
  try {
    return JSON.parse(readFileSync(path.join(dataDir(), `${guildId}.json`), 'utf8'));
  } catch {
    return {};
  }
}

export function saveState(guildId, state) {
  mkdirSync(dataDir(), { recursive: true });
  writeFileSync(path.join(dataDir(), `${guildId}.json`), JSON.stringify(state, null, 2));
}
