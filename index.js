const Discord = require('discord.js');
const winston = require('winston');
const Elasticsearch = require('winston-elasticsearch');
const config = require('./config.json');
const client = new Discord.Client();

const { format } = winston;
const { combine, timestamp } = format;

let env = 'dev';
if (process.env.NODE_ENV === 'production') {
  env = 'prod';
}

// Custom format function that will look for an error object and log out the stack and if
// its not production, the error itself
const myFormat = format.printf((info) => {
  const { timestamp: tmsmp, level, message, error, ...rest } = info;
  let log = `${tmsmp} - ${level}:\t${message}`;
  // Only if there is an error
  if ( error ) {
    if ( error.stack) log = `${log}\n${error.stack}`;
    if (process.env.NODE_ENV !== 'production') log = `${log}\n${JSON.stringify(error, null, 2)}`;
  }
  // Check if rest is object
  if ( !( Object.keys(rest).length === 0 && rest.constructor === Object ) ) {
    log = `${log}\n${JSON.stringify(rest, null, 2)}`;
  }
  return log;
});

const esTransportOpts = {
  level: 'info',
  indexPrefix: 'logs_denbot',
  clientOpts: {
      host: config.elasticsearch.elasticsearch_address,
      log: 'info'
  },
  transformer: logData => {
      return {
        timestamp: new Date().toISOString(),
        severity: logData.level,
        message: logData.message,
        meta: {
          app: 'denBot',
          env: env,
          stack: logData.meta.stack
        }
      }
  }
};

const logger = winston.createLogger({
  level: 'info',
  format: combine(
    winston.format.errors({ stack: true }), // <-- use errors format
    winston.format.timestamp(),
    winston.format.prettyPrint(),
    myFormat,
    winston.format.json()
  ),
  defaultMeta: { service: 'user-service' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new Elasticsearch(esTransportOpts)
  ],
});

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
//if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
//}

let playerQueue = [];
let playerVotes = [];
let pokemonName = '';
let captainInGameName = '';

client.login(config.token);
client.once('ready', () =>{
  logger.info('denBot logged in successfully!');
})

/*
  * Commands:
  * q               - Join the queue
  * q pokemon ign   - Join the queue (first player can set the pokemon and their in-game name)
  * lq              - Leave the queue
  * sq              - Show the queue
  * cq              - Clear the queue
  * ru              - Remove a tagged user from the queue
  * dc              - Delete an adventure channel (only the captain can use this)
*/

function generateQueueTitle() {
  return `\n===== ADVENTURE QUEUE (${playerQueue.length}/${config.maxqueuesize}) =====`;
}

function generateRandomCode() {
  const num1 = Math.floor((Math.random() * 9999) + 1);
  const num2 = Math.floor((Math.random() * 9999) + 1);

  // Pad the start of the numbers so there's always four digits, including leading zeros
  return `${num1.toString().padStart(4, '0')}-${num2.toString().padStart(4, '0')}`;
}

