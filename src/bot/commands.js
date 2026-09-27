import {
  ActionRowBuilder,
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  EmbedBuilder,
  InteractionContextType,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { ensureClientRoom } from '../lib/clientRoom.js';
import { STAFF_ROLE_KEYS } from '../lib/layout.js';
import { buildContext, findChannel, findRole } from '../lib/resolve.js';

export const commandData = [
  new SlashCommandBuilder()
    .setName('client-room')
    .setDescription('Private coaching: set up a private category for a coaching business')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles) // Founder + Coach
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Create the private category (safe to re-run to add another team member)')
        .addStringOption((o) =>
          o.setName('business').setDescription('Business name, e.g. Andy’s Tiling').setRequired(true).setMaxLength(60),
        )
        .addUserOption((o) => o.setName('member').setDescription('Team member to give access (optional)')),
    ),
  new ContextMenuCommandBuilder()
    .setName('Report to Coaches')
    .setType(ApplicationCommandType.Message)
    .setContexts(InteractionContextType.Guild),
].map((c) => c.toJSON());

async function clientRoom(interaction) {
  const { guild } = interaction;
  const business = interaction.options.getString('business', true).trim();
  const member = interaction.options.getMember('member');
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const staffRoleIds = STAFF_ROLE_KEYS.map((k) => findRole(guild, k)?.id).filter(Boolean);
  const { role, category, created } = await ensureClientRoom(guild, business, {
    staffRoleIds,
    ctx: buildContext(guild),
    reason: `/client-room by ${interaction.user.tag}`,
  });

  const lines = [
    created.length
      ? `✅ Created **${category.name}** with ${created.map((c) => `<#${c.id}>`).join(' ')}`
      : `✅ **${category.name}** already exists.`,
    `Access role: <@&${role.id}>. Only this role, Coaches and the Founder can see it.`,
  ];
  if (member) {
    const privateCoaching = findRole(guild, 'privateCoaching');
    await member.roles.add([role, privateCoaching].filter(Boolean), `/client-room by ${interaction.user.tag}`);
    lines.push(`Added ${member} (plus the Private Coaching badge).`);
  } else {
    lines.push('Give each team member this role plus **Private Coaching**, or re-run with `member:`.');
  }
  await interaction.editReply(lines.join('\n'));
}

async function reportPrompt(interaction) {
  const message = interaction.targetMessage;
  const modal = new ModalBuilder()
    .setCustomId(`report:${message.channelId}:${message.id}`)
    .setTitle('Report to Coaches')
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('reason')
          .setLabel('What’s the problem? (optional)')
          .setPlaceholder('Spam, unsolicited DM, customer details not removed…')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(500),
      ),
    );
  await interaction.showModal(modal);
}

async function reportSubmit(interaction) {
  const [, channelId, messageId] = interaction.customId.split(':');
  const reason = interaction.fields.getTextInputValue('reason') || '(no reason given)';
  const channel = interaction.guild.channels.cache.get(channelId);
  const message = await channel?.messages.fetch(messageId).catch(() => null);
  const modLog = findChannel(interaction.guild, 'modLog');

  const embed = new EmbedBuilder()
    .setColor(0xef4444)
    .setTitle('🚩 Member report')
    .addFields(
      { name: 'Reported by', value: `${interaction.user}`, inline: true },
      { name: 'Author', value: message ? `${message.author}` : 'unknown', inline: true },
      { name: 'Channel', value: `<#${channelId}>`, inline: true },
      { name: 'Reason', value: reason },
      { name: 'Message', value: (message?.content || '(no text / deleted)').slice(0, 1000) },
    )
    .setURL(message?.url ?? null)
    .setTimestamp();
  await modLog?.send({ embeds: [embed], content: message ? `Jump: ${message.url}` : undefined });
  await interaction.reply({
    content: 'Thanks. The coaches have been notified and will take a look. 👍',
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleInteraction(interaction) {
  try {
    if (interaction.isChatInputCommand() && interaction.commandName === 'client-room') return await clientRoom(interaction);
    if (interaction.isMessageContextMenuCommand() && interaction.commandName === 'Report to Coaches')
      return await reportPrompt(interaction);
    if (interaction.isModalSubmit() && interaction.customId.startsWith('report:')) return await reportSubmit(interaction);
  } catch (err) {
    console.error(err);
    const reply = { content: `Something went wrong: ${err.message}`, flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) await interaction.editReply(reply).catch(() => {});
    else if (interaction.isRepliable()) await interaction.reply(reply).catch(() => {});
  }
}
