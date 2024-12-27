import { AutoRouter } from 'itty-router/AutoRouter';
import { Env } from '..';
import { verifyDiscordRequest } from '../utils/discord';
import { InteractionResponseType, InteractionType } from 'discord-interactions';
import { getAllowedUsers } from '../database';

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
  const { isValid, interaction } = await verifyDiscordRequest(request, env);
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
      case 'test': {
        return new JsonResponse({});
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
