// The Society bot: welcomes, weekly scoreboard reminder, Sales Clinic events +
// reminders, moderation log, member reports and /client-room.
import 'dotenv/config';
import {
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
  GuildScheduledEventStatus,
} from 'discord.js';
import { DateTime } from 'luxon';
import { handleInteraction } from './commands.js';
import { readContent, render } from '../lib/content.js';
import { buildContext, findChannel, findRole } from '../lib/resolve.js';
import { loadState, saveState } from '../lib/state.js';
import { dueReminder, nextWeeklyOccurrences, scoreboardDue } from '../lib/schedule.js';

const env = process.env;
const config = {
  token: env.DISCORD_TOKEN,
  guildId: env.DISCORD_GUILD_ID,
  zone: env.TIMEZONE || 'Australia/Sydney',
  clinic: {
    enabled: (env.CLINIC_ENABLED ?? 'true') !== 'false',
    name: 'Sell Heaps More Sales Clinic',
    weekday: Number(env.CLINIC_WEEKDAY || 2),
    time: env.CLINIC_TIME || '12:00',
    minutes: Number(env.CLINIC_DURATION_MINUTES || 60),
    weeksAhead: Number(env.CLINIC_WEEKS_AHEAD || 2),
  },
  scoreboard: { weekday: Number(env.SCOREBOARD_WEEKDAY || 5), time: env.SCOREBOARD_TIME || '15:00' },
  reminderHours: (env.EVENT_REMINDER_HOURS || '24,1').split(',').map(Number).filter((n) => n > 0),
};
if (!config.token || !config.guildId) {
  console.error('Set DISCORD_TOKEN and DISCORD_GUILD_ID in .env');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // privileged: enable "Server Members Intent" in the developer portal
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildScheduledEvents,
  ],
});

const stateKey = `${config.guildId}-bot`;
const state = loadState(stateKey);
state.reminders ??= {};
const save = () => saveState(stateKey, state);
const guild = () => client.guilds.cache.get(config.guildId);
const channel = (key) => findChannel(guild(), key);

async function modLog(embed) {
  await channel('modLog')?.send({ embeds: [embed] }).catch((e) => console.error('mod-log:', e.message));
}

// --- New member welcome ------------------------------------------------------
client.on(Events.GuildMemberAdd, async (member) => {
  if (member.guild.id !== config.guildId || member.user.bot) return;
  const text = render(readContent('bot/welcome.md'), buildContext(member.guild)).replace('{member}', `${member}`);
  await channel('general')?.send({ content: text, allowedMentions: { users: [member.id] } });

  const ageDays = Math.floor((Date.now() - member.user.createdTimestamp) / 86400000);
  await modLog(
    new EmbedBuilder()
      .setColor(ageDays < 7 ? 0xf59e0b : 0x22c55e)
      .setTitle(ageDays < 7 ? '⚠️ Member joined (new account)' : '📥 Member joined')
      .setDescription(`${member} · ${member.user.tag}\nAccount age: ${ageDays} day(s)`)
      .setTimestamp(),
  );
});

client.on(Events.GuildMemberRemove, async (member) => {
  if (member.guild.id !== config.guildId) return;
  await modLog(
    new EmbedBuilder()
      .setColor(0x64748b)
      .setTitle('📤 Member left')
      .setDescription(`${member.user.tag} (${member.id})`)
      .setTimestamp(),
  );
});

client.on(Events.GuildBanAdd, async (ban) => {
  if (ban.guild.id !== config.guildId) return;
  await modLog(
    new EmbedBuilder()
      .setColor(0xef4444)
      .setTitle('🔨 Member banned')
      .setDescription(`${ban.user.tag} (${ban.user.id})${ban.reason ? `\nReason: ${ban.reason}` : ''}`)
      .setTimestamp(),
  );
});

client.on(Events.InteractionCreate, handleInteraction);

