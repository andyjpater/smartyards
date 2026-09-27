import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ChannelType, PermissionFlagsBits } from 'discord.js';
import { createFakeGuild } from './fake-guild.js';

const dir = mkdtempSync(path.join(tmpdir(), 'shms-'));
process.env.SHMS_DATA_DIR = dir;
const { provision } = await import('../src/provision/index.js');
const { categories, roles, automod } = await import('../src/config/server.js');

test('provisions an empty server, then re-runs without duplicating anything', async (t) => {
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const guild = createFakeGuild();
  const quiet = t.mock.method(console, 'log', () => {});

  const state = await provision(guild);

  // Roles, stacked under the bot in config order.
  const created = roles.map((r) => guild.roles.cache.get(state.roles[r.key]));
  assert.deepEqual(created.map((r) => r.name), roles.map((r) => r.name));
  const positions = created.map((r) => r.position);
  assert.deepEqual(positions, [...positions].sort((a, b) => b - a));
  assert.ok(positions[0] < guild.members.me.roles.highest.position);
  assert.ok(!(guild.roles.everyone.permissions & PermissionFlagsBits.CreateInstantInvite));

  // Every channel exists with the right type and parent.
  for (const cat of categories) {
    const category = guild.channels.cache.get(state.categories[cat.key]);
    assert.equal(category.type, ChannelType.GuildCategory);
    for (const def of cat.channels) {
      const ch = guild.channels.cache.get(state.channels[def.key]);
      assert.ok(ch, `${def.name} missing`);
      assert.equal(ch.parentId, category.id, `${def.name} in wrong category`);
    }
  }

  // Community on, rules + updates channels set, forums have tags and guidelines.
  assert.ok(guild.features.includes('COMMUNITY'));
  assert.equal(guild.settings.rulesChannel, state.channels.welcome);
  const forum = guild.channels.cache.get(state.channels.helpMeCloseThis);
  assert.ok(forum.availableTags.length >= 5);
  assert.match(forum.topic, /Approximate deal value/);
  assert.doesNotMatch(forum.topic, /\{#/);

  // Pinned, locked guide post in each member forum; library posts in playbook forums.
  const guide = guild.channels.cache.get(Object.values(state.forumPosts.helpMeCloseThis)[0].id);
  assert.ok(guide.pinnedFlag && guide.locked);
  assert.ok(Object.keys(state.forumPosts.objectionPlaybook).length >= 9);
  const scripts = Object.values(state.forumPosts.scriptsAndTemplates).map((p) => guild.channels.cache.get(p.id));
  assert.ok(scripts.every((s) => s.appliedTags.length > 0), 'every script is tagged');

  // Rules message pinned in #welcome.
  const welcome = guild.channels.cache.get(state.channels.welcome);
  const pinned = [...welcome.messages.cache.values()].filter((m) => m.pinned);
  assert.equal(pinned.length, 1);
  assert.match(pinned[0].content, /THE RULES/);

  // AutoMod + onboarding.
  const rules = await guild.autoModerationRules.fetch();
  assert.equal(rules.size, automod.length);
  assert.ok(guild.onboarding.enabled);
  assert.ok(guild.onboarding.defaultChannels.every((cid) => guild.channels.cache.has(cid)));
  assert.ok(guild.onboarding.prompts[0].options.every((o) => o.roles.every(Boolean)));

  // Second run: nothing new created, nothing re-sent.
  const before = guild.log.length;
  await provision(guild);
  const creates = guild.log.slice(before).filter(([op]) => /create|send/.test(op));
  assert.deepEqual(creates, []);
  quiet.mock.restore();
});
