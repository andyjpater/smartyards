import test from 'node:test';
import assert from 'node:assert/strict';
import { PermissionFlagsBits } from 'discord.js';
import { createFakeGuild } from './fake-guild.js';
import { ensureClientRoom } from '../src/lib/clientRoom.js';
import { fakeContext } from '../src/provision/validate.js';

test('client room: private category per business, hidden from other members', async () => {
  const guild = createFakeGuild();
  const opts = { staffRoleIds: ['coach-id'], ctx: fakeContext(), reason: 'test' };

  const { role, category, created } = await ensureClientRoom(guild, 'Andy’s Tiling', opts);
  assert.equal(role.name, 'Client · Andy’s Tiling');
  assert.equal(category.name, 'ANDY’S TILING — PRIVATE');
  assert.deepEqual(created.map((c) => c.name), ['coaching-chat', 'pipeline', 'deal-review', 'numbers']);

  const everyone = category.overwrites.find((o) => o.id === guild.id);
  assert.ok(everyone.deny & PermissionFlagsBits.ViewChannel);
  const client = category.overwrites.find((o) => o.id === role.id);
  assert.ok(client.allow & PermissionFlagsBits.ViewChannel);
  assert.ok(created.every((c) => [...c.messages.cache.values()].some((m) => m.pinned)));

  const again = await ensureClientRoom(guild, 'Andy’s Tiling', opts);
  assert.equal(again.created.length, 0);
  assert.equal(again.category.id, category.id);

  const other = await ensureClientRoom(guild, 'Bec’s Electrical', opts);
  assert.notEqual(other.role.id, role.id);
});
