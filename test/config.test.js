import test from 'node:test';
import assert from 'node:assert/strict';
import { PermissionFlagsBits } from 'discord.js';
import { fakeContext, validate } from '../src/provision/validate.js';
import { buildOverwrites } from '../src/lib/layout.js';
import { categories, onboarding } from '../src/config/server.js';
import { parseLibrary, renderMessages } from '../src/lib/content.js';

test('config and all content pass Discord limits', () => {
  assert.doesNotThrow(() => validate());
});

test('the five core channels exist and members can post in them', () => {
  const channels = categories.flatMap((c) => c.channels);
  for (const name of ['help-me-close-this', 'objection-clinic', 'lost-deals', 'wins', 'scoreboard']) {
    const ch = channels.find((c) => c.name === name);
    assert.ok(ch, `${name} missing`);
    assert.equal(ch.access, 'open');
  }
});

test('the Sales Floor comes straight after Start Here', () => {
  assert.deepEqual(categories.slice(0, 2).map((c) => c.name), ['START HERE', 'THE SALES FLOOR']);
});

test('thread-based channels are forums', () => {
  const channels = categories.flatMap((c) => c.channels);
  for (const name of ['help-me-close-this', 'objection-clinic', 'lost-deals', 'review-my-pitch']) {
    assert.equal(channels.find((c) => c.name === name).type, 'forum');
  }
});

test('readonly channels block member posting but let staff post', () => {
  const ids = { everyone: 'e', founder: 'f', coach: 'c', privateCoaching: 'p' };
  const ow = buildOverwrites('readonly', 'text', ids);
  const everyone = ow.find((o) => o.id === 'e');
  const coach = ow.find((o) => o.id === 'c');
  assert.ok(everyone.deny & PermissionFlagsBits.SendMessages);
  assert.ok(coach.allow & PermissionFlagsBits.SendMessages);
});

test('private coaching is hidden from everyone except staff and clients', () => {
  const ids = { everyone: 'e', founder: 'f', coach: 'c', privateCoaching: 'p' };
  const ow = buildOverwrites('private', 'category', ids);
  assert.ok(ow.find((o) => o.id === 'e').deny & PermissionFlagsBits.ViewChannel);
  assert.ok(ow.find((o) => o.id === 'p').allow & PermissionFlagsBits.ViewChannel);
});

test('placeholders render as real mentions', () => {
  const ctx = fakeContext();
  const [first] = renderMessages('start-here.md', ctx);
  assert.match(first, new RegExp(`<#${ctx.channels.introductions}>`));
  assert.doesNotMatch(first, /\{#/);
});

test('objection playbook covers every objection in the brief', () => {
  const titles = parseLibrary('playbook/objections.md', fakeContext()).map((p) => p.title.toLowerCase());
  for (const o of ['too expensive', 'cheaper quote', 'think about it', 'partner', 'email me the quote', 'three quotes', 'not interested', 'call you', 'cheaper?']) {
    assert.ok(titles.some((t) => t.includes(o)), `missing objection: ${o}`);
  }
});

test('onboarding default channels are all real', () => {
  const keys = new Set(categories.flatMap((c) => c.channels.map((ch) => ch.key)));
  for (const k of onboarding.defaultChannels) assert.ok(keys.has(k), k);
});
