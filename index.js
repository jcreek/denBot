const Discord = require("discord.js");
const config = require("./config.json");

const client = new Discord.Client();

client.login(config.token);
client.once('ready', () =>{
	console.log('denBot logged in successfully!');
})
