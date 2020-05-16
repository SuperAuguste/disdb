require("dotenv").config();

const Discord = require("discord.js");

const client = new Discord.Client();

client.on("message", message => {

	if (message.content === "dorito") {
		message.reply("doritooooo");
	}
	if (message.content === "dorito?") {
		message.reply("yus doritooooo");
	}
	if (message.content === "sauce") {
		message.channel.send("Here sauce", {
			files: [
				'./src/index.js'
			]
		});
	}
});

client.login(process.env.TOKEN);
