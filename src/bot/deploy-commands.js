// Registers the bot's slash/context-menu commands in the Society server.
import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { commandData } from './commands.js';

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID || !DISCORD_GUILD_ID) {
  console.error('Set DISCORD_TOKEN, DISCORD_CLIENT_ID and DISCORD_GUILD_ID in .env');
  process.exit(1);
}

const rest = new REST().setToken(DISCORD_TOKEN);
const result = await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID), {
  body: commandData,
});
console.log(`Registered ${result.length} commands: ${result.map((c) => c.name).join(', ')}`);
