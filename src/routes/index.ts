import { AutoRouter } from 'itty-router/AutoRouter';
import { Env } from '..';
import {
  allowedUserToMessage,
  fetchInteractionDetails,
  INVITE_COMMAND,
  LIST_ACCOUNTS,
  SELF_ID_COMMAND,
  verifyDiscordRequest
} from '../utils/discord';
import {
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType
} from 'discord-interactions';
import { addDiscordServer, getAllowedUsers } from '../database';
import { command as selfRegister } from '../commands/self_register';
import { command as listAccounts } from '../commands/list_accounts';
import { command as invite } from '../commands/invite';

export const router = AutoRouter();

class JsonResponse extends Response {
  constructor(body, init?: any) {
    const jsonBody = JSON.stringify(body);
    init = init || {
      headers: {
        'content-type': 'application/json;charset=UTF-8'
      }
    };
    super(jsonBody, init);
  }

  static asChannelMessageWithSource(content: any, flags?: any) {
    return new JsonResponse({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: { content, flags }
    });
  }
}

router.get('/bot', async (_, env: Env) => {
  return new Response(`👋 ${env.DISCORD_APPLICATION_ID}`);
});

router.post('/bot', async (request, env: Env) => {
  const { isValid, request: interaction } = await verifyDiscordRequest(
    request,
    env
  );
  if (!isValid || !interaction) {
    return new Response('Bad request signature.', { status: 401 });
  }

  if (interaction.type === InteractionType.PING) {
    // The `PING` message is used during the initial webhook handshake, and is
    // required to configure the webhook in the developer portal.
    return new JsonResponse({ type: InteractionResponseType.PONG });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    try {
      const { serverId, serverName, username } = await fetchInteractionDetails(
        interaction,
        env.DISCORD_TOKEN
      );
      if (!serverId || !serverName || !username) {
        console.error('Server ID or username not found.', interaction);
        throw new Error('ServerID or username not found.');
      }

      await addDiscordServer(env.DB, { id: serverId, name: serverName });

      switch (interaction.data.name.toLowerCase()) {
        case INVITE_COMMAND.name.toLowerCase(): {
          const inviteLink = invite(env.DISCORD_APPLICATION_ID);

          return JsonResponse.asChannelMessageWithSource(
            inviteLink,
            InteractionResponseFlags.EPHEMERAL
          );
        }
        case SELF_ID_COMMAND.name.toLowerCase(): {
          const { options } = interaction.data;
          const ign = options.find(o => o.name === 'ign').value;
          const friendcode = options.find(o => o.name === 'friendcode').value;
          const isMain = options.find(o => o.name === 'main').value;
          const imageId = options.find(o => o.name === 'screenshot').value;

          try {
            const response = await selfRegister(
              username,
              ign,
              friendcode,
              isMain,
              imageId,
              serverId,
              env.DB
            );

            return JsonResponse.asChannelMessageWithSource(
              response,
              InteractionResponseFlags.EPHEMERAL
            );
          } catch (e) {
            console.error('Error processing command: ', e);
            return JsonResponse.asChannelMessageWithSource(
              e.message,
              InteractionResponseFlags.EPHEMERAL
            );
          }
        }
        case LIST_ACCOUNTS.name.toLowerCase(): {
          const { accounts, role } = await listAccounts(
            username,
            serverId,
            env.DB
          );
          const roleName = role?.role_name ?? 'No-role';
          let content: string;
          if (accounts.length === 0) {
            content = 'No accounts registered.';
          } else {
            content = `Here are your active accounts, maximum role is: ${roleName}\n${accounts
              .map(allowedUserToMessage)
              .join('\n')}`;
          }

          return new JsonResponse({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content }
          });
        }
        default:
          return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
      }
    } catch (e) {
      console.error('Error processing command: ', e);
      return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
    }
  }
  console.error('Unknown Type: ', interaction.type);
  return new JsonResponse({ error: 'Unknown Type' }, { status: 400 });
});

router.get('/whitelist', async (request, env: Env) => {
  const discordServer = request.query?.['discord_server'];
  const minimumRole = request.query?.['minimum_role'];
  const allowedUsers = await getAllowedUsers(
    env.DB,
    discordServer as string | null,
    minimumRole as string | null
  );

  return new JsonResponse(allowedUsers.map(u => u.friendcode));
});

router.all('*', () => new Response('Not Found.', { status: 404 }));
