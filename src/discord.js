const fs = require("fs");
const path = require("path");

/**
 * @typedef {import('discord.js').Client} Discord.Client
 * @typedef {import('discord.js').TextChannel} Discord.TextChannel
 * @typedef {import('discord.js').User} Discord.User
 * @typedef {import('discord.js').VoiceChannel} Discord.VoiceChannel
 * @typedef {import('discord.js').MessageEmbed} Discord.MessageEmbed
 */
const Discord = require("discord.js");
const { Readable } = require("stream");
const { encodeWav: encodeWavHelper } = require("wav-converter");
const peer = require("./peer");

const {
  uploadBuffer,
  deleteFile,
  listFiles,
  baseUrl,
  deleteAllFiles,
} = require("./common");

const client = new Discord.Client({
  restRequestTimeout: 600000,
  retryLimit: 10,
});

/**
 * @type {Discord.TextChannel}
 */
let random_garbage;

const getDefaultChannel = () => random_garbage;

client.on("ready", () => {
  console.log(`Ready on port ${process.env.PORT}`);

  for (const guild of client.guilds.cache.array()) {
    random_garbage = guild.channels.cache
      .array()
      .find((_) => _.name == "random-garbage");
    peer.setChannel(random_garbage);
  }
});

const isClientBot = (str) =>
  str && str.toUpperCase() === client.user.username.toUpperCase();

client.on("message", async (message) => {
  const { content, channel, author } = message;
  const args = content
    .split(" ")
    .map((s) => s.trim())
    .filter(Boolean);
  switch (args[0]) {
    case "/delete":
      handleDelete(args.slice(1).join(" "), message, channel);
      break;
    case "/upload_testppp":
      testUpload(channel);
      break;
    case "/list":
      linkFiles(channel, message);
      break;
    case "/record":
      if (isClientBot(args[1])) handleRecord(args[2], author, channel);
      break;
    case "/play":
      if (isClientBot(args[1]))
        handlePlay(args.slice(2).join(" "), author, message);
      break;
    default:
      break;
  }
});

/**
 * @param {string} arg
 * @param {Discord.Message} message
 * @param {Discord.TextChannel} channel
 */
const handlePlay = async (filename, { id }, message) => {
  message.channel.guild.channels.cache
    .array()
    .filter((c) => c.type === "voice")
    .find((c) => c.members.map((m) => m.id).includes(id))
    .join()
    .then((conn) =>
      conn.play(`${baseUrl}download/${encodeURIComponent(filename)}`)
    );
  message.reply(`Playing ${filename}! <3`);
};

const testUpload = async () => {
  const file_data = fs.readFileSync(
    path.join(__dirname, "..", "test", "inkscape.exe")
  );
  // uploadBuffer(channel, "inkscape.exe (Windows)", file_data);
  peer.uploadFile("inkscape.exe (Windows)", file_data);
};

/**
 * @param {string} arg
 * @param {Discord.Message} message
 * @param {Discord.TextChannel} channel
 */
const handleDelete = async (arg, message, channel) => {
  switch (arg) {
    case undefined:
      deleteAllFiles(channel);
      message.reply("Deleted all files, my sir.");
      break;
    default:
      message.reply(
        (await deleteFile(arg, channel))
          ? `Deleted ${arg}.`
          : `Unable to delete ${arg}.`
      );
      break;
  }
};

const handleRecord = async (arg, author, channel) => {
  switch (arg) {
    case "start":
      recordAudio(author, channel);
      break;
    case "stop":
      finishRecording(author, channel);
      break;
    default:
      break;
  }
};

const SILENCE_FRAME = Buffer.from([0xf8, 0xff, 0xfe]);

class Silence extends Readable {
  _read() {
    this.push(SILENCE_FRAME);
    this.destroy();
  }
}

/**
 * @param {Buffer} Buffer
 * @returns {Buffer}
 */
const encodeWav = (buffer) =>
  encodeWavHelper(buffer, {
    numChannels: 2,
    sampleRate: 48000,
    byteRate: 16,
  });

const userRequestMap = {};

/**
 * @param {Discord.User} user
 * @param {Discord.TextChannel} channel
 */
const finishRecording = async (user, channel) => {
  const { id } = user;
  if (userRequestMap[id]) {
    const { arr, offset, filename, uuid } = userRequestMap[id];
    userRequestMap[id] = undefined;

    await uploadBuffer(
      channel,
      filename,
      encodeWav(Buffer.concat(arr)),
      uuid,
      offset
    );
  }
};

/**
 * @param {Discord.User} user
 * @param {Discord.TextChannel} channel
 */
const recordAudio = async (user, channel) => {
  const { id, username } = user;

  userRequestMap[id] = {
    arr: [],
    offset: 0,
    uuid: Math.random().toString(36).replace("0.", ""),
    filename: `${username}_recording_request.wav`,
    stream: undefined,
  };

  /**
   * @type {Discord.VoiceChannel}
   */
  const vc = channel.guild.channels.cache
    .array()
    .filter((c) => c.type === "voice")
    .find((c) => c.members.map((m) => m.id).includes(id));

  vc.joinable &&
    vc.join().then((conn) => {
      conn.play(new Silence(), { type: "opus" });
      conn.on("speaking", (u, speaking) => {
        if (speaking) {
          const req = userRequestMap[id];
          if (!req) return;
          let { offset, uuid, filename } = req;
          /**
           * @type {Buffer[]}
           */
          const arr = req.arr;
          const stream = conn.receiver.createStream(u, { mode: "pcm" });
          stream.on("data", (chunk) => arr.push(chunk));

          stream.on("end", () => {
            if (arr.reduce((curr, b) => curr + b.byteLength, 0) >= 8388119) {
              offset += uploadBuffer(
                channel,
                filename,
                encodeWav(Buffer.concat(arr)),
                uuid,
                offset
              ).length;
              if (userRequestMap[id]) {
                userRequestMap[id].offset = offset;
                userRequestMap[id].arr = [];
              }
            }
          });
        }
      });
    });
};

const linkFiles = async (channel, message) => {
  const fileNames = await listFiles(channel);
  if (fileNames.length) {
    const fileLinks = fileNames.map(
      (n) =>
        `[${n.substring(
          0,
          n.lastIndexOf("_")
        )}](${baseUrl}download/${encodeURIComponent(n)})`
    );
    const descriptions = fileLinks.reduce(
      (curr, l) => {
        const last = curr.pop();
        if (last.length + l.length + 1 >= 2048) {
          curr.push(last, l);
        } else {
          curr.push(`${last}${last ? "\n" : ""}${l}`);
        }
        return curr;
      },
      [""]
    );
    for (const description of descriptions) {
      await message.reply(new Discord.MessageEmbed({ description }));
    }
  } else {
    message.reply(
      new Discord.MessageEmbed({
        description: "Unable to find any uploaded files!",
      })
    );
  }
};

module.exports = {
  client,
  getDefaultChannel,
};
