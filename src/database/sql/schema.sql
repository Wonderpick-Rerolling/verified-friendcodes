CREATE TABLE IF NOT EXISTS allowed_users (
    friendcode TEXT NOT NULL,
    ign TEXT NOT NULL,
    discord_username TEXT NOT NULL,
    discord_server_id TEXT NOT NULL,
    PRIMARY KEY (friendcode, discord_server_id)
);

CREATE TABLE IF NOT EXISTS discord_servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    roles_channel_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS discord_roles (
    role_id TEXT NOT NULL,
    role_name TEXT NOT NULL,
    username TEXT NOT NULL,
    server_id TEXT NOT NULL,
    PRIMARY KEY (role_id, server_id)
);
