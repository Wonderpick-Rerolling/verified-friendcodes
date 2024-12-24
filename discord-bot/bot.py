import discord
from discord.ext import commands
import csv
import os
from github import Github
from datetime import datetime
import re
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    token: str
    github_token: str
    repo_name: str
    csv_path: str = ""
    channel_name: str

class IGNBot(commands.Bot):
    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True
        super().__init__(command_prefix='!', intents=intents)

        # Initialize GitHub client
        self.gh = Github(GITHUB_TOKEN)
        self.repo = self.gh.get_repo(REPO_NAME)

        # Create or load CSV file
        self.csv_headers = ['friendcode', 'ign', 'discord_id', 'discord_role']
        self.ensure_csv_exists()

    async def setup_hook(self):
        print(f'{self.user} has connected to Discord!')

    def ensure_csv_exists(self):
        if not os.path.exists(CSV_PATH):
            with open(CSV_PATH, 'w', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(self.csv_headers)

    def parse_message(self, message):
        """
        Parse a message to extract friend codes and IGNs.
        Returns a list of tuples (friendcode, ign)
        """
        # Simple regex patterns - adjust based on your actual format
        fc_pattern = r'(?:SW-)?(\d{4}-\d{4}-\d{4})'
        ign_pattern = r'IGN:?\s*([A-Za-z0-9_]+)'

        friendcodes = re.findall(fc_pattern, message.content)
        igns = re.findall(ign_pattern, message.content)

        # Zip the found friendcodes and IGNs
        return list(zip(friendcodes, igns))

    def update_csv(self, new_entries):
        """
        Update the CSV file with new entries
        """
        existing_entries = []

        # Read existing entries
        if os.path.exists(CSV_PATH):
            with open(CSV_PATH, 'r', newline='') as f:
                reader = csv.reader(f)
                next(reader)  # Skip header
                existing_entries = list(reader)

        # Add new entries
        with open(CSV_PATH, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(self.csv_headers)
            writer.writerows(existing_entries)
            writer.writerows(new_entries)

    def upload_to_github(self):
        """
        Upload the updated CSV to GitHub
        """
        with open(CSV_PATH, 'r') as file:
            content = file.read()

        # Try to get the file first
        try:
            file = self.repo.get_contents(CSV_PATH)
            self.repo.update_file(
                CSV_PATH,
                f"Update player data - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
                content,
                file.sha
            )
        except Exception:
            # File doesn't exist yet, create it
            self.repo.create_file(
                CSV_PATH,
                f"Initial player data - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
                content
            )

    async def on_message(self, message):
        # Ignore messages from the bot itself
        if message.author == self.user:
            return

        # Check if message is in the correct channel
        if message.channel.name == CHANNEL_NAME:
            # Parse the message
            entries = self.parse_message(message)

            if entries:
                new_rows = []
                for fc, ign in entries:
                    # Get the author's top role
                    top_role = message.author.top_role.name

                    # Create a new row
                    new_rows.append([
                        fc,
                        ign,
                        str(message.author.id),
                        top_role
                    ])

                # Update CSV and upload to GitHub
                self.update_csv(new_rows)
                self.upload_to_github()

                # Send confirmation
                await message.add_reaction('✅')
            else:
                # If no valid entries found
                await message.add_reaction('❌')

        await self.process_commands(message)

# Create and run the bot
bot = IGNBot()
bot.run(TOKEN)