const Discord = require('discord.js');
const config = require('./config.json');
const client = new Discord.Client();

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
});
