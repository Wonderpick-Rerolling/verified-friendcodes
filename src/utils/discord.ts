import { verifyKey } from 'discord-interactions';
import { Env } from '..';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';
import { AllowedUser, DiscordAssignedRole } from '../database';

type DiscordUser = {
  roles: string[];
  user: { id: string; username: string };
};

type DiscordRole = {
  id: string;
  name: string;
};

type DiscordMessage = {
  id: string;
  content: string;
  author: { id: string; username: string };
};

export async function verifyDiscordRequest(request: any, env: Env) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const body = await request.text();
  const isValidRequest =
    signature &&
    timestamp &&
    (await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY));
  if (!isValidRequest) {
    return { isValid: false };
  }

  return { request: JSON.parse(body), isValid: true };
}

const discordServerToRoleValues: { [key: string]: { [key: string]: number } } =
  {
    '1310093045726969977': {
      'poke ball': 1,
      'great ball': 2,
      'ultra ball': 3,
      'master ball': 4
    },
    '1321259990429863936': {
      'poke ball': 1,
      'great ball': 2,
      'ultra ball': 3,
      'master ball': 4
    }
  };

export function hasValidRole(
  allowedUser: AllowedUser,
  roles: DiscordAssignedRole[],
  minimumRole: string
): boolean {
  const userRoles = roles.filter(
    ({ username }) => username === allowedUser.discord_username
  );

  if (!userRoles.length) {
    return false;
  }

  const roleValues = discordServerToRoleValues[userRoles[0].server_id];
  let maxRoleValue = 0;

  for (const role of userRoles) {
    const roleValue = roleValues[role.role_name.toLowerCase()];
    if (roleValue && roleValue > maxRoleValue) {
      maxRoleValue = roleValue;
    }
  }

  const minimumRoleValue = roleValues[minimumRole.toLowerCase()] || 0;

  return maxRoleValue >= minimumRoleValue;
}

export const fetchAllMessagesFromChannel = async (
  botToken: string,
  channelId: string,
  serverId: string
): Promise<AllowedUser[]> => {
  let channelMessages: DiscordMessage[] = [];
  const discordAPI = new REST({ version: '10' }).setToken(botToken);
  const route = Routes.channelMessages(channelId);

  let messagePointer: DiscordMessage | undefined = await discordAPI
    .get(route, { body: { limit: 1 } })
    .then(messages => (messages as DiscordMessage[]).at(0));

  while (messagePointer) {
    await discordAPI
      .get(route, { body: { limit: 100, after: messagePointer.id } })
      .then(response => {
        const messages = (response || []) as DiscordMessage[];
        if (messagePointer?.id === messages.at(-1)?.id) {
          messagePointer = undefined;
        } else {
          channelMessages = [...channelMessages, ...messages];
          messagePointer = messages.at(-1);
        }
      });
  }

  const messageToAllowedUser = (message: DiscordMessage): AllowedUser[] => {
    let [fcString, ignString] = message.content.trim().split('\n');

    if (!fcString || !ignString) {
      return [];
    }

    fcString = fcString.trim();
    ignString = ignString.trim();
    if (
      fcString.toUpperCase().startsWith('IGN') &&
      ignString.toUpperCase().startsWith('ID')
    ) {
      const tmp = fcString;
      fcString = ignString;
      ignString = tmp;
    }

    if (
      !fcString.toUpperCase().startsWith('ID') &&
      !ignString.toUpperCase().startsWith('IGN')
    ) {
      return [];
    }

    const friendcode = fcString.split(':')[1]?.trim();
    const ign = ignString.split(':')[1]?.trim();

    if (!friendcode || !ign) {
      return [];
    }

    return [
      {
        ign,
        friendcode,
        discord_username: message.author.username,
        discord_server_id: serverId
      }
    ];
  };

  return channelMessages.flatMap(messageToAllowedUser);
};

export const fetchUsersToRoles = async (
  botToken: string,
  serverId: string
): Promise<DiscordAssignedRole[]> => {
  const discordAPI = new REST({ version: '10' }).setToken(botToken);

  const rolesRoute = Routes.guildRoles(serverId);
  const roles = await discordAPI
    .get(rolesRoute)
    .then(roles => roles as DiscordRole[]);

  const membersRoute = Routes.guildMembers(serverId);

  const discordUsers = await discordAPI
    .get(membersRoute)
    .then(users => users as DiscordUser[]);

  return discordUsers.flatMap(user => {
    return user.roles.map(roleId => {
      const roleName = roles.find(({ id }) => id === roleId)!.name;
      return {
        role_name: roleName,
        username: user.user.username,
        server_id: serverId,
        id: roleId
      };
    });
  });
};

export const fetchServerName = async (botToken: string, serverId: string) => {
  const discordAPI = new REST({ version: '10' }).setToken(botToken);
  const route = Routes.guild(serverId);
  return discordAPI
    .get(route)
    .then(server => (server as { name: string }).name);
};

export const ID_CHANNEL_COMMAND = {
  name: 'channel',
  description: 'Select this channel for the bot to listen to.'
};

export const INVITE_COMMAND = {
  name: 'invite',
  description: 'Get the invite link for the bot.'
};

export const botCommands = [ID_CHANNEL_COMMAND, INVITE_COMMAND];
