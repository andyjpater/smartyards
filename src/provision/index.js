// Builds/updates the whole Sell Heaps More Society server from src/config/server.js.
//   npm run plan       -> validate everything and print the layout (no Discord needed)
//   npm run provision  -> make the Discord server match the config (safe to re-run)
import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import {
  AutoModerationActionType,
  AutoModerationRuleEventType,
  AutoModerationRuleKeywordPresetType,
  AutoModerationRuleTriggerType,
  ChannelType,
  Client,
  ForumLayoutType,
  GatewayIntentBits,
  GuildDefaultMessageNotifications,
  GuildExplicitContentFilter,
  GuildOnboardingMode,
  GuildOnboardingPromptType,
  GuildSystemChannelFlags,
  GuildVerificationLevel,
  PermissionFlagsBits,
  SnowflakeUtil,
  SortOrderType,
  ThreadAutoArchiveDuration,
} from 'discord.js';
import {
  automod,
  categories,
  everyonePerms,
  onboarding,
  privateClients,
  roles,
  server,
} from '../config/server.js';
import { bits, buildOverwrites, CHANNEL_TYPES, STAFF_ROLE_KEYS } from '../lib/layout.js';
import { hash, parseLibrary, readContent, render, renderMessages } from '../lib/content.js';
import { buildContext, findChannel, findRole } from '../lib/resolve.js';
import { loadState, saveState } from '../lib/state.js';
import { ensureClientRoom } from '../lib/clientRoom.js';
import { printPlan, validate } from './validate.js';

const REASON = 'Sell Heaps More Society provisioning';
const log = (...a) => console.log('  ', ...a);
const step = (s) => console.log(`\n▶ ${s}`);

// ---------------------------------------------------------------------------
async function ensureRoles(guild, state) {
  step('Roles');
  await guild.roles.everyone.setPermissions(bits(everyonePerms), REASON);
  log('@everyone baseline permissions set (no invites, no @everyone pings)');

  const me = guild.members.me;
  for (const def of roles) {
    const data = {
      name: def.name,
      colors: { primaryColor: def.color },
      hoist: def.hoist,
      mentionable: def.mentionable,
      permissions: bits(def.perms),
    };
    let role = findRole(guild, def.key, state);
    if (!role) {
      role = await guild.roles.create({ ...data, reason: REASON });
      log(`+ created role ${def.name}`);
    } else if (role.position >= me.roles.highest.position) {
      log(`! role ${def.name} sits above the bot's role — drag the bot role to the top and re-run to update it`);
    } else {
      await role.edit({ ...data, reason: REASON });
      log(`~ updated role ${def.name}`);
    }
    state.roles[def.key] = role.id;
  }

  // Stack roles directly under the bot's own role, in config order.
  await guild.roles.fetch();
  const top = guild.members.me.roles.highest.position;
  const movable = roles
    .map((def) => guild.roles.cache.get(state.roles[def.key]))
    .filter((r) => r.position < top);
  await guild.roles.setPositions(movable.map((role, i) => ({ role: role.id, position: top - 1 - i })));
  log('role order set');
}

// ---------------------------------------------------------------------------
function channelData(def, type, parentId, roleIds) {
  const data = {
    name: def.name,
    type: CHANNEL_TYPES[def.type] ?? type,
    permissionOverwrites: buildOverwrites(def.access, def.type ?? 'category', roleIds),
  };
  if (parentId) data.parent = parentId;
  if (def.type === 'text') {
    data.topic = def.topic ?? null;
    data.rateLimitPerUser = def.slowmode ?? 0;
    data.defaultAutoArchiveDuration = ThreadAutoArchiveDuration.OneWeek;
  }
  if (def.type === 'forum') {
    data.defaultAutoArchiveDuration = ThreadAutoArchiveDuration.OneWeek;
    data.defaultForumLayout = ForumLayoutType.ListView;
    data.defaultSortOrder = def.posts ? SortOrderType.CreationDate : SortOrderType.LatestActivity;
  }
  return data;
}

