import { D1Database } from '@cloudflare/workers-types/experimental';
import {
  getDiscordServers,
  updateAllowedUsers,
  updateAssignedRoles
} from '../database';
import {
  fetchAllMessagesFromChannel,
  fetchUsersToRoles
} from '../utils/discord';
import { Env } from '..';

const fetchAndUpdateRoles = async (db: D1Database, botToken: string) => {
  console.log(`Fetching and updating roles`);
  const discordServers = await getDiscordServers(db);
  for (const server of discordServers) {
    console.log(`Updating roles for server: ${server.name}`);

    const usersToRoles = await fetchUsersToRoles(botToken, server.id);
    console.log(`Assigning roles`, usersToRoles);
    await updateAssignedRoles(db, usersToRoles, server.id);
    console.log(`----------------`);
  }
};

export const cron = {
  scheduled: async (event, env: Env, ctx) => {
    ctx.waitUntil(fetchAndUpdateRoles(env.DB, env.DISCORD_TOKEN));
  }
};
