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
    },
    '1312100247861727262': {
      verified: 1,
      'server booster': 2,
      'godpack contributor': 2,
      'boulder badge': 3,
      'cascade badge': 4,
      moderator: 10,
      'server owner': 99,
      admin: 99
    }
  };

export const hasValidRole = (
  allowedUser: AllowedUser,
  roles: DiscordAssignedRole[],
  minimumRole: string
): boolean => {
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
};

export const allowedUserToMessage = (user: AllowedUser, i: number) => {
  return `${i + 1}) ${user.is_main ? 'Main' : 'Alt'}: ${user.ign} - ${user.friendcode}`;
};

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
        discord_server_id: serverId,
        is_main: true,
        screenshot_id: '',
        created_at: new Date().toISOString(),
        modified_at: new Date().toISOString()
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
      const { name: roleName } = roles.find(({ id }) => id === roleId);
      const roleValue =
        discordServerToRoleValues[serverId][roleName.toLowerCase()];
      return {
        role_name: roleName,
        role_value: roleValue,
        username: user.user.username,
        server_id: serverId,
        id: roleId
      };
    });
  });
};

export const fetchInteractionDetails = async (
  discordRequest: any,
  botToken: string
) => {
  const serverId = discordRequest.guild_id;
  const serverName = await fetchServerName(botToken, serverId);
  const { username } = discordRequest.member.user;
  if (!serverId || !serverName || !username) {
    console.error('Server ID or Channel ID not found.', discordRequest);
  }

  return { serverId, serverName, username };
};

export const fetchServerName = async (botToken: string, serverId: string) => {
  const discordAPI = new REST({ version: '10' }).setToken(botToken);
  const route = Routes.guild(serverId);
  return discordAPI
    .get(route)
    .then(server => (server as { name: string }).name);
};

export const INVITE_COMMAND = {
  name: 'invite',
  description: 'Get the invite link for the bot.'
};

export const SELF_ID_COMMAND = {
  name: 'id',
  description: 'Self register your ID and IGN.',

  options: [
    {
      name: 'ign',
      description: 'In-game-name',
      type: 3,
      required: true
    },
    {
      name: 'friendcode',
      description: '16 digit friendcode, without dashes or spaces',
      min_length: 16,
      max_length: 16,
      type: 3,
      required: true
    },
    {
      name: 'main',
      description: 'Is this account your main?',
      type: 5,
      required: true
    },
    {
      name: 'screenshot',
      description:
        'Screenshot of your in-game profile, with your ID/IGN visible',
      type: 11,
      required: true
    }
  ]
};

export const LIST_ACCOUNTS = {
  name: 'list',
  description: 'List all registered accounts.'
};

export const botCommands = [INVITE_COMMAND, LIST_ACCOUNTS, SELF_ID_COMMAND];
