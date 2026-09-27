import { ChannelType, OverwriteType, PermissionFlagsBits } from 'discord.js';
import { accessPresets, categories, roles } from '../config/server.js';

export const CHANNEL_TYPES = {
  text: ChannelType.GuildText,
  forum: ChannelType.GuildForum,
  voice: ChannelType.GuildVoice,
};

export const STAFF_ROLE_KEYS = ['founder', 'coach'];

export function allChannels() {
  return categories.flatMap((cat) => cat.channels.map((ch) => ({ ...ch, category: cat })));
}

export function roleByKey(key) {
  const role = roles.find((r) => r.key === key);
  if (!role) throw new Error(`Unknown role key "${key}"`);
  return role;
}

export function bits(names) {
  return names.reduce((acc, name) => {
    const bit = PermissionFlagsBits[name];
    if (bit === undefined) throw new Error(`Unknown permission "${name}"`);
    return acc | bit;
  }, 0n);
}

// Voice-only perms can't be set on text/forum channels and vice versa.
const VOICE_ONLY = ['Connect', 'Speak', 'Stream', 'UseVAD', 'PrioritySpeaker', 'MuteMembers', 'DeafenMembers', 'MoveMembers'];
const TEXT_ONLY = ['SendMessagesInThreads', 'CreatePublicThreads', 'CreatePrivateThreads'];

function filterFor(type, names) {
  if (type === 'voice') return names.filter((n) => !TEXT_ONLY.includes(n));
  if (type === 'category') return names;
  return names.filter((n) => !VOICE_ONLY.includes(n));
}

// Build permission overwrites for a channel/category from its access preset.
// roleIds = { everyone: id, founder: id, coach: id, privateCoaching: id, ... }
export function buildOverwrites(access, type, roleIds) {
  const preset = accessPresets[access];
  if (!preset) throw new Error(`Unknown access preset "${access}"`);
  const out = [];
  const push = (id, rule) => {
    const allow = filterFor(type, rule.allow);
    const deny = filterFor(type, rule.deny);
    if (allow.length || deny.length) out.push({ id, type: OverwriteType.Role, allow: bits(allow), deny: bits(deny) });
  };
  push(roleIds.everyone, preset.everyone);
  for (const key of STAFF_ROLE_KEYS) push(roleIds[key], preset.staff);
  for (const [key, rule] of Object.entries(preset.extraRoles ?? {})) push(roleIds[key], rule);
  return out;
}
