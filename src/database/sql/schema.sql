DROP TABLE IF EXISTS allowed_users;
CREATE TABLE IF NOT EXISTS allowed_users (
    friendcode TEXT NOT NULL,
    ign TEXT NOT NULL,
    discord_username TEXT NOT NULL,
    discord_server_id TEXT NOT NULL,
    screenshot_id TEXT NOT NULL,
    is_main BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (friendcode, discord_server_id)
);

CREATE TABLE IF NOT EXISTS discord_servers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

DROP TABLE IF EXISTS discord_roles;
CREATE TABLE IF NOT EXISTS discord_roles (
    role_id TEXT NOT NULL,
    role_name TEXT NOT NULL,
    role_value INTEGER NOT NULL DEFAULT 1,
    username TEXT NOT NULL,
    server_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (role_id, server_id)
);
