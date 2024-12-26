import {
  D1Database,
  D1PreparedStatement
} from '@cloudflare/workers-types/experimental';
import { hasValidRole } from '../utils/discord';

export type AllowedUser = {
  friendcode: string;
  ign: string;
  discord_username: string;
  discord_server_id: string;
};

export type DiscordServer = {
  id: string;
  name: string;
  roles_channel_id: string;
};

export type DiscordAssignedRole = {
  id: string;
  role_name: string;
  username: string;
  server_id: string;
};

export const createAllowedUsersTable = async (
  db: D1Database
): Promise<void> => {
  const statement = db.prepare(`CREATE TABLE IF NOT EXISTS allowed_users (
    friendcode TEXT NOT NULL,
    ign TEXT NOT NULL,
    discord_username TEXT NOT NULL,
    discord_server_id TEXT NOT NULL,
    PRIMARY KEY (friendcode, discord_server_id)
  )`);
  const query = await statement.run();
  if (!query.success) {
    throw new Error('Failed to create allowed_users table.');
  }
};

export const createDiscordServerTable = async (
  db: D1Database
): Promise<void> => {
  const statement = db.prepare(
    'CREATE TABLE IF NOT EXISTS discord_servers (id TEXT PRIMARY KEY, name TEXT NOT NULL, roles_channel_id TEXT NOT NULL)'
  );
  const query = await statement.run();
  if (!query.success) {
    throw new Error('Failed to create discord_servers table.');
  }
};

export const createDiscordRolesTable = async (
  db: D1Database
): Promise<void> => {
  const statement = db.prepare(`CREATE TABLE IF NOT EXISTS discord_roles (
    role_id TEXT NOT NULL,
    role_name TEXT NOT NULL,
    username TEXT NOT NULL,
    server_id TEXT NOT NULL,
    PRIMARY KEY (role_id, server_id)
  )`);
  const query = await statement.run();
  if (!query.success) {
    throw new Error('Failed to create discord_roles table.');
  }
};

export const getAllowedUsers = async (
  db: D1Database,
  discordServerName?: string | null,
  minimumRole?: string | null
): Promise<AllowedUser[]> => {
  let statement: D1PreparedStatement;
  const discordServerId = discordServerName
    ? (await getDiscordServerByName(db, discordServerName)).id
    : null;

  if (discordServerId) {
    statement = db
      .prepare('SELECT * FROM allowed_users WHERE discord_server_id = ?')
      .bind(discordServerId);
  } else {
    statement = db.prepare('SELECT * FROM allowed_users');
  }

  const query = await statement.run();
  if (query.error || !query.success) {
    throw new Error('Failed to fetch allowed_users.');
  }

  const allowed_users = query.results as AllowedUser[];
  if (minimumRole && minimumRole !== 'all' && discordServerId) {
    const userRoles = await getDiscordRolesByServer(db, discordServerId);
    return allowed_users.filter(entry =>
      hasValidRole(entry, userRoles, minimumRole)
    );
  }

  return allowed_users;
};

export const getDiscordServers = async (
  db: D1Database
): Promise<DiscordServer[]> => {
  const statement = db.prepare('SELECT * FROM discord_servers');
  const query = await statement.run();
  if (query.error || !query.success) {
    throw new Error('Failed to fetch discord_servers.');
  }

  return query.results as DiscordServer[];
};

const getDiscordServerByName = async (
  db: D1Database,
  discordServerName: string
) => {
  const statement = db.prepare('SELECT * FROM discord_servers WHERE name = ?');
  statement.bind(discordServerName);
  const query = await statement.run();
  if (query.error || !query.success) {
    throw new Error('Failed to fetch discord_server.');
  }

  return query.results[0] as DiscordServer;
};

const getDiscordRolesByServer = async (db: D1Database, serverId: string) => {
  const query = await db
    .prepare('SELECT * FROM discord_roles WHERE server_id = ?')
    .bind(serverId)
    .run();
  if (query.error || !query.success) {
    throw new Error('Failed to fetch discord_roles.');
  }

  return query.results as DiscordAssignedRole[];
};

export const updateAllowedUsers = async (
  db: D1Database,
  entries: AllowedUser[],
  discord_server_name: string
): Promise<void> => {
  let statement = db
    .prepare('SELECT id FROM discord_servers WHERE name = ?')
    .bind(discord_server_name);
  const discord_server_id = (await statement.first()['id']) ?? null;

  if (!discord_server_id) {
    throw new Error(`Discord server ${discord_server_name} not found.`);
  }

  db.prepare('DELETE FROM allowed_users WHERE discord_server_id = ?')
    .bind(discord_server_id)
    .run();

  for (const entry of entries) {
    statement = db.prepare(`INSERT INTO allowed_users
      (friendcode, ign, discord_username, discord_server_id) VALUES (?, ?, ?, ?)
      ON CONFLICT (friendcode, discord_server_id) DO NOTHING`);

    statement.bind(
      entry.friendcode,
      entry.ign,
      entry.discord_username,
      discord_server_id
    );

    statement.run();
  }
};

export const updateAssignedRoles = async (
  db: D1Database,
  roles: DiscordAssignedRole[],
  serverId: string
): Promise<void> => {
  db.prepare('DELETE FROM discord_roles WHERE server_id = ?')
    .bind(serverId)
    .run();

  for (const role of roles) {
    const statement = db.prepare(`INSERT INTO discord_roles
      (role_id, role_name, username, server_id) VALUES (?, ?, ?, ?)
      ON CONFLICT (role_id, server_id) DO NOTHING`);

    statement.bind(role.id, role.role_name, role.username, role.server_id);
    statement.run();
  }
};

export const addDiscordServer = async (
  db: D1Database,
  discord_server: DiscordServer
): Promise<void> => {
  const statement = db.prepare(
    'INSERT INTO discord_servers (id, name) VALUES (?, ?) ON CONFLICT (id) DO NOTHING'
  );
  statement.bind(discord_server.id, discord_server.name);
  const query = await statement.run();
  if (!query.success) {
    throw new Error('Failed to add discord server.');
  }
};
