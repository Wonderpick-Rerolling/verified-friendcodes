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

const fetchMessagesAndUpdateAllowedUsers = async (
  db: D1Database,
  botToken: string
) => {
  const discordServers = await getDiscordServers(db);
  for (const server of discordServers) {
    console.log(`Updating server: ${server.name}`);

    console.log(`Fetching roles`);
    const usersToRoles = await fetchUsersToRoles(botToken, server.id);
    console.log(`Assigning roles`, usersToRoles);
    await updateAssignedRoles(db, usersToRoles, server.id);

    console.log(`Fetching messages at channelID: ${server.roles_channel_id}`);
    const allowedUsers = await fetchAllMessagesFromChannel(
      botToken,
      server.roles_channel_id,
      server.id
    );

    console.log(`Updating allowed users`, allowedUsers);
    await updateAllowedUsers(db, allowedUsers, server.id);
    console.log(`----------------`);
  }
};

export const cron = {
  scheduled: async (event, env: Env, ctx) => {
    ctx.waitUntil(
      fetchMessagesAndUpdateAllowedUsers(env.DB, env.DISCORD_TOKEN)
    );
  }
};
