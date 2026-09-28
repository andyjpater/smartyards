// A small in-memory stand-in for a discord.js Guild, just enough to run the
// provisioner end to end and check what it would do.
import { ChannelType, Collection } from 'discord.js';

let seq = 100;
const id = () => String(seq++);

export function createFakeGuild() {
  const log = [];
  const guild = { id: 'fake-guild', name: 'Empty server', features: [], log };

  const makeRole = (data) => {
    const role = {
      id: id(),
      position: 1,
      ...data,
      async edit(d) {
        Object.assign(role, d);
        return role;
      },
    };
    return role;
  };
  const everyone = makeRole({ name: '@everyone', position: 0 });
  everyone.id = guild.id;
  everyone.setPermissions = async (p) => (everyone.permissions = p);
  const botRole = makeRole({ name: 'SHMS Bot', position: 1 });
  const roleCache = new Collection([[everyone.id, everyone], [botRole.id, botRole]]);
  guild.roles = {
    cache: roleCache,
    everyone,
    async fetch() {},
    async create(data) {
      for (const r of roleCache.values()) if (r.position >= 1) r.position++;
      const role = makeRole({ ...data, position: 1 });
      roleCache.set(role.id, role);
      log.push(['role.create', data.name]);
      return role;
    },
    async setPositions(list) {
      for (const { role, position } of list) roleCache.get(role).position = position;
    },
  };
  guild.members = { me: { id: 'bot-user', roles: { get highest() { return botRole; } } } };

  const channelCache = new Collection();
  const makeMessage = (channel, content) => {
    const msg = {
      id: id(),
      content,
      author: { id: 'bot-user' },
      createdTimestamp: seq,
      pinned: false,
      url: `https://discord.com/channels/${guild.id}/${channel.id}/x`,
      async pin() { msg.pinned = true; },
      async unpin() { msg.pinned = false; },
      async edit(d) { msg.content = d.content; log.push(['message.edit', channel.name]); return msg; },
    };
    return msg;
  };
  const makeChannel = (data) => {
    const messages = new Collection();
    const { parent: _parent, ...fields } = data;
    const channel = {
      id: id(),
      guild,
      ...fields,
      parentId: data.parent ?? null,
      availableTags: [],
      get parent() { return channelCache.get(channel.parentId) ?? null; },
      async edit(d) {
        if ('type' in d) throw new Error('edit() must not change type');
        if (d.parent !== undefined) channel.parentId = d.parent;
        const { parent: _p, ...rest } = d;
        d = rest;
        if (d.availableTags) d = { ...d, availableTags: d.availableTags.map((t) => ({ ...t, id: t.id ?? id() })) };
        const { permissionOverwrites, ...plain } = d;
        if (permissionOverwrites) channel.overwrites = permissionOverwrites;
        Object.assign(channel, plain);
        return channel;
      },
      overwrites: fields.permissionOverwrites ?? [],
      permissionOverwrites: { async set(o) { channel.overwrites = o; } },
      async lockPermissions() {},
      async send(d) {
        const msg = makeMessage(channel, d.content);
        messages.set(msg.id, msg);
        log.push(['message.send', channel.name]);
        return msg;
      },
      messages: {
        cache: messages,
        async fetch(mid) {
          if (typeof mid === 'object') return new Collection(messages);
          if (!messages.has(mid)) throw new Error('Unknown Message');
          return messages.get(mid);
        },
        async delete(mid) { messages.delete(mid); },
      },
      threads: {
        async fetchActive() {
          return { threads: channelCache.filter((c) => c.parentId === channel.id && c.type === ChannelType.PublicThread) };
        },
        async fetchArchived() {
          return { threads: new Collection() };
        },
        async create(d) {
          if (channel.type !== ChannelType.GuildForum) throw new Error('not a forum');
          const thread = makeChannel({ name: d.name, type: ChannelType.PublicThread, parent: channel.id });
          const starter = makeMessage(thread, d.message.content);
          Object.assign(thread, {
            ownerId: 'bot-user',
            appliedTags: d.appliedTags,
            locked: false,
            archived: false,
            pinnedFlag: false,
            flags: { has: () => thread.pinnedFlag },
            async pin() { thread.pinnedFlag = true; },
            async setLocked(v) { thread.locked = v; },
            async setArchived(v) { thread.archived = v; },
            async setAppliedTags(t) { thread.appliedTags = t; },
            async fetchStarterMessage() { return starter; },
          });
          channelCache.set(thread.id, thread);
          log.push(['thread.create', channel.name, d.name]);
          return thread;
        },
      },
    };
    return channel;
  };
  guild.channels = {
    cache: channelCache,
    async create(data) {
      if (data.type === ChannelType.GuildForum && !guild.features.includes('COMMUNITY')) {
        throw new Error('Forum channels need Community enabled');
      }
      const ch = makeChannel(data);
      if (data.availableTags) ch.availableTags = data.availableTags.map((t) => ({ ...t, id: id() }));
      channelCache.set(ch.id, ch);
      log.push(['channel.create', data.name]);
      return ch;
    },
    async fetch(cid) {
      const ch = channelCache.get(cid);
      if (!ch) throw new Error('Unknown Channel');
      return ch;
    },
    async setPositions(list) {
      for (const { channel, position } of list) channelCache.get(channel).position = position;
    },
  };
  guild.edit = async (d) => {
    if (d.features) guild.features = d.features;
    Object.assign(guild, { settings: { ...guild.settings, ...d } });
    log.push(['guild.edit', Object.keys(d).join(',')]);
  };

  const rules = new Collection();
  guild.autoModerationRules = {
    async fetch() { return rules; },
    async create(d) {
      const rule = { id: id(), ...d, async edit(e) { Object.assign(rule, e); } };
      rules.set(rule.id, rule);
      log.push(['automod.create', d.name]);
      return rule;
    },
  };
  guild.editOnboarding = async (d) => {
    guild.onboarding = d;
    log.push(['onboarding']);
  };
  return guild;
}
