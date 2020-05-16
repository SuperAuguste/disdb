require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const Discord = require("discord.js");

let random_garbage;
const app = express();

const client = new Discord.Client();

client.on("ready", () => {
  console.log("Ready!");

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

  for (const chunk of chonks) {
    channel.send(`${name}_${random}, part ${i + 1}`, {
      files: [chunk],
    });

    i++;
  }
}

client.on("message", async (message) => {
  const { content, channel } = message;

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
    uploadBuffer(message.channel, "UPLOAD inkscape.exe (Windows)", file_data);
  } else if (content === "/list") {
    const messages = (await channel.messages.fetch()).array();

    let names = new Set();
    while (messages.length > 0) {
      const { author, content } = messages.pop();
      if (content.indexOf("-- INTERRUPT --") > -1) break;
      // :^)
      if (author.bot && content.indexOf("UPLOAD") > -1) {
        const { filename, partNo, totalParts } = parseMessageContent(content);
        console.log(filename, partNo, totalParts);
        if (partNo === totalParts) names.add(filename);
      }
    }
    names.size
      ? message.reply([...names].join(","))
      : message.reply("Unable to find any completely uploaded files!");
  }
});

const parseMessageContent = (content) => {
  const splitMsg = content.split(",");
  const filename = splitMsg[0].split("UPLOAD ")[1];
  const partStrings = splitMsg[1].split("/").map((s) => s.trim());
  const partNo = partStrings[0];
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

client.login(process.env.TOKEN);

app.listen(8080);
