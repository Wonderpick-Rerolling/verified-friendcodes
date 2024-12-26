import {
  D1Database,
  ExportedHandler
} from '@cloudflare/workers-types/experimental';

import { router } from './routes/index.ts';
import { cron } from './cron/index.ts';

export interface Env {
  DB: D1Database;
  DISCORD_TOKEN: string;
  DISCORD_PUBLIC_KEY: string;
  DISCORD_APPLICATION_ID: string;
}

export default {
  fetch: router.fetch,
  scheduled: cron.scheduled
} satisfies ExportedHandler<Env>;
