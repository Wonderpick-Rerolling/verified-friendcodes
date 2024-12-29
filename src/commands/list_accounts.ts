import { D1Database } from '@cloudflare/workers-types/experimental';
import {
  AllowedUser,
  DiscordAssignedRole,
  getAllowedUsersByUsernameAndServer,
  getMaximumRoleByUsernameAndServer
} from '../database';

export const command = async (
  discordUsername: string,
  discordServerId: string,
  db: D1Database
): Promise<{ accounts: AllowedUser[]; role: DiscordAssignedRole | null }> => {
  console.log('Listing registered accounts for user', discordUsername);

  const accounts = await getAllowedUsersByUsernameAndServer(
    db,
    discordUsername,
    discordServerId
  );

  const role = await getMaximumRoleByUsernameAndServer(
    db,
    discordUsername,
    discordServerId
  );

  return { accounts, role };
};
