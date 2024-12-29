import { D1Database } from '@cloudflare/workers-types/experimental';
import {
  getAllowedUsersByFriendcodeAndServer,
  getAllowedUsersByUsernameAndServer,
  insertAllowedUser
} from '../database';

export const command = async (
  discordUsername: string,
  ign: string,
  friendcode: string,
  isMain: boolean,
  screenshotId: string,
  discordServerId: string,
  db: D1Database
): Promise<string> => {
  console.log(
    'Self Registering:',
    discordUsername,
    ign,
    friendcode,
    isMain,
    screenshotId
  );

  assertValidInputs(ign, friendcode, screenshotId);

  await assertNotAlreadyExisting(
    discordUsername,
    friendcode,
    discordServerId,
    isMain,
    db
  );

  const allowedUser = {
    friendcode,
    ign,
    discord_username: discordUsername,
    discord_server_id: discordServerId,
    is_main: isMain,
    screenshot_id: screenshotId,
    created_at: new Date().toISOString(),
    modified_at: new Date().toISOString()
  };

  await insertAllowedUser(db, allowedUser);

  return 'Account registered correctly';
};

const assertValidInputs = (
  ign: string,
  friendcode: string,
  screenshotId: string
) => {
  if (!ign || !friendcode || !screenshotId) {
    throw new Error('Missing required fields');
  }

  const friendcodeRegex = /^\d{16}$/;
  if (!friendcodeRegex.test(friendcode)) {
    throw new Error('Friend code must be a 16 digit string');
  }
  if (friendcode.length !== 16) {
    throw new Error('Friend code must be 16 characters long');
  }
};

const assertNotAlreadyExisting = async (
  discordUsername: string,
  friendcode: string,
  discordServerId: string,
  isMain: boolean,
  db: D1Database
) => {
  if (isMain) {
    const accounts = await getAllowedUsersByUsernameAndServer(
      db,
      discordUsername,
      discordServerId,
      true
    );

    if (accounts.length) {
      throw new Error(
        'Main account is already set, if you need to change it ask an admin'
      );
    }
  } else {
    const accounts = await getAllowedUsersByUsernameAndServer(
      db,
      discordUsername,
      discordServerId,
      false
    );

    if (accounts.length >= 3) {
      throw new Error('Maximum of 3 alts per user allowed');
    }
  }

  const accountsWithSameFC = await getAllowedUsersByFriendcodeAndServer(
    db,
    friendcode,
    discordServerId
  );

  if (accountsWithSameFC.length) {
    throw new Error('Friend code already registered');
  }
};
