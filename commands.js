const {
  checkQueue,
  deleteChannel,
  getChannelName,
  getUserFromMention,
  sendEmbedMessage,
} = require('./helpers.js');

let playerQueue = [];
let playerVotes = [];
let pokemonName = '';
let captainInGameName = '';

module.exports = {
  matchCommand: function (Discord, config, logger, message, command, args) {
    switch (command) {
      case 'help':
        commandHelp(Discord, config, logger, message, command, args);
        break;
      case 'adminhelp':
        commandHelp(Discord, config, logger, message, command, args);
        break;
      case 'q':
        commandJoinQueue(Discord, config, logger, message, command, args);
        break;
      case 'lq':
        commandLeaveQueue(Discord, config, logger, message, command, args);
        break;
      case 'start':
        commandStartEarly(Discord, config, logger, message, command, args);
        break;
      case 'sq':
        commandShowQueue(Discord, config, logger, message, command, args);
        break;
      case 'cq':
        commandClearQueue(Discord, config, logger, message, command, args);
        break;
      case 'ru':
        commandRemoveUserFromQueue(Discord, config, logger, message, command, args);
        break;
      case 'dc':
        commandDeleteChannel(Discord, config, logger, message, command, args);
        break;
      default:
        message.channel.send('That command is not one I know yet!');
    }
  },
};

function commandHelp(Discord, config, logger, message, command, args) {
  const helpMessage = `
The commands available to you are:
\`${config.prefix}q\` - Join the queue
\`${config.prefix}q <pokemon> <ign>\` - Join the queue (first player can set the pokemon and their in-game name)
\`${config.prefix}lq\` - Leave the queue
\`${config.prefix}sq\` - Show the queue
\`${config.prefix}start\` - Vote to start the adventure early, without the full number of players (all players in the queue must use this to start early)
\`${config.prefix}dc\` - Delete an adventure channel (only the captain can use this)
  `;

  message.channel.send(helpMessage);
}

function commandAdminHelp(Discord, config, logger, message, command, args) {
  const helpMessage = `
The commands available to you are:
\`${config.prefix}q\` - Join the queue
\`${config.prefix}q <pokemon> <ign>\` - Join the queue (first player can set the pokemon and their in-game name)
\`${config.prefix}lq\` - Leave the queue
\`${config.prefix}sq\` - Show the queue
\`${config.prefix}start\` - Vote to start the adventure early, without the full number of players (all players in the queue must use this to start early)
\`${config.prefix}cq\` - Clear the queue (admin-only, not to be shared with normal users)
\`${config.prefix}ru\` - Remove a tagged user from the queue (admin-only, not to be shared with normal users)
\`${config.prefix}dc\` - Delete an adventure channel (only the captain can use this)
  `;

  message.channel.send(helpMessage);
}

function commandJoinQueue(Discord, config, logger, message, command, args) {
  if (!playerQueue.includes(message.author)) {
    // Delete the message with the bot command
    if (config.deletecommandstoggle) {
      message.delete();
    }

    logger.info(`${message.author.username} used command q in ${message.channel.name}`);

    logger.info(`${message.author.username} joined the queue.`);
    sendEmbedMessage(
      logger,
      message,
      Discord,
      'Queue in progress',
      `${message.author.username} joined the queue.`
    );

    playerQueue.push(message.author);

    if (playerQueue.length === 1 && args[0] && args[1]) {
      // First player can submit pokemon and in-game name
      pokemonName = args[0];
      captainInGameName = args[1];
    }

    checkQueue(
      message,
      playerQueue,
      playerVotes,
      logger,
      Discord,
      pokemonName,
      captainInGameName,
      config
    );
  } else if (playerQueue.includes(message.author)) {
    // Delete the message with the bot command
    if (config.deletecommandstoggle) {
      message.delete();
    }

    logger.info(`${message.author.username} used command q in ${message.channel.name}`);

    message.channel.send(
      `${message.author.username} is too keen, you're already in the queue mate!`
    );
  }
}

function commandLeaveQueue(Discord, config, logger, message, command, args) {
  if (playerQueue.includes(message.author)) {
    // Delete the message with the bot command
    if (config.deletecommandstoggle) {
      message.delete();
    }

    logger.info(`${message.author.username} used command lq in ${message.channel.name}`);

    for (var i = 0; i < playerQueue.length; i++) {
      if (playerQueue[i] === message.author) {
        playerQueue.splice(i, 1);
        i--;
      }
    }

    for (var i = 0; i < playerVotes.length; i++) {
      if (playerVotes[i] === message.author) {
        playerVotes.splice(i, 1);
        i--;
      }
    }

    logger.info(`${message.author.username} left the queue.`);
    sendEmbedMessage(
      logger,
      message,
      Discord,
      'Queue in progress',
      `${message.author.username} left the queue.`
    );

    checkQueue(
      message,
      playerQueue,
      playerVotes,
      logger,
      Discord,
      pokemonName,
      captainInGameName,
      config
    );
  } else if (!playerQueue.includes(message.author)) {
    // Delete the message with the bot command
    if (config.deletecommandstoggle) {
      message.delete();
    }

    logger.info(`${message.author.username} used command lq in ${message.channel.name}`);

    message.channel.send(
      `${message.author.username} you can't leave the queue before you've joined it!`
    );
  }
}

