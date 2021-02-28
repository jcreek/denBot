const { loggers } = require('winston');

module.exports = {
  checkQueue: function (
    message,
    playerQueue,
    playerVotes,
    logger,
    Discord,
    pokemonName,
    captainInGameName,
    config
  ) {
    if (
      playerQueue.length === config.maxqueuesize ||
      (playerQueue.length > 0 && playerQueue.length == playerVotes.length)
    ) {
      // Queue is full
      logger.info('Queue is full');

      // Post a message to say the queue is complete
      module.exports.sendEmbedMessage(
        logger,
        message,
        Discord,
        'Queue full',
        `The adventure is beginning - players should check their DMs\n${playerQueue
          .map((player, index) => `${index + 1} - ${player.username}`)
          .join('\n')}`
      );

      const randomCode = generateRandomCode();
      const baseMessage = `@${playerQueue[0].username} is making the lobby. Here is your link code ${randomCode}`;
      const adventureMessage =
        pokemonName === '' && captainInGameName === ''
          ? `${generateQueueTitle(playerQueue, config)}\n${baseMessage}`
          : `${generateQueueTitle(
              playerQueue,
              config
            )}\nPokemon: ${pokemonName}\nCaptain's IGN: ${captainInGameName}\n${baseMessage}`;

      try {
        // DM users
        playerQueue.forEach((player) => {
          message.client.users.cache.get(player.id).send(adventureMessage);
        });
      } catch (error) {
        logger.error('Tried to DM users: ', error);
        module.exports.sendEmbedMessage(
          logger,
          message,
          Discord,
          'An error occurred',
          `There was an error, please let an admin know!\n${error}`,
          '#DB4437'
        );
      }

      makeTempChannel(message, adventureMessage, playerQueue, logger);

      // Clear the queue and votes
      playerQueue = [];
      logger.info('Emptied queue');
      playerVotes = [];
      logger.info('Emptied votes');
      pokemonName = '';
      captainInGameName = '';
      logger.info('Emptied pokemon name and captain name');
    } else if (playerQueue.length === 0) {
      module.exports.sendEmbedMessage(
        logger,
        message,
        Discord,
        'Queue empty',
        'The queue is empty :('
      );
      pokemonName = '';
      captainInGameName = '';
    } else {
      // Show queue after adding
      let queueTitle = generateQueueTitle(playerQueue, config);
      if (pokemonName === '' && captainInGameName === '') {
        module.exports.sendEmbedMessage(
          logger,
          message,
          Discord,
          queueTitle,
          `${playerQueue.map((player, index) => `${index + 1} - ${player.username}`).join('\n')}`
        );
      } else {
        module.exports.sendEmbedMessage(
          logger,
          message,
          Discord,
          queueTitle,
          `**Pokemon**: ${pokemonName}\n**Captain's IGN**: ${captainInGameName}\n${playerQueue
            .map((player, index) => `${index + 1} - ${player.username}`)
            .join('\n')}`
        );
      }
    }
  },
  deleteChannel: function (message, channelName, logger) {
    try {
      // Get a Channel by Name
      const fetchedChannel = message.guild.channels.cache.find(
        (channel) => channel.name.toLowerCase() == channelName.toLowerCase()
      );

      logger.info(`Deleting temp channel ${channelName}`);
      fetchedChannel.delete();
    } catch (error) {
      logger.error(`Tried to delete channel ${channelName}: `, error);

      let names = [];
      message.guild.channels.cache.forEach((channel) => {
        names.push(channel.name);
      });
      logger.info(`Channel names in cache: ${names}`);
    }
  },
  getChannelName: function (username) {
    return `${username.toLowerCase().replace(' ', '-')}s-adventurers`;
  },
  getUserFromMention: function (mention, logger, message) {
    try {
      if (!mention) return;

      if (mention.startsWith('<@') && mention.endsWith('>')) {
        mention = mention.slice(2, -1);

        if (mention.startsWith('!')) {
          mention = mention.slice(1);
        }

        return message.client.users.cache.get(mention);
      }
    } catch (error) {
      logger.error('Tried to get users from mention: ', error);
    }
  },
  sendEmbedMessage: function (logger, message, Discord, title, description, colour = '#F4B400') {
    // For documentation see https://github.com/AnIdiotsGuide/discordjs-bot-guide/blob/master/first-bot/using-embeds-in-messages.md
    try {
      const embed = new Discord.MessageEmbed()
        .setTitle(title)
        .setColor(colour)
        .setDescription(description)
        .setFooter('This is a custom bot - if it goes down, tag Scruffy')
        .setThumbnail(
          'https://cdn.discordapp.com/icons/770039159506337802/a_510706276ebcf77e568900fa708e6c63.png?size=128'
        )
        .setTimestamp();

      message.channel.send(embed);
    } catch (error) {
      logger.error('Failed to send embed message', error);
      message.channel.send('There was a problem, sorry!');
    }
  },
};

function generateQueueTitle(playerQueue, config) {
  return `\n===== ADVENTURE QUEUE (${playerQueue.length}/${config.maxqueuesize}) =====`;
}

function generateRandomCode() {
  const num1 = Math.floor(Math.random() * 9999 + 1);
  const num2 = Math.floor(Math.random() * 9999 + 1);

  // Pad the start of the numbers so there's always four digits, including leading zeros
  return `${num1.toString().padStart(4, '0')}-${num2.toString().padStart(4, '0')}`;
}

function makeTempChannel(message, adventureMessage, playerQueue, logger) {
  const channelName = module.exports.getChannelName(playerQueue[0].username);
  let createdChannelId = '';
  let everyoneRole = message.guild.roles.cache.find((r) => r.name === '@everyone');

  let permissionOverwrites = [
    {
      id: everyoneRole.id,
      deny: ['VIEW_CHANNEL'],
    },
  ];

  playerQueue.forEach((player) => {
    permissionOverwrites.push({
      id: player.id,
      allow: ['VIEW_CHANNEL'],
    });
  });

  logger.info(`Making temp channel ${channelName}`);
  message.guild.channels
    .create(channelName, {
      type: 'text',
      permissionOverwrites: permissionOverwrites,
    })
    .then((createdChannel) => {
      createdChannelId = createdChannel.id;

      // Post in the channel
      createdChannel.send(adventureMessage);
      createdChannel.send(
        `Please delete this channel when you're finished with it using the ${config.prefix}dc command`
      );
    })
    .catch(logger.error);

  // try {
  //   // Delete the channel after the configured amount of minutes
  //   setTimeout(function(){ deleteChannel(message, channelName); }, (config.channeldeletetimeinminutes * 1000 * 60) );
  // } catch (error) {
  //   logger.error(`Tried to delete channel ${channelName} after timeout: `, error);
  // }
}
