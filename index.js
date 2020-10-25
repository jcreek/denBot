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

const queueTitle = '===== QUEUE =====';

let playerQueue = [];

client.login(config.token);
client.once('ready', () =>{
	console.log('denBot logged in successfully!');
})

/*
  * Commands:
  * q   - Join the queue
  * lq  - Leave the queue
  * sq  - Show the queue
  * cq  - Clear the queue
  * ru  - Remove a user from the queue
*/

function generateRandomCode() {
  const num1 = Math.floor((Math.random() * 9999) + 1);
  const num2 = Math.floor((Math.random() * 9999) + 1);

  return `${num1}-${num2}`;
}

function checkQueue(message) {
  if (playerQueue.length === config.maxqueuesize) {
    // Queue is full
    console.log('Queue is full');

    // Post a message to say the queue is complete
    message.channel.send(`The adventure is beginning - players should check their DMs\n${playerQueue.map((player, index) => `${index + 1} - ${player.username}`).join('\n')}`);

    try {
      // DM users
      const randomCode = generateRandomCode();
      playerQueue.forEach(player => {
        client.users.cache.get(player.id).send(`Here is your link code ${randomCode} - @${playerQueue[0].username} is making the lobby, have fun!`);
      });
    } catch (error) {
      console.log(error);
      message.channel.send(`There was an error, please let an admin know!\n${error}`);
    }

    // Clear the queue
    playerQueue = [];
    console.log('Emptied queue');
  }
  else if (playerQueue.length === 0) {
    message.channel.send('The queue is empty :(');
  }
  else {
    // Show queue after adding
    message.channel.send(`${queueTitle}\n${playerQueue.map((player, index) => `${index + 1} - ${player.username}`).join('\n')}`);
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

client.on('message', function (message) {
  // Ignore messages from the bot and that don't begin with the prefix
  if (message.author.bot) return;
  if (!message.content.startsWith(config.prefix)) return;

  const commandBody = message.content.slice(config.prefix.length);
  const args = commandBody.split(' ');
  const command = args.shift().toLowerCase();

  // Add to queue
  if (command === 'q' && !(playerQueue.includes(message.author))) {
    // Delete the message with the bot command
		message.delete();

		console.log(`${message.author.username} joined the queue.`);
		message.channel.send(`${message.author.username} joined the queue.`);

		playerQueue.push(message.author);

    checkQueue(message);
	}
	else if (command === 'q' && (playerQueue.includes(message.author))) {
		// Delete the message with the bot command
		message.delete();
		message.channel.send(`${message.author.username} is too keen, you're already in the queue mate!`);
  }

  // Remove from queue
	if(command === 'lq' && (playerQueue.includes(message.author))){
		// Delete the message with the bot command
		message.delete();

		console.log(`${message.author.username} left the queue.`);
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
		message.delete();
		message.channel.send(`${message.author.username} you can't leave the queue before you've joined it!`);
  }

  // Show the queue
	if(command === 'sq') {
		// Delete the message with the bot command
		message.delete();
		checkQueue(message);
	}

  // Clear the queue
	if(command === 'cq') {
		// Delete the message with the bot command
    message.delete();

    if (playerQueue.length === 0) {
      message.channel.send(`The queue is already empty...`);
      console.log(`${message.author.username} attmepted to clear the queue but it was already empty.`);
		}
		else {
			playerQueue = [];
			message.channel.send(`The queue has been cleared!`);
			console.log(`${message.author.username} cleared the queue.`);
		}
	}

  // Remove someone else from queue
  if (command === 'ru' && args[0]) {
    const user = getUserFromMention(args[0]);

    // Delete the message with the bot command
    message.delete();

    if ((playerQueue.includes(user))) {

      // Search for the user
      for(var i = 0; i < playerQueue.length; i++){
        console.log(i + ' ' + playerQueue[i].username);
        if ((playerQueue[i].username === user.username)){
          playerQueue.splice(i, 1);
          i--;
        }
      }

      message.channel.send(`${user.username} removed from queue.`);
      console.log(`${message.author.username} removed ${user.username} from queue.`);

      checkQueue(message);
    }
    else if (!(playerQueue.includes(user))) {
      message.channel.send(`${user.username} is not in the queue.`);
      console.log(`${message.author.username} attempted to remove ${user.username} from queue but they weren't in it.`);
    }
	}
});
