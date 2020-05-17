require("dotenv").config();

const fs = require("fs");
const merge = require("lodash.merge");
const path = require("path");
const axios = require("axios").default;
const express = require("express");
const Discord = require("discord.js");
const { Readable } = require('stream');

const SILENCE_FRAME = Buffer.from([0xF8, 0xFF, 0xFE]);

class Silence extends Readable {
  _read() {
    this.push(SILENCE_FRAME);
    this.destroy();
  }
}

/**
 * @type {Discord.TextChannel}
 */
let random_garbage;
const app = express();

const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT}`;

app.use(express.static("static"));
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

function uploadBuffer(channel, name, buffer, random = Math.random().toString(36).replace("0.", ""), offset = 0) {
  let i = 0;
  const chonks = chunks(buffer, 8388119);
  const a = [];
  for (const chunk of chonks) {
    a.push(
      channel.send(
        `UPLOAD ${name}_${random}, part ${i + 1 + offset} / ${chonks.length} (${
          chonks.length - i - 1
        } seconds remaining)`,
        {
          files: [chunk],
        }
      )
    );

    i++;
  }
  
  return {...Promise.all(a), length: a.length};
}

client.on("message", async (message) => {
  const {content, channel, author } = message;

  switch (content) {
    case "/delete":
      const messages = (await channel.messages.fetch()).array();
      for (const cmessage of messages) {
        if (cmessage.deletable) cmessage.delete();
      }
      message.reply("I oblige, master.");

      break;
    case "/upload_test":
      const file_data = fs.readFileSync(
        path.join(__dirname, "..", "test", "inkscape.exe")
      );
      uploadBuffer(channel, "inkscape.exe (Windows)", file_data);

      break;
    case "/list":
      linkFiles(channel, message);
      break;
    case "/record start":
      recordAudio(author, channel);
      break;
    case "/record stop":
      finishRecording(author, channel);
      break;
    default:
      break;
  }
});

const userRequestMap = {};

/**
 * @param {Discord.User} user 
 * @param {Discord.TextChannel} channel 
 */
const finishRecording = async (user, channel = random_garbage) => {
  const { id } = user;
  if (userRequestMap[id]) {
    const { arr, offset, filename, uuid } = userRequestMap[id];
    userRequestMap[id] = undefined;
    await uploadBuffer(channel, filename, Buffer.concat(arr), uuid, offset);
  }
}

/**
 * @param {Discord.User} user 
 * @param {Discord.TextChannel} channel 
 */
const recordAudio = async (user, channel = random_garbage) => {
  const { id, username } = user;

  userRequestMap[id] = {
    arr: [], 
    offset: 0, 
    uuid: Math.random().toString(36).replace("0.", ""),
    filename:`${username}_recording_request.ogg`
  };

  /**
   * @type {Discord.VoiceChannel}
   */
  const vc = channel.guild.channels.cache.array()
    .filter(c => c.type === "voice")
    .find(c => c.members.map(m => m.id).includes(id));

  vc.joinable && vc.join().then(conn => {
    conn.play(new Silence(), { type: 'opus' });
    conn.on('speaking', (u, speaking) => {

      if (speaking) {
        const stream = conn.receiver.createStream(u, {mode: "opus"});
        /**
         * @type {Buffer[]}
         */
        const arr = userRequestMap[id].arr;
        let { offset, uuid, filename } = userRequestMap[id];

        stream.on('data', chunk => arr.push(chunk));

        stream.on('end', () => {
          if (arr.reduce((curr, b) => curr + b.byteLength, 0) >= 8388119) {
            offset += uploadBuffer(channel, filename, Buffer.concat(arr), uuid, offset).length;
            if (userRequestMap[id]) merge(userRequestMap[id], { offset, arr: [] });
          }
        }) 
      }
    })
  });
}


const linkFiles = async (channel, message) => {
	const fileNames = await listFiles(channel, message);
  let description;
  if (fileNames.length) {
    const fileLinks = fileNames.map(n => `[${n.substring(0, n.lastIndexOf("_"))}](${baseUrl}download/${encodeURIComponent(n)})`)
    const descriptions = fileLinks.reduce((curr, l) => {
      const last = curr.pop();
      if (last.length + l.length + 1 >= 2048) {
        curr.push(last, l);
      } else {
        curr.push(`${last}${last ? '\n' : ''}${l}`)
      }
      return curr;
    }, ['']);
    for (const description of descriptions) {
      await message.reply(new Discord.MessageEmbed({description}))
    }
  } else {
    message.reply(new Discord.MessageEmbed({description: "Unable to find any uploaded files!"}))
  }
  
	embedded.description = description;
	message.reply(embedded);
}

const listFiles = async (channel = random_garbage) => {
  let messages = (await channel.messages.fetch()).array();
  let names = new Set();
  let i = 0;
  while (i < messages.length) {
	const { author, content, id } = messages[i];
    if (content.indexOf("-- INTERRUPT --") > -1) break;
    if (author.bot && content.indexOf("UPLOAD") > -1) {
      const { filename, partNo, totalParts } = parseMessageContent(content);
	    if (partNo === totalParts) names.add(filename);
    }

	i++;
	
    if (i === messages.length) {
      i = 0;
      messages = (await channel.messages.fetch({
        before: id
      })).array();
    }
  }
  return [...names];
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

app.get("/", async (req, res) => {
  res.render("index.ejs", {files: await listFiles()});
});

app.post("/upload", async (req, res) => {
  if (!req.files.fileList) {
  	res.redirect("/");
		return;
	}
	if (Array.isArray(req.files.fileList)) {
		for (let file of req.files.fileList) {
  		await uploadBuffer(random_garbage, file.name, file.data);
		}
	} else {
		try {
  		await uploadBuffer(random_garbage, req.files.fileList.name, req.files.fileList.data);
		} catch {
			// do nothing
		}
	}
  res.redirect("/");
});

let downloadFn = async (req, res) => {
  let messages = (await random_garbage.messages.fetch()).array();
  let filename = req.params.file;

  let i = 0;
  let arrthingy = [];
  while (i < messages.length) {
    const cmessage = messages[i];
    if (cmessage.content.startsWith("UPLOAD") &&
        cmessage.content.includes(filename))
		{
      let partnumber = parseInt(cmessage.content.match(/\d+ \/ /g)[0]);
      arrthingy[partnumber - 1] = axios.get(
        cmessage.attachments.array()[0].attachment,
        {
          responseType: "arraybuffer",
        }
      );
    }

    i++;

    if (i === messages.length) {
      i = 0;
      messages = (await random_garbage.messages.fetch({
        before: cmessage.id
      })).array();
    }
  }

  if (arrthingy.length === 0)
    return res.json({
      error: "Could not find file.",
    });

  var buf = Buffer.concat((await Promise.all(arrthingy)).map((_) => _.data));
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename.split("_").slice(0, -1).join(""))}"`);
  res.write(buf);
  res.end();
}

const download = async (req, res) => {
	try {
		await downloadFn(req, res);
	} catch {
		// do nothing
	}
};

app.get("/download/:file", download);
app.get("/preview/:file.*", download);

app.get("/stream_audio/:channel/:file", (req, res) => {
  /**
   * @type {Discord.VoiceChannel}
   */
  const vc = random_garbage.guild.channels.cache.array().filter(_ => _.type === "voice").find(_ => _.name === req.params.channel);
  
  vc.join().then(conn => {
    conn.play(`${baseUrl}download/${encodeURIComponent(req.params.file)}`);
    res.redirect("/");
  });
});

client.login(process.env.TOKEN);

app.listen(process.env.PORT);
