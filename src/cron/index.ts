import { D1Database } from '@cloudflare/workers-types/experimental';
import {
  AllowedUser,
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
    console.log(
      `Fetching messages for server: ${server.name}, channelID: ${server.roles_channel_id}`
    );

    const usersToRoles = await fetchUsersToRoles(botToken, server.id);
    await updateAssignedRoles(db, usersToRoles, server.id);

    const allowedUsers = await fetchAllMessagesFromChannel(
      botToken,
      server.roles_channel_id,
      server.id
    );

    await updateAllowedUsers(db, allowedUsers, server.id);
  }
};

export const cron = {
  scheduled: async (event, env: Env, ctx) => {
    ctx.waitUntil(
      fetchMessagesAndUpdateAllowedUsers(env.DB, env.DISCORD_TOKEN)
    );
  }
};
