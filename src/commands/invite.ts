export const command = (applicationId: string): string => {
  const inviteLink = `https://discord.com/oauth2/authorize?client_id=${applicationId}&scope=applications.commands`;
  console.log(`Generating invite link`, inviteLink);
  return inviteLink;
};
