import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const CONTENT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../content');
export const MESSAGE_LIMIT = 2000;
const SPLIT = /^<!-- split -->$/m;

export function readContent(file) {
  return readFileSync(path.join(CONTENT_DIR, file), 'utf8').trim();
}

// Replace {#channelKey} and {@roleKey} with real Discord mentions.
// ctx = { channels: { key: id }, roles: { key: id } }
export function render(text, ctx) {
  return text
    .replace(/\{#(\w+)\}/g, (m, key) => {
      const id = ctx.channels[key];
      if (!id) throw new Error(`Unknown channel placeholder ${m}`);
      return `<#${id}>`;
    })
    .replace(/\{@(\w+)\}/g, (m, key) => {
      const id = ctx.roles[key];
      if (!id) throw new Error(`Unknown role placeholder ${m}`);
      return `<@&${id}>`;
    });
}

// A content file becomes one or more Discord messages, split on <!-- split -->.
export function renderMessages(file, ctx) {
  const parts = render(readContent(file), ctx)
    .split(SPLIT)
    .map((p) => p.trim())
    .filter(Boolean);
  for (const [i, p] of parts.entries()) {
    if (p.length > MESSAGE_LIMIT) {
      throw new Error(`${file} part ${i + 1} is ${p.length} chars (limit ${MESSAGE_LIMIT}). Add a <!-- split -->.`);
    }
  }
  return parts;
}

// Library files hold many forum posts: each starts with "# Title", then an
// optional "tags: A, B" line, then the body.
export function parseLibrary(file, ctx) {
  const text = render(readContent(file), ctx);
  const posts = [];
  for (const chunk of text.split(/^# /m).slice(1)) {
    const lines = chunk.split('\n');
    const title = lines.shift().trim();
    let tags = [];
    if (/^tags:/i.test(lines[0] ?? '')) {
      tags = lines
        .shift()
        .replace(/^tags:/i, '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    }
    const body = lines.join('\n').trim();
    if (title.length > 100) throw new Error(`${file}: post title too long: "${title}"`);
    if (body.length > MESSAGE_LIMIT) throw new Error(`${file}: "${title}" is ${body.length} chars (limit ${MESSAGE_LIMIT})`);
    posts.push({ title, tags, body });
  }
  return posts;
}

export function hash(text) {
  return createHash('sha1').update(text).digest('hex').slice(0, 12);
}