// --- Weekly Sales Clinic events -------------------------------------------------
async function ensureClinicEvents() {
  if (!config.clinic.enabled) return;
  const g = guild();
  const voice = channel('salesClinic');
  if (!voice) return console.error('Sales Clinic voice channel not found; run npm run provision');
  const events = await g.scheduledEvents.fetch();
  const description = readContent('bot/clinic-event.md');

  for (const start of nextWeeklyOccurrences({ ...config.clinic, zone: config.zone, count: config.clinic.weeksAhead })) {
    const exists = events.some(
      (e) => e.name === config.clinic.name && Math.abs(e.scheduledStartTimestamp - start.toMillis()) < 60_000,
    );
    if (exists) continue;
    await g.scheduledEvents.create({
      name: config.clinic.name,
      scheduledStartTime: start.toJSDate(),
      scheduledEndTime: start.plus({ minutes: config.clinic.minutes }).toJSDate(),
      privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
      entityType: GuildScheduledEventEntityType.Voice,
      channel: voice,
      description,
      reason: 'Weekly Sales Clinic',
    });
    console.log(`Created Sales Clinic event for ${start.toFormat('ccc d LLL, h:mma ZZZZ')}`);
  }
}

// --- Reminders before every scheduled event (clinics, workshops, guest sessions) ----
async function sendEventReminders(now) {
  const g = guild();
  const events = await g.scheduledEvents.fetch();
  const calendar = channel('coachingCalendar');
  const pingRole = findRole(g, 'clinicReminders');
  const live = new Set();

  for (const event of events.values()) {
    if (event.status !== GuildScheduledEventStatus.Scheduled) continue;
    live.add(event.id);
    const sent = state.reminders[event.id] ?? [];
    const bucket = dueReminder({ start: event.scheduledStartTimestamp, now: now.toMillis(), hours: config.reminderHours, sent });
    if (bucket === null) continue;

    const unix = Math.floor(event.scheduledStartTimestamp / 1000);
    const isClinic = event.name === config.clinic.name;
    const lines = [
      `${pingRole ? `${pingRole} ` : ''}🔔 **${event.name}** starts <t:${unix}:R> (<t:${unix}:F>).`,
      isClinic
        ? `Bring a real deal, objection or lost quote. Got a question? Drop it in ${channel('submitAQuestion') ?? '#submit-a-question'} now.`
        : 'See you there.',
      event.url,
    ];
    await calendar?.send({ content: lines.join('\n'), allowedMentions: { roles: pingRole ? [pingRole.id] : [] } });
    // Mark this bucket and every larger one as done.
    state.reminders[event.id] = [...new Set([...sent, ...config.reminderHours.filter((h) => h >= bucket)])];
    console.log(`Reminder (${bucket}h bucket) sent for ${event.name}`);
  }
  for (const id of Object.keys(state.reminders)) if (!live.has(id)) delete state.reminders[id];
}

// --- Weekly scoreboard reminder -----------------------------------------------
async function sendScoreboardReminder(now) {
  const week = scoreboardDue({ ...config.scoreboard, zone: config.zone, now, lastSentWeek: state.scoreboardWeek });
  if (!week) return;
  await channel('scoreboard')?.send({ content: readContent('bot/scoreboard-reminder.md') });
  state.scoreboardWeek = week;
  console.log(`Scoreboard reminder sent (${week})`);
}

// --- Scheduler: one tick a minute ----------------------------------------------------
let lastClinicCheck = 0;
async function tick() {
  const now = DateTime.now();
  const jobs = [
    ['event reminders', () => sendEventReminders(now)],
    ['scoreboard reminder', () => sendScoreboardReminder(now)],
  ];
  if (Date.now() - lastClinicCheck > 60 * 60_000) {
    lastClinicCheck = Date.now();
    jobs.unshift(['clinic events', ensureClinicEvents]);
  }
  for (const [name, job] of jobs) {
    try {
      await job();
    } catch (err) {
      console.error(`${name} failed:`, err.message);
    }
  }
  save();
}

client.once(Events.ClientReady, async () => {
  const g = guild();
  if (!g) {
    console.error(`Bot isn't in guild ${config.guildId}`);
    process.exit(1);
  }
  await g.channels.fetch();
  await g.roles.fetch();
  console.log(`${client.user.tag} running in "${g.name}" (timezone ${config.zone})`);
  await tick();
  setInterval(tick, 60_000);
});

client.login(config.token);