function commandStartEarly(Discord, config, logger, message, command, args) {
  // Vote to start early with only the users currently in the queue
  // Delete the message with the bot command
  if (config.deletecommandstoggle) {
    message.delete();
  }

  logger.info(`${message.author.username} used command ${command} in ${message.channel.name}`);

  if (playerQueue.length == 0) {
    message.channel.send(
      `You can only vote to start an adventure early if there is a queue. You can start a queue by using the command ${config.prefix}help`
    );
  } else if (!playerQueue.includes(message.author)) {
    message.channel.send(
      `You can only vote to start an adventure early if you are in the queue. You can join the queue by using the command ${config.prefix}q`
    );
  } else if (playerVotes.length == 0) {
    // First player to vote
    playerVotes.push(message.author);

    sendEmbedMessage(
      logger,
      message,
      Discord,
      'Voting to start early',
      `${message.author.username} voted to start the adventure.\nAll other players in the queue must also vote to start the adventure for it to begin without ${config.maxqueuesize} players.`
    );
  } else if (playerVotes.includes(message.author.username)) {
    sendEmbedMessage(
      logger,
      message,
      Discord,
      'Voting to start early',
      `${message.author.username} has already voted to start the adventure.\nAll other players in the queue must also vote to start the adventure for it to begin without ${config.maxqueuesize} players.`
    );
  } else if (playerVotes.length < config.maxqueuesize) {
    // Not the first player to vote
    playerVotes.push(message.author);

    if (playerVotes.length < playerQueue.length) {
      // Still not all players voted
      sendEmbedMessage(
        logger,
        message,
        Discord,
        'Voting to start early',
        `${message.author.username} voted to start the adventure.\nAll other players in the queue must also vote to start the adventure for it to begin without ${config.maxqueuesize} players.`
      );
    } else {
      // All players have voted, we can start the adventure early
      checkQueue(
        message,
        playerQueue,
        playerVotes,
        logger,
        Discord,
        pokemonName,
        captainInGameName,
        config
      );
    }
  }
}

function commandShowQueue(Discord, config, logger, message, command, args) {
  // Delete the message with the bot command
  if (config.deletecommandstoggle) {
    message.delete();
  }

  logger.info(`${message.author.username} used command sq in ${message.channel.name}`);

  checkQueue(
    message,
    playerQueue,
    playerVotes,
    logger,
    Discord,
    pokemonName,
    captainInGameName,
    config
  );
}

function commandClearQueue(Discord, config, logger, message, command, args) {
  // Delete the message with the bot command
  if (config.deletecommandstoggle) {
    message.delete();
  }

  logger.info(`${message.author.username} used command cq in ${message.channel.name}`);

  if (playerQueue.length === 0) {
    message.channel.send(`The queue is already empty...`);
    logger.info(
      `${message.author.username} attempted to clear the queue but it was already empty.`
    );
  } else {
    playerQueue = [];
    playerVotes = [];
    message.channel.send(`The queue has been cleared!`);
    logger.info(`${message.author.username} cleared the queue and the votes.`);
    pokemonName = '';
    captainInGameName = '';
    logger.info('Emptied pokemon name and captain name');
  }
}

function commandRemoveUserFromQueue(Discord, config, logger, message, command, args) {
  // Remove a tagged user from the queue
  if (args[0]) {
    // Delete the message with the bot command
    if (config.deletecommandstoggle) {
      message.delete();
    }

    try {
      const user = getUserFromMention(args[0], logger, message);
      logger.info(`${message.author.username} used command ru ${user} in ${message.channel.name}`);

      if (playerQueue.includes(user)) {
        // Search for the user
        for (var i = 0; i < playerQueue.length; i++) {
          if (playerQueue[i].username === user.username) {
            playerQueue.splice(i, 1);
            i--;
          }
        }

        for (var i = 0; i < playerVotes.length; i++) {
          if (playerVotes[i].username === user.username) {
            playerVotes.splice(i, 1);
            i--;
          }
        }

        message.channel.send(`${user.username} removed from queue.`);
        logger.info(`${message.author.username} removed ${user.username} from queue.`);

        checkQueue(
          message,
          playerQueue,
          playerVotes,
          logger,
          Discord,
          pokemonName,
          captainInGameName,
          config
        );
      } else if (!playerQueue.includes(user)) {
        message.channel.send(`${user.username} is not in the queue.`);
        logger.info(
          `${message.author.username} attempted to remove ${user.username} from queue but they weren't in it.`
        );
      }
    } catch (error) {
      logger.error(`Tried to remove user ${args[0]} from queue but got an error: ${error}`);
      message.channel.send(`Failed to remove ${args[0]} from the queue.`);
    }
  }
}

function commandDeleteChannel(Discord, config, logger, message, command, args) {
  logger.info(`${message.author.username} used command dc in ${message.channel.name}`);

  // Determine if they can delete the channel (i.e. it's their temporary one) - compare the name
  if (message.channel.name === getChannelName(message.author.username)) {
    deleteChannel(message, message.channel.name, logger);
    logger.info(`${message.author.username} deleted their adventure channel.`);
  } else {
    message.channel.send(`${message.author.username} is not allowed to delete this channel.`);
    logger.info(
      `${message.author.username} attempted to delete channel ${message.channel.name} but it's not their adventure channel.`
    );
  }
}