// Forums need Community enabled first, so channels are built in two passes:
// { forums: false } before Community is switched on, { forums: true } after.
async function ensureChannels(guild, state, roleIds, { forums }) {
  step(forums ? 'Forum channels & ordering' : 'Categories & channels');
  const positions = [];
  for (const [ci, cat] of categories.entries()) {
    const catData = channelData(cat, ChannelType.GuildCategory, null, roleIds);
    let category =
      guild.channels.cache.get(state.categories[cat.key]) ||
      guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name === cat.name);
    if (!category) {
      category = await guild.channels.create({ ...catData, reason: REASON });
      log(`+ category ${cat.name}`);
    } else if (!forums) {
      const { type: _type, ...editable } = catData;
      await category.edit({ ...editable, reason: REASON });
    }
    state.categories[cat.key] = category.id;
    positions.push({ channel: category.id, position: ci });

    for (const [chi, def] of cat.channels.entries()) {
      if ((def.type === 'forum') !== forums) {
        if (state.channels[def.key]) positions.push({ channel: state.channels[def.key], position: chi, parent: category.id });
        continue;
      }
      const data = channelData(def, null, category.id, roleIds);
      let channel = findChannel(guild, def.key, state);
      if (!channel) {
        channel = await guild.channels.create({ ...data, reason: REASON });
        log(`+ ${def.type} ${def.type === 'voice' ? '🔊 ' : '#'}${def.name}`);
      } else {
        const { type: _type, ...editable } = data;
        await channel.edit({ ...editable, reason: REASON });
        log(`~ ${def.type} ${def.type === 'voice' ? '🔊 ' : '#'}${def.name}`);
      }
      state.channels[def.key] = channel.id;
      positions.push({ channel: channel.id, position: chi, parent: category.id });
    }
  }
  if (forums) {
    await guild.channels.setPositions(positions);
    log('channel order set');
  }
}

// Forum post guidelines contain channel mentions, so they're set once every channel exists.
async function ensureForums(guild, state, ctx) {
  step('Forum guidelines & tags');
  for (const cat of categories) {
    for (const def of cat.channels.filter((c) => c.type === 'forum')) {
      const forum = guild.channels.cache.get(state.channels[def.key]);
      const tags = def.tags.map((name) => {
        const existing = forum.availableTags.find((t) => t.name === name);
        return { id: existing?.id, name, moderated: false };
      });
      await forum.edit({ topic: render(readContent(def.topic), ctx), availableTags: tags, reason: REASON });
      log(`~ #${def.name}: guidelines + ${tags.length} tags`);
    }
  }
}

// ---------------------------------------------------------------------------
// Keeps a channel's bot-authored messages in sync with its content files.
async function syncChannelContent(channel, key, items, ctx, state) {
  const parts = items.flatMap((item) =>
    renderMessages(item.file, ctx).map((text, i) => ({ text, pin: Boolean(item.pin) && i === 0 })),
  );
  const saved = state.messages[key] ?? [];
  const next = [];
  for (const [i, part] of parts.entries()) {
    const h = hash(part.text);
    let msg = saved[i] ? await channel.messages.fetch(saved[i].id).catch(() => null) : null;
    if (!msg) {
      msg = await channel.send({ content: part.text, allowedMentions: { parse: [] } });
      log(`+ #${channel.name} message ${i + 1}`);
    } else if (saved[i].hash !== h) {
      await msg.edit({ content: part.text, allowedMentions: { parse: [] } });
      log(`~ #${channel.name} message ${i + 1} updated`);
    }
    if (part.pin && !msg.pinned) await msg.pin(REASON);
    if (!part.pin && msg.pinned) await msg.unpin(REASON);
    next.push({ id: msg.id, hash: h });
  }
  for (const old of saved.slice(parts.length)) {
    await channel.messages.delete(old.id).catch(() => {});
    log(`- #${channel.name} removed an old message`);
  }
  state.messages[key] = next;
}

async function syncForumPost(forum, key, post, { pin = false, lock = false }, state) {
  state.forumPosts[key] ??= {};
  const saved = state.forumPosts[key][post.title];
  const appliedTags = post.tags
    .map((name) => forum.availableTags.find((t) => t.name === name)?.id)
    .filter(Boolean);
  const h = hash(post.body + post.tags.join());

  let thread = saved ? await forum.guild.channels.fetch(saved.id).catch(() => null) : null;
  if (!thread) {
    thread = await forum.threads.create({
      name: post.title,
      message: { content: post.body, allowedMentions: { parse: [] } },
      appliedTags,
      reason: REASON,
    });
    log(`+ #${forum.name} post "${post.title}"`);
  } else if (saved.hash !== h) {
    if (thread.archived) await thread.setArchived(false, REASON);
    const starter = await thread.fetchStarterMessage();
    await starter.edit({ content: post.body, allowedMentions: { parse: [] } });
    await thread.setAppliedTags(appliedTags, REASON);
    log(`~ #${forum.name} post "${post.title}" updated`);
  }
  if (pin && !thread.flags.has('Pinned')) await thread.pin(REASON);
  if (lock && !thread.locked) await thread.setLocked(true, REASON);
  state.forumPosts[key][post.title] = { id: thread.id, hash: h };
}