function checkQueue(message) {
  if (playerQueue.length === config.maxqueuesize || (playerQueue.length > 0 && playerQueue.length == playerVotes.length)) {
    // Queue is full
    logger.log('info', 'Queue is full');

    // Post a message to say the queue is complete
    message.channel.send(`The adventure is beginning - players should check their DMs\n${playerQueue.map((player, index) => `${index + 1} - ${player.username}`).join('\n')}`);

    const randomCode = generateRandomCode();
    const baseMessage = `@${playerQueue[0].username} is making the lobby. Here is your link code ${randomCode}`;
    const adventureMessage = (pokemonName === '' && captainInGameName === '')
      ? `${generateQueueTitle()}\n${baseMessage}`
      : `${generateQueueTitle()}\nPokemon: ${pokemonName}\nCaptain's IGN: ${captainInGameName}\n${baseMessage}`;

    try {
      // DM users
      playerQueue.forEach(player => {
        client.users.cache.get(player.id).send(adventureMessage);
      });
    } catch (error) {
      logger.error('Tried to DM users: ', error);
      message.channel.send(`There was an error, please let an admin know!\n${error}`);
    }

    makeTempChannel(message, adventureMessage);

    // Clear the queue and votes
    playerQueue = [];
    logger.log('info', 'Emptied queue');
    playerVotes = [];
    logger.log('info', 'Emptied votes');
  }
  else if (playerQueue.length === 0) {
    message.channel.send('The queue is empty :(');
    pokemonName = '';
    captainInGameName = '';
  }
  else {
    // Show queue after adding
    if (pokemonName === '' && captainInGameName === '') {
      message.channel.send(`${generateQueueTitle()}\n${playerQueue.map((player, index) => `${index + 1} - ${player.username}`).join('\n')}`);
    }
    else {
      message.channel.send(`${generateQueueTitle()}\nPokemon: ${pokemonName}\nCaptain's IGN: ${captainInGameName}\n${playerQueue.map((player, index) => `${index + 1} - ${player.username}`).join('\n')}`);
    }
  }
}

function getUserFromMention(mention) {
	try {
    if (!mention) return;

    if (mention.startsWith('<@') && mention.endsWith('>')) {
      mention = mention.slice(2, -1);

      if (mention.startsWith('!')) {
        mention = mention.slice(1);
      }

      return client.users.cache.get(mention);
    }
  } catch (error) {
    logger.error('Tried to get users from mention: ', error);
  }
}

function getChannelName(username) {
  return `${username.toLowerCase().replace(' ', '-')}s-adventurers`;
}

function makeTempChannel(message, adventureMessage) {
  const channelName = getChannelName(playerQueue[0].username);
  let createdChannelId = '';
  let everyoneRole = message.guild.roles.cache.find(r => r.name === '@everyone');

  let permissionOverwrites = [{
    id: everyoneRole.id,
    deny: ['VIEW_CHANNEL'],
    },
  ];

  playerQueue.forEach(player => {
    permissionOverwrites.push({
      id: player.id,
      allow: ['VIEW_CHANNEL'],
    });
  });

  logger.info(`Making temp channel ${channelName}`)
  message.guild.channels.create(channelName, {
    type: 'text',
    permissionOverwrites: permissionOverwrites,
  }).then(createdChannel => {
    createdChannelId = createdChannel.id;

    // Post in the channel
    createdChannel.send(adventureMessage);
    createdChannel.send(`Please delete this channel when you're finished with it using the ${config.prefix}dc command`);
  })
    .catch(logger.error);

  // try {
  //   // Delete the channel after the configured amount of minutes
  //   setTimeout(function(){ deleteChannel(message, channelName); }, (config.channeldeletetimeinminutes * 1000 * 60) );
  // } catch (error) {
  //   logger.error(`Tried to delete channel ${channelName} after timeout: `, error);
  // }
}

function deleteChannel(message, channelName) {
  try {
    // Get a Channel by Name
    const fetchedChannel = message.guild.channels.cache.find(channel => channel.name.toLowerCase() == channelName.toLowerCase());

    logger.info(`Deleting temp channel ${channelName}`)
    fetchedChannel.delete();
  } catch (error) {
    logger.error(`Tried to delete channel ${channelName}: `, error);

    let names = [];
    message.guild.channels.cache.forEach(channel => {
      names.push(channel.name);
    });
    logger.info(`Channel names in cache: ${names}`);
  }
}

