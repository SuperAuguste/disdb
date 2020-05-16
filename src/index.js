require("dotenv").config();

const fs = require("fs");
const path = require("path");
const axios = require("axios").default;
const express = require("express");
const Discord = require("discord.js");

/**
 * @type {Discord.TextChannel}
 */
let random_garbage;
const app = express();

app.use(require("express-fileupload")());

const client = new Discord.Client();

client.on("ready", () => {
  console.log(`Ready on port ${process.env.PORT}`);

  for (const guild of client.guilds.cache.array()) {
    random_garbage = guild.channels.cache
      .array()
      .find((_) => _.name == "random-garbage");
  }
});

function chunks(buffer, chunkSize) {
  assert(Buffer.isBuffer(buffer), "Buffer is required");
  assert(
    !isNaN(chunkSize) && chunkSize > 0,
    "Chunk size should be positive number"
  );

  var result = [];
  var len = buffer.length;
  var i = 0;

  while (i < len) {
    result.push(buffer.slice(i, (i += chunkSize)));
  }

  return result;
}

function assert(cond, err) {
  if (!cond) {
    throw new Error(err);
  }
}

function uploadBuffer(channel, name, buffer) {
  let i = 0;
  const chonks = chunks(buffer, 8388119);
  const random = Math.random().toString(36).replace("0.", "");

  const a = [];
  for (const chunk of chonks) {
    a.push(
      channel.send(
        `UPLOAD ${name}_${random}, part ${i + 1} / ${chonks.length} (${
          chonks.length - i - 1
        } seconds remaining)`,
        {
          files: [chunk],
        }
      )
    );

    i++;
  }

  return Promise.all(a);
}

client.on("message", async (message) => {
  if (message.content === "/delete") {
    const messages = (await message.channel.messages.fetch()).array();

    for (const cmessage of messages) {
      if (cmessage.deletable) cmessage.delete();
    }

    message.reply("I oblige, master.");
  } else if (message.content === "/upload_test") {
    const file_data = fs.readFileSync(
      path.join(__dirname, "..", "test", "inkscape.exe")
    );
    uploadBuffer(message.channel, "inkscape.exe (Windows)", file_data);
  } else if (message.content === "/list") {
    listFiles(message.channel, message);
  }
});

const listFiles = async (channel, message) => {
  const messages = (await channel.messages.fetch()).array();
  let names = new Set();
  for (const m of messages) {
	const { author, content } = m;
    if (content.indexOf("-- INTERRUPT --") > -1) break;
    if (author.bot && content.indexOf("UPLOAD") > -1) {
      const { filename, partNo, totalParts } = parseMessageContent(content);
	  if (partNo === totalParts) names.add(filename);
    }
  }
  if (message) {
	names.size
    	? message.reply([...names].join("\n"))
    	: message.reply("Unable to find any completely uploaded files!");
  }
};

const parseMessageContent = (content) => {
  const splitMsg = content.split(",");
  const filename = splitMsg[0].split("UPLOAD ")[1];
  const partStrings = splitMsg[1].split("/").map((s) => s.trim());
  const partNo = partStrings[0].split(" ")[1].trim();
  const totalParts = partStrings[1].split(" ")[0];
  return {
    filename,
    partNo,
    totalParts,
  };
};

app.get("/", (req, res) => {
  res.render("upload.ejs", {});
});

app.post("/upload", async (req, res) => {
  await uploadBuffer(random_garbage, req.files.foo.name, req.files.foo.data);
  res.json({
    success: "yay!",
  });
});

app.get("/download/:file", async (req, res) => {
  const messages = (await random_garbage.messages.fetch()).array();
  let filename = req.params.file;

  let arrthingy = [];
  for (const cmessage of messages) {
    if (
      cmessage.content.startsWith("UPLOAD") &&
      cmessage.content.includes(filename)
    ) {
      let partnumber = parseInt(cmessage.content.match(/\d+ \/ /g)[0]);
      arrthingy[partnumber - 1] = axios.get(
        cmessage.attachments.array()[0].attachment,
        {
          responseType: "arraybuffer",
        }
      );
    }
  }

  if (arrthingy.length === 0)
    return res.json({
      error: "Could not find file.",
    });

  var buf = Buffer.concat((await Promise.all(arrthingy)).map((_) => _.data));
  res.send(buf);
});

client.login(process.env.TOKEN);

app.listen(process.env.PORT);
