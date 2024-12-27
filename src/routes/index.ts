import { AutoRouter } from 'itty-router/AutoRouter';
import { Env } from '..';
import {
  fetchServerName,
  ID_CHANNEL_COMMAND,
  INVITE_COMMAND,
  verifyDiscordRequest
} from '../utils/discord';
import {
  InteractionResponseFlags,
  InteractionResponseType,
  InteractionType
} from 'discord-interactions';
import { addDiscordServer, getAllowedUsers } from '../database';
import { server } from 'typescript';

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
    switch (interaction.data.name.toLowerCase()) {
      case ID_CHANNEL_COMMAND.name.toLowerCase(): {
        const channelId = interaction.channel_id;
        const serverId = interaction.guild_id;
        const serverName = await fetchServerName(env.DISCORD_TOKEN, serverId);

        if (!serverId || !channelId || !serverName) {
          console.error('Server ID or Channel ID not found.', interaction);
          return new JsonResponse(
            { error: 'Server ID or Channel ID not found.' },
            { status: 400 }
          );
        }
        console.log(
          `Registering channel ${channelId} for server: ${serverName}, ID: ${serverId}`
        );

        const server = {
          id: serverId,
          name: serverName,
          roles_channel_id: channelId
        };

        await addDiscordServer(env.DB, server);

        console.log('Channel registered as ID channel.');
        return new JsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: 'Channel registered as ID channel.'
          }
        });
      }
      case INVITE_COMMAND.name.toLowerCase(): {
        const applicationId = env.DISCORD_APPLICATION_ID;
        const INVITE_URL = `https://discord.com/oauth2/authorize?client_id=${applicationId}&scope=applications.commands`;
        return new JsonResponse({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: INVITE_URL,
            flags: InteractionResponseFlags.EPHEMERAL
          }
        });
      }
      default:
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