client.on('message', function (message) {
  // Ignore messages from the bot and that don't begin with the prefix, and do not run in DMs to bot
  if (message.author.bot) return;
  if (!message.content.startsWith(config.prefix)) return;
  if (message.channel instanceof Discord.DMChannel) return;

  const commandBody = message.content.slice(config.prefix.length);
  const args = commandBody.split(' ');
  const command = args.shift().toLowerCase();

  // Join the queue
  if (command === 'q' && !(playerQueue.includes(message.author))) {
    // Delete the message with the bot command
    if (config.deletecommandstoggle) {
      message.delete();
    }

    logger.info(`${message.author.username} used command q in ${message.channel.name}`);

		logger.log('info', `${message.author.username} joined the queue.`);
		message.channel.send(`=====\n${message.author.username} joined the queue.`);

    playerQueue.push(message.author);

    if (playerQueue.length === 1 && args[0] && args[1]) {
      // First player can submit pokemon and in-game name
      pokemonName = args[0];
      captainInGameName = args[1];
    }

    checkQueue(message);
	}
	else if (command === 'q' && (playerQueue.includes(message.author))) {
		// Delete the message with the bot command
		if (config.deletecommandstoggle) {
      message.delete();
    }

    logger.info(`${message.author.username} used command q in ${message.channel.name}`);

		message.channel.send(`${message.author.username} is too keen, you're already in the queue mate!`);
  }

  // Leave the queue
	if(command === 'lq' && (playerQueue.includes(message.author))){
		// Delete the message with the bot command
		if (config.deletecommandstoggle) {
      message.delete();
    }

    logger.info(`${message.author.username} used command lq in ${message.channel.name}`);

		for( var i = 0; i < playerQueue.length; i++){
			if ( playerQueue[i] === message.author) {
				playerQueue.splice(i, 1);
				i--;
			}
    }

    for( var i = 0; i < playerVotes.length; i++){
			if ( playerVotes[i] === message.author) {
				playerVotes.splice(i, 1);
				i--;
			}
    }

    logger.log('info', `${message.author.username} left the queue.`);
		message.channel.send(`${message.author.username} left the queue.`);

		checkQueue(message);
	}
	else if (command === 'lq' && !(playerQueue.includes(message.author))) {
		// Delete the message with the bot command
		if (config.deletecommandstoggle) {
      message.delete();
    }

    logger.info(`${message.author.username} used command lq in ${message.channel.name}`);

		message.channel.send(`${message.author.username} you can't leave the queue before you've joined it!`);
  }

  // Vote to start early with only the users currently in the queue
  if(command === 'start') {
    // Delete the message with the bot command
    if (config.deletecommandstoggle) {
      message.delete();
    }

    logger.info(`${message.author.username} used command ${command} in ${message.channel.name}`);

    if(playerQueue.length == 0) {
      message.channel.send(`You can only vote to start an adventure early if there is a queue. You can start a queue by using the command ${config.prefix}help`);
    }
    else if (!playerQueue.includes(message.author)) {
      message.channel.send(`You can only vote to start an adventure early if you are in the queue. You can join the queue by using the command ${config.prefix}q`);
    }
    else if(playerVotes.length == 0) {
      // First player to vote
      playerVotes.push(message.author);

      message.channel.send(`=====\n${message.author.username} voted to start the adventure.\nAll other players in the queue must also vote to start the adventure for it to begin without ${config.maxqueuesize} players.`);
    }
    else if (playerVotes.includes(message.author.username)) {
      message.channel.send(`=====\n${message.author.username} has already voted to start the adventure.\nAll other players in the queue must also vote to start the adventure for it to begin without ${config.maxqueuesize} players.`);
    }
    else if (playerVotes.length < config.maxqueuesize) {
      // Not the first player to vote
      playerVotes.push(message.author);

      if (playerVotes.length < playerQueue.length) {
        // Still not all players voted
        message.channel.send(`=====\n${message.author.username} voted to start the adventure.\nAll other players in the queue must also vote to start the adventure for it to begin without ${config.maxqueuesize} players.`);
      }
      else {
        // All players have voted, we can start the adventure early
        checkQueue(message);
      }
    }
  }

  // Show the queue
	if(command === 'sq') {
		// Delete the message with the bot command
		if (config.deletecommandstoggle) {
      message.delete();
    }

    logger.info(`${message.author.username} used command sq in ${message.channel.name}`);

		checkQueue(message);
	}

  // Clear the queue
	if(command === 'cq') {
		// Delete the message with the bot command
    if (config.deletecommandstoggle) {
      message.delete();
    }

    logger.info(`${message.author.username} used command cq in ${message.channel.name}`);

    if (playerQueue.length === 0) {
      message.channel.send(`The queue is already empty...`);
      logger.log('info', `${message.author.username} attempted to clear the queue but it was already empty.`);
		}
    else {
			playerQueue = [];
			playerVotes = [];
			message.channel.send(`The queue has been cleared!`);
			logger.log('info', `${message.author.username} cleared the queue and the votes.`);
		}
	}

  // Remove a tagged user from the queue
  if (command === 'ru' && args[0]) {
    const user = getUserFromMention(args[0]);

    // Delete the message with the bot command
    if (config.deletecommandstoggle) {
      message.delete();
    }

    logger.info(`${message.author.username} used command ru in ${message.channel.name}`);

    if ((playerQueue.includes(user))) {

      // Search for the user
      for(var i = 0; i < playerQueue.length; i++){
        if ((playerQueue[i].username === user.username)){
          playerQueue.splice(i, 1);
          i--;
        }
      }

      for( var i = 0; i < playerVotes.length; i++){
			if ( playerVotes[i].username === user.username) {
				playerVotes.splice(i, 1);
				i--;
			}
    }

      message.channel.send(`${user.username} removed from queue.`);
      logger.log('info', `${message.author.username} removed ${user.username} from queue.`);

      checkQueue(message);
    }
    else if (!(playerQueue.includes(user))) {
      message.channel.send(`${user.username} is not in the queue.`);
      logger.log('info', `${message.author.username} attempted to remove ${user.username} from queue but they weren't in it.`);
    }
  }

  if (command === 'dc') {
    logger.info(`${message.author.username} used command dc in ${message.channel.name}`);

    // Determine if they can delete the channel (i.e. it's their temporary one) - compare the name
    if (message.channel.name === getChannelName(message.author.username)) {
      deleteChannel(message, message.channel.name)
      logger.log('info', `${message.author.username} deleted their adventure channel.`);
    }
    else {
      message.channel.send(`${message.author.username} is not allowed to delete this channel.`);
      logger.log('info', `${message.author.username} attempted to delete channel ${message.channel.name} but it's not their adventure channel.`);
    }
  }

  if (command === 'help') {
    let msg = `
The commands available to you are:
- ${config.prefix}q   - Join the queue
- ${config.prefix}q <pokemon> <ign>   - Join the queue (first player can set the pokemon and their in-game name)
- ${config.prefix}lq  - Leave the queue
- ${config.prefix}sq  - Show the queue
- ${config.prefix}start - Vote to start the adventure early, without the full number of players (all players in the queue must use this to start early)
- ${config.prefix}dc  - Delete an adventure channel (only the captain can use this)
    `;

    message.channel.send(msg);
  }

  if (command === 'adminhelp') {
    let msg = `
The commands available to you are:
- ${config.prefix}q   - Join the queue
- ${config.prefix}q <pokemon> <ign>   - Join the queue (first player can set the pokemon and their in-game name)
- ${config.prefix}lq  - Leave the queue
- ${config.prefix}sq  - Show the queue
- ${config.prefix}start - Vote to start the adventure early, without the full number of players (all players in the queue must use this to start early)
- ${config.prefix}cq  - Clear the queue (admin-only, not to be shared with normal users)
- ${config.prefix}ru  - Remove a tagged user from the queue (admin-only, not to be shared with normal users)
- ${config.prefix}dc  - Delete an adventure channel (only the captain can use this)
    `;

    message.channel.send(msg);
  }
});
