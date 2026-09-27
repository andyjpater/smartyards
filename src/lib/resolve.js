import { roles } from '../config/server.js';
import { allChannels, CHANNEL_TYPES } from './layout.js';

// Map config keys -> live Discord objects. Prefer IDs remembered in state
// (survives renames), fall back to matching by name.
export function findRole(guild, key, state = {}) {
  const def = roles.find((r) => r.key === key);
  const id = state.roles?.[key];
  return (id && guild.roles.cache.get(id)) || guild.roles.cache.find((r) => r.name === def.name) || null;
}

export function findChannel(guild, key, state = {}) {
  const def = allChannels().find((c) => c.key === key);
  const id = state.channels?.[key];
  const byId = id && guild.channels.cache.get(id);
  if (byId) return byId;
  return (
    guild.channels.cache.find(
      (c) => c.name === def.name && c.type === CHANNEL_TYPES[def.type] && c.parent?.name === def.category.name,
    ) ||
    guild.channels.cache.find((c) => c.name === def.name && c.type === CHANNEL_TYPES[def.type]) ||
    null
  );
}

// Context used to render {#channel} / {@role} placeholders in content.
export function buildContext(guild, state = {}) {
  const ctx = { channels: {}, roles: {} };
  for (const def of allChannels()) {
    const ch = findChannel(guild, def.key, state);
    if (ch) ctx.channels[def.key] = ch.id;
  }
  for (const def of roles) {
    const role = findRole(guild, def.key, state);
    if (role) ctx.roles[def.key] = role.id;
  }
  return ctx;
}
