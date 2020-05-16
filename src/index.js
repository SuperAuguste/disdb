require("dotenv").config();

const fs = require("fs");
const path = require("path");
const Discord = require("discord.js");

const client = new Discord.Client();

const apple = require('app.js');

client.on("ready", () => {console.log("Ready!")});

function chunks (buffer, chunkSize) {
	assert(Buffer.isBuffer(buffer),           'Buffer is required');
	assert(!isNaN(chunkSize) && chunkSize > 0, 'Chunk size should be positive number');

	var result = [];
	var len = buffer.length;
	var i = 0;

	while (i < len) {
		result.push(buffer.slice(i, i += chunkSize));
	}

	return result;
}

function assert (cond, err) {
	if (!cond) {
		throw new Error(err);
	}
}

client.on("message", async message => {

	if (message.content === "/delete") {
		const messages = (await message.channel.messages.fetch()).array();

		for (const cmessage of messages) {
			if (cmessage.deletable) cmessage.delete();
		}

		message.reply("I oblige, master.");
	} else if (message.content === "/upload_test") {
		var i = 0;
		const file_data = fs.readFileSync(path.join(__dirname, "..", "test", "inkscape.exe"));
		const chonks = chunks(file_data, 8388119);

		for (const chunk of chonks) {
			message.channel.send(`inkscape.exe, part ${i + 1}`, {
				files: [
					chunk
				]
			});

			i++;
		}
	}

});

client.login(process.env.TOKEN);
