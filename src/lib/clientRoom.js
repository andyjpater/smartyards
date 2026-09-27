import { ChannelType, OverwriteType } from 'discord.js';
import { clientRoomTemplate } from '../config/server.js';
import { bits } from './layout.js';
import { renderMessages } from './content.js';

// Creates (or completes) the private category for one coaching business:
//   role "Client · <Business>" + category "<BUSINESS> — PRIVATE" with
//   #coaching-chat, #pipeline, #deal-review, #numbers.
// Only Founder, Coach and that business's client role can see it.
export async function ensureClientRoom(guild, business, { staffRoleIds, ctx, reason }) {
  const roleName = clientRoomTemplate.roleName(business);
  const categoryName = clientRoomTemplate.categoryName(business);

  let role = guild.roles.cache.find((r) => r.name === roleName);
  if (!role) {
    role = await guild.roles.create({ name: roleName, color: 0x8b5cf6, permissions: 0n, mentionable: false, reason });
  }

  const overwrites = [
    { id: guild.roles.everyone.id, type: OverwriteType.Role, deny: bits(['ViewChannel']) },
    ...staffRoleIds.map((id) => ({
      id,
      type: OverwriteType.Role,
      allow: bits(['ViewChannel', 'SendMessages', 'SendMessagesInThreads', 'CreatePublicThreads']),
    })),
    {
      id: role.id,
      type: OverwriteType.Role,
      allow: bits(['ViewChannel', 'SendMessages', 'SendMessagesInThreads', 'CreatePublicThreads', 'AttachFiles']),
    },
  ];

  let category = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name === categoryName);
  if (!category) {
    category = await guild.channels.create({
      name: categoryName,
      type: ChannelType.GuildCategory,
      permissionOverwrites: overwrites,
      reason,
    });
  } else {
    await category.permissionOverwrites.set(overwrites, reason);
  }

  const created = [];
  for (const def of clientRoomTemplate.channels) {
    let channel = guild.channels.cache.find((c) => c.parentId === category.id && c.name === def.name);
    if (channel) {
      await channel.lockPermissions();
      continue;
    }
    channel = await guild.channels.create({
      name: def.name,
      type: ChannelType.GuildText,
      parent: category.id,
      topic: def.topic,
      permissionOverwrites: overwrites,
      reason,
    });
    for (const text of renderMessages(def.intro, ctx)) {
      const msg = await channel.send({ content: text, allowedMentions: { parse: [] } });
      await msg.pin().catch(() => {});
    }
    created.push(channel);
  }

  return { role, category, created };
}
