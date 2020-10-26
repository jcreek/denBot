const Discord = require('discord.js');
const winston = require('winston');
const config = require('./config.json');
const client = new Discord.Client();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'user-service' },
  transports: [
    //
    // - Write all logs with level `error` and below to `error.log`
    // - Write all logs with level `info` and below to `combined.log`
    //
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
//
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}
let playerQueue = [];
let pokemonName = '';
let captainInGameName = '';

client.login(config.token);
client.once('ready', () =>{
	logger.log('info', 'denBot logged in successfully!');
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
  if (playerQueue.length === config.maxqueuesize) {
    // Queue is full
    logger.log('info', 'Queue is full');

    // Post a message to say the queue is complete
    message.channel.send(`The adventure is beginning - players should check their DMs\n${playerQueue.map((player, index) => `${index + 1} - ${player.username}`).join('\n')}`);

    try {
      // DM users
      const randomCode = generateRandomCode();
      playerQueue.forEach(player => {
        if (pokemonName === '' && captainInGameName === '') {
          client.users.cache.get(player.id).send(`${generateQueueTitle()}\nHere is your link code ${randomCode} - @${playerQueue[0].username} is making the lobby, have fun!`);
        }
        else {
          client.users.cache.get(player.id).send(`${generateQueueTitle()}\nPokemon: ${pokemonName}\nCaptain's IGN: ${captainInGameName}\nHere is your link code ${randomCode} - @${playerQueue[0].username} is making the lobby, have fun!`);
        }
      });
    } catch (error) {
      logger.log('error', error);
      message.channel.send(`There was an error, please let an admin know!\n${error}`);
    }

    makeTempChannel(message);

    // Clear the queue
    playerQueue = [];
    logger.log('info', 'Emptied queue');
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
	if (!mention) return;

	if (mention.startsWith('<@') && mention.endsWith('>')) {
		mention = mention.slice(2, -1);

		if (mention.startsWith('!')) {
			mention = mention.slice(1);
		}

		return client.users.cache.get(mention);
	}
}

function getChannelName(username) {
  return `${username}s-adventurers`;
}

function makeTempChannel(message) {
  const channelName = getChannelName(message.author.username);
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

  console.log(permissionOverwrites);
  message.guild.channels.create(channelName, {
    type: 'text',
    permissionOverwrites: permissionOverwrites,
  }).then(createdChannel => { createdChannelId = createdChannel.id; })
    .catch(logger.error);

  // Delete the channel after 20 seconds
  setTimeout(function(){ deleteChannel(message, createdChannelId); }, (config.channeldeletetimeinminutes * 1000) );
}

function deleteChannel(message, channelId) {
  const fetchedChannel = message.guild.channels.cache.get(channelId);
  fetchedChannel.delete();
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
		message.channel.send(`${message.author.username} is too keen, you're already in the queue mate!`);
  }

  // Leave the queue
	if(command === 'lq' && (playerQueue.includes(message.author))){
		// Delete the message with the bot command
		if (config.deletecommandstoggle) {
      message.delete();
    }

		logger.log('info', `${message.author.username} left the queue.`);
		message.channel.send(`${message.author.username} left the queue.`);

		for( var i = 0; i < playerQueue.length; i++){
			if ( playerQueue[i] === message.author) {
				playerQueue.splice(i, 1);
				i--;
			}
		}

		checkQueue(message);
	}
	else if (command === 'lq' && !(playerQueue.includes(message.author))) {
		// Delete the message with the bot command
		if (config.deletecommandstoggle) {
      message.delete();
    }
		message.channel.send(`${message.author.username} you can't leave the queue before you've joined it!`);
  }

  // Show the queue
	if(command === 'sq') {
		// Delete the message with the bot command
		if (config.deletecommandstoggle) {
      message.delete();
    }
		checkQueue(message);
	}

  // Clear the queue
	if(command === 'cq') {
		// Delete the message with the bot command
    if (config.deletecommandstoggle) {
      message.delete();
    }

    if (playerQueue.length === 0) {
      message.channel.send(`The queue is already empty...`);
      logger.log('info', `${message.author.username} attempted to clear the queue but it was already empty.`);
		}
		else {
			playerQueue = [];
			message.channel.send(`The queue has been cleared!`);
			logger.log('info', `${message.author.username} cleared the queue.`);
		}
	}

  // Remove a tagged user from the queue
  if (command === 'ru' && args[0]) {
    const user = getUserFromMention(args[0]);

    // Delete the message with the bot command
    if (config.deletecommandstoggle) {
      message.delete();
    }

    if ((playerQueue.includes(user))) {

      // Search for the user
      for(var i = 0; i < playerQueue.length; i++){
        if ((playerQueue[i].username === user.username)){
          playerQueue.splice(i, 1);
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
    // todo - add logic here to determine if they can delete the channel (i.e. it's their temporary one) - compare the name
    if (message.channel.name === getChannelName(message.author.username)) {
      deleteChannel(message.channel.id)
      logger.log('info', `${message.author.username} deleted their adventure channel.`);
    }
    else {
      message.channel.send(`${message.author.username} is not allowed to delete this channel.`);
      logger.log('info', `${message.author.username} attempted to delete channel ${message.channel.id} but it's not their adventure channel.`);
    }
  }
});
