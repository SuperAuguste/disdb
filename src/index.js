require("dotenv").config();

const Discord = require("discord.js");

const client = new Discord.Client();

client.on("message", message => {

	if (message.content === "dorito")
		message.reply("doritooooo");

});

client.login(process.env.TOKEN);