async function ensureContent(guild, state, ctx) {
  step('Channel content');
  for (const cat of categories) {
    for (const def of cat.channels) {
      const channel = guild.channels.cache.get(state.channels[def.key]);
      if (def.content) await syncChannelContent(channel, def.key, def.content, ctx, state);
      if (def.guidePost) {
        const body = render(readContent(def.guidePost.file), ctx);
        await syncForumPost(channel, def.key, { title: def.guidePost.title, tags: [], body }, { pin: true, lock: true }, state);
      }
      if (def.posts) {
        // Created newest-last so the first post in the file shows at the top.
        const posts = parseLibrary(def.posts, ctx);
        for (const post of [...posts].reverse()) {
          await syncForumPost(channel, def.key, post, { lock: true }, state);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
async function ensureGuildSettings(guild, state) {
  step('Server settings & Community');
  const rulesChannel = state.channels.welcome;
  const modLog = state.channels.modLog;

  if (!guild.features.includes('COMMUNITY')) {
    await guild.edit({
      features: [...guild.features, 'COMMUNITY'],
      rulesChannel,
      publicUpdatesChannel: modLog,
      verificationLevel: GuildVerificationLevel.Medium,
      explicitContentFilter: GuildExplicitContentFilter.AllMembers,
      reason: REASON,
    });
    log('Community enabled (needed for forums, onboarding and member reporting)');
  }

  await guild.edit({
    name: server.name,
    description: server.description,
    verificationLevel: GuildVerificationLevel.Medium, // verified email + account older than 5 minutes
    explicitContentFilter: GuildExplicitContentFilter.AllMembers,
    defaultMessageNotifications: GuildDefaultMessageNotifications.OnlyMentions,
    rulesChannel,
    publicUpdatesChannel: modLog,
    safetyAlertsChannel: modLog,
    systemChannel: state.channels.general,
    // The bot posts its own welcome, so hide Discord's generic join messages.
    systemChannelFlags:
      GuildSystemChannelFlags.SuppressJoinNotifications |
      GuildSystemChannelFlags.SuppressJoinNotificationReplies |
      GuildSystemChannelFlags.SuppressGuildReminderNotifications,
    reason: REASON,
  });
  log('name, description, verification (Medium), content filter, notifications (mentions only), system channels');
}

// ---------------------------------------------------------------------------
async function ensureAutomod(guild, state) {
  step('AutoMod');
  const existing = await guild.autoModerationRules.fetch();
  const exemptRoles = STAFF_ROLE_KEYS.map((k) => state.roles[k]);
  const alert = { type: AutoModerationActionType.SendAlertMessage, metadata: { channel: state.channels.modLog } };
  const block = (customMessage) => ({ type: AutoModerationActionType.BlockMessage, metadata: { customMessage } });

  for (const def of automod) {
    let triggerType;
    let triggerMetadata = {};
    let actions = [block(def.blockMessage), alert];
    if (def.trigger === 'spam') {
      triggerType = AutoModerationRuleTriggerType.Spam;
      actions = [block(), alert];
    } else if (def.trigger === 'mentionSpam') {
      triggerType = AutoModerationRuleTriggerType.MentionSpam;
      triggerMetadata = { mentionTotalLimit: def.mentionLimit, mentionRaidProtectionEnabled: true };
      actions.push({ type: AutoModerationActionType.Timeout, metadata: { durationSeconds: 600 } });
    } else if (def.trigger === 'preset') {
      triggerType = AutoModerationRuleTriggerType.KeywordPreset;
      triggerMetadata = { presets: def.presets.map((p) => AutoModerationRuleKeywordPresetType[p]) };
    } else {
      triggerType = AutoModerationRuleTriggerType.Keyword;
      triggerMetadata = { keywordFilter: def.keywords ?? [], regexPatterns: def.regexPatterns ?? [] };
    }
    const data = {
      name: def.name,
      eventType: AutoModerationRuleEventType.MessageSend,
      triggerType,
      triggerMetadata,
      actions,
      enabled: true,
      exemptRoles,
      exemptChannels: [state.channels.modLog],
      reason: REASON,
    };
    const rule = existing.find((r) => r.name === def.name);
    try {
      if (rule) {
        const { triggerType: _t, eventType: _e, ...editable } = data;
        await rule.edit(editable);
        log(`~ ${def.name}`);
      } else {
        await guild.autoModerationRules.create(data);
        log(`+ ${def.name}`);
      }
    } catch (err) {
      // Discord allows only one Spam / Mention / Preset rule; an existing one with another name blocks ours.
      log(`! ${def.name}: ${err.message} (delete any conflicting AutoMod rule in Server Settings and re-run)`);
    }
  }
}

// ---------------------------------------------------------------------------
async function ensureOnboarding(guild, state) {
  step('Onboarding');
  await guild.editOnboarding({
    enabled: true,
    mode: GuildOnboardingMode.OnboardingDefault,
    defaultChannels: onboarding.defaultChannels.map((k) => state.channels[k]),
    prompts: onboarding.prompts.map((p) => ({
      title: p.title,
      singleSelect: p.singleSelect,
      required: p.required,
      inOnboarding: true,
      type: GuildOnboardingPromptType.MultipleChoice,
      options: p.options.map((o) => ({
        id: SnowflakeUtil.generate().toString(),
        title: o.title,
        description: o.description,
        emoji: o.emoji,
        roles: o.roles.map((k) => state.roles[k]),
        channels: [],
      })),
    })),
    reason: REASON,
  });
  log(`${onboarding.prompts.length} questions, ${onboarding.defaultChannels.length} default channels`);
}

// ---------------------------------------------------------------------------
export async function provision(guild) {
  const state = loadState(guild.id);
  for (const k of ['roles', 'categories', 'channels', 'messages', 'forumPosts']) state[k] ??= {};
  const save = () => saveState(guild.id, state);

  try {
    await ensureRoles(guild, state);
    const roleIds = { everyone: guild.roles.everyone.id, ...state.roles };
    await ensureChannels(guild, state, roleIds, { forums: false });
    save();
    await ensureGuildSettings(guild, state);
    await ensureChannels(guild, state, roleIds, { forums: true });
    save();
    const ctx = buildContext(guild, state);
    await ensureForums(guild, state, ctx);
    await ensureContent(guild, state, ctx);
    save();
    await ensureAutomod(guild, state);
    await ensureOnboarding(guild, state);

    if (privateClients.length) {
      step('Private coaching clients');
      for (const business of privateClients) {
        const { created } = await ensureClientRoom(guild, business, {
          staffRoleIds: STAFF_ROLE_KEYS.map((k) => state.roles[k]),
          ctx,
          reason: REASON,
        });
        log(`${business}: ${created.length ? `created ${created.length} channels` : 'already set up'}`);
      }
    }
  } finally {
    save();
  }
  return state;
}

// ---------------------------------------------------------------------------
async function main() {
  validate();
  if (process.argv.includes('--dry-run')) {
    printPlan();
    return;
  }

  const { DISCORD_TOKEN, DISCORD_GUILD_ID } = process.env;
  if (!DISCORD_TOKEN || !DISCORD_GUILD_ID) {
    throw new Error('Set DISCORD_TOKEN and DISCORD_GUILD_ID in .env (see .env.example)');
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const ready = new Promise((resolve) => client.once('clientReady', resolve));
  await client.login(DISCORD_TOKEN);
  await ready;

  try {
    const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
    await guild.channels.fetch();
    await guild.roles.fetch();
    await guild.members.fetchMe();
    if (!guild.members.me.permissions.has(PermissionFlagsBits.Administrator)) {
      throw new Error('The bot needs the Administrator permission to provision the server (see README).');
    }
    console.log(`Provisioning "${guild.name}" (${guild.id})`);

    await provision(guild);

    console.log('\n✅ Done. Finish the manual steps in README.md (Server Guide, icon, bot role position).');
  } finally {
    client.destroy();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(`\n❌ ${err.message}`);
    if (err.rawError) console.error(JSON.stringify(err.rawError, null, 2));
    process.exit(1);
  });
}
