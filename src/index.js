require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const Discord = require("discord.js");

let random_garbage;
const app = express();

app.use(require("express-fileupload")());

const client = new Discord.Client();

client.on("ready", () => {
	
	console.log("Ready!");

	for (const guild of client.guilds.cache.array()) {
		random_garbage = guild.channels.cache.array().find(_ => _.name == "random-garbage");
	}

});

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

function uploadBuffer (channel, name, buffer) {
	let i = 0;
	const chonks = chunks(buffer, 8388119);
	const random = Math.random().toString(36).replace("0.", "");

	for (const chunk of chonks) {
		channel.send(`UPLOAD ${name}_${random}, part ${i + 1} / ${chonks.length} (${chonks.length - i - 1} seconds remaining)`, {
			files: [
				chunk
			]
		});

		i++;
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
		const file_data = fs.readFileSync(path.join(__dirname, "..", "test", "inkscape.exe"));
		uploadBuffer(message.channel, "inkscape.exe (Windows)", file_data);
	} else if (message.content.startsWith("/download")) {
		const messages = (await message.channel.messages.fetch()).array();
		let filename = message.content.substring(("/download").length);

		let arrthingy = [];
		for (const cmessage of messages) {
			if (cmessage.content.startsWith("UPLOAD") && cmessage.content.includes(filename)) {
				let partnumber = parseInt(cmessage.content.match(/\d+ \/ /g).pop().pop().pop());
				arrthingy.push([cmessage.attachments.array()[0].attachment, partnumber]);
			}
		}
		arrthingy.sort((a, b) => { return b[1]-a[1]; });
		arrthingy.map((a) => Buffer.from(a[0]));
		var buf = Buffer.concat(arr);
	}
});

app.get("/", (req, res) => {

	res.render("upload.ejs", {});

});

app.post("/upload", (req, res) => {

	uploadBuffer(random_garbage, req.files.foo.name, req.files.foo.data);

});

client.login(process.env.TOKEN);

app.listen(8080);
