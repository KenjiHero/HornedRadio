/**
 * Module Imports
 */
const {
  Client,
  Collection,
  GatewayIntentBits,
  ActivityType,
} = require("discord.js");
const { readdirSync } = require("fs");
const { join } = require("path");
const { TOKEN, PREFIX } = require("./util/Utils");

/**
 * Client Setup
 */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();
client.prefix = PREFIX;
client.queue = new Map();

const cooldowns = new Collection();
const escapeRegex = (str) =>
  str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Client Events
 */
client.once("ready", () => {
  console.log(`${client.user.username} ready!`);

  client.user.setPresence({
    activities: [
      { name: "Work in Progress", type: ActivityType.Listening },
    ],
    status: "online",
  });
});

client.on("warn", console.log);
client.on("error", console.error);

/**
 * Import Commands
 */
const commandFiles = readdirSync(join(__dirname, "commands")).filter((f) =>
  f.endsWith(".js")
);

for (const file of commandFiles) {
  const command = require(join(__dirname, "commands", file));
  client.commands.set(command.name, command);
}

/**
 * Message Handler
 */
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const prefixRegex = new RegExp(
    `^(<@!?${client.user.id}>|${escapeRegex(PREFIX)})\\s*`
  );

  if (!prefixRegex.test(message.content)) return;

  const [, matchedPrefix] = message.content.match(prefixRegex);

  const args = message.content
    .slice(matchedPrefix.length)
    .trim()
    .split(/ +/);

  const commandName = args.shift().toLowerCase();

  const command =
    client.commands.get(commandName) ||
    client.commands.find(
      (cmd) => cmd.aliases && cmd.aliases.includes(commandName)
    );

  if (!command) return;

  /**
   * Cooldowns
   */
  if (!cooldowns.has(command.name)) {
    cooldowns.set(command.name, new Collection());
  }

  const now = Date.now();
  const timestamps = cooldowns.get(command.name);
  const cooldownAmount = (command.cooldown || 1) * 1000;

  if (timestamps.has(message.author.id)) {
    const expirationTime =
      timestamps.get(message.author.id) + cooldownAmount;

    if (now < expirationTime) {
      const timeLeft = (expirationTime - now) / 1000;
      return message.reply({
        content: `Please wait ${timeLeft.toFixed(
          1
        )} more second(s) before reusing the \`${command.name}\` command.`,
        allowedMentions: { repliedUser: false },
      });
    }
  }

  timestamps.set(message.author.id, now);
  setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

  try {
    await command.execute(message, args);
  } catch (error) {
    console.error(error);
    message.reply({
      content: "There was an error executing that command.",
      allowedMentions: { repliedUser: false },
    });
  }
});

/**
 * Login
 */
client.login(TOKEN);
