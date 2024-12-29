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
  screenshot_id: string;
  is_main: boolean;
  created_at: string;
  modified_at: string;
};

export type DiscordServer = {
  id: string;
  name: string;
};

export type DiscordAssignedRole = {
  id: string;
  role_name: string;
  role_value: number;
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
  console.log('Fetching allowed users:', discordServerName, minimumRole);

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

    console.log('Filtering allowed users:', allowed_users, userRoles);
    return allowed_users.filter(entry =>
      hasValidRole(entry, userRoles, minimumRole)
    );
  }

  return allowed_users;
};

export const getAllowedUsersByUsernameAndServer = async (
  db: D1Database,
  discordUsername: string,
  discordServerId: string,
  isMain?: boolean
): Promise<AllowedUser[]> => {
  let statement: D1PreparedStatement;
  if (isMain === undefined) {
    statement = db
      .prepare(
        'SELECT * FROM allowed_users WHERE discord_username = ? AND discord_server_id = ?'
      )
      .bind(discordUsername, discordServerId);
  } else {
    statement = db
      .prepare(
        'SELECT * FROM allowed_users WHERE discord_username = ? AND discord_server_id = ? AND is_main = ?'
      )
      .bind(discordUsername, discordServerId, isMain);
  }

  const query = await statement.run();
  if (query.error || !query.success) {
    throw new Error('Failed to fetch allowed_users.');
  }

  return query.results as AllowedUser[];
};

export const getAllowedUsersByFriendcodeAndServer = async (
  db: D1Database,
  friendcode: string,
  discordServerId: string
): Promise<AllowedUser[]> => {
  const statement = db
    .prepare(
      'SELECT * FROM allowed_users WHERE friendcode = ? AND discord_server_id = ?'
    )
    .bind(friendcode, discordServerId);

  const query = await statement.run();
  if (query.error || !query.success) {
    throw new Error('Failed to fetch allowed_users.');
  }

  return query.results as AllowedUser[];
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
  const statement = db
    .prepare('SELECT * FROM discord_servers WHERE name = ?')
    .bind(discordServerName);
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

export const getMaximumRoleByUsernameAndServer = async (
  db: D1Database,
  username: string,
  serverId: string
): Promise<DiscordAssignedRole | null> => {
  const query = await db
    .prepare(
      `
      SELECT * FROM discord_roles
      WHERE username = ? AND server_id = ?
      ORDER BY role_value DESC LIMIT 1`
    )
    .bind(username, serverId)
    .run();
  if (query.error || !query.success) {
    throw new Error('Failed to fetch discord_roles.');
  }

  return (query.results[0] ?? null) as DiscordAssignedRole | null;
};

export const updateAllowedUsers = async (
  db: D1Database,
  entries: AllowedUser[],
  discord_server_id: string
): Promise<void> => {
  db.prepare('DELETE FROM allowed_users WHERE discord_server_id = ?')
    .bind(discord_server_id)
    .run();

  for (const entry of entries) {
    console.log('Adding allowed user:', entry);

    let statement = db
      .prepare(
        `INSERT INTO allowed_users
      (friendcode, ign, discord_username, discord_server_id) VALUES (?, ?, ?, ?)
      ON CONFLICT (friendcode, discord_server_id) DO NOTHING`
      )
      .bind(
        entry.friendcode,
        entry.ign,
        entry.discord_username,
        discord_server_id
      );

    await statement.run();
  }
};

export const insertAllowedUser = async (
  db: D1Database,
  entry: AllowedUser
): Promise<void> => {
  const statement = db
    .prepare(
      `INSERT INTO allowed_users
    (friendcode, ign, discord_username, discord_server_id, screenshot_id, is_main, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (friendcode, discord_server_id) DO NOTHING`
    )
    .bind(
      entry.friendcode,
      entry.ign,
      entry.discord_username,
      entry.discord_server_id,
      entry.screenshot_id,
      entry.is_main,
      entry.created_at,
      entry.modified_at
    );
  await statement.run();
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
    const statement = db
      .prepare(
        `INSERT INTO discord_roles
      (role_id, role_name, role_value, username, server_id, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (role_id, server_id) DO UPDATE SET modified_at = CURRENT_TIMESTAMP`
      )
      .bind(
        role.id,
        role.role_name,
        role.role_value,
        role.username,
        role.server_id,
        new Date().toISOString(),
        new Date().toISOString()
      );
    await statement.run();
  }
};

export const addDiscordServer = async (
  db: D1Database,
  discord_server: DiscordServer
): Promise<void> => {
  const statement = db
    .prepare(
      'INSERT INTO discord_servers (id, name) VALUES (?, ?) ON CONFLICT (id) DO NOTHING'
    )
    .bind(discord_server.id, discord_server.name);
  const query = await statement.run();
  if (!query.success) {
    throw new Error('Failed to add discord server.');
  }
};
