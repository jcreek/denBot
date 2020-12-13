const { loggers } = require("winston");

module.exports = {
  sendEmbedMessage: function (logger, message, Discord, title, description, colour = '#F4B400') {
      // For documentation see https://github.com/AnIdiotsGuide/discordjs-bot-guide/blob/master/first-bot/using-embeds-in-messages.md
      try {
        const embed = new Discord.MessageEmbed()
          .setTitle(title)
          .setColor(colour)
          .setDescription(description)
          .setFooter('This is a custom bot - if it goes down, tag Scruffy')
          .setThumbnail('https://cdn.discordapp.com/icons/770039159506337802/a_510706276ebcf77e568900fa708e6c63.png?size=128')
          .setTimestamp();

        message.channel.send(embed);
      } catch (error) {
        logger.error('Failed to send embed message', error);
        message.channel.send('There was a problem, sorry!');
      }
    },
};
