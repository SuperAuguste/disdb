/**
 * @typedef {import('discord.js').TextChannel} Discord.TextChannel
 * @typedef {import('discord.js').Message} Discord.Message
 */

const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT}`;

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

/**
 * Uploads a buffer to DisDB, splitting it into 8mb chunks and upload in parts.
 * @param {Discord.TextChannel} channel 
 * @param {string} name 
 * @param {Buffer} buffer 
 * @param {string} [uuid] 
 * @param {number} [offset]
 */
function uploadBuffer(
  channel,
  name,
  buffer,
  uuid = Math.random().toString(36).replace("0.", ""),
  offset = 0
) {
  let i = 0;
  const chonks = chunks(buffer, 8388119);
  const a = [];
  for (const chunk of chonks) {
    a.push(
      /**
       * @type {Discord.TextChannel}
       */
      channel.send(
        `UPLOAD ${name}_${uuid}, part ${i + 1 + offset} / ${chonks.length} (${
          chonks.length - i - 1
        } seconds remaining)`,
        {
          files: [chunk],
        }
      )
    );

    i++;
  }

  return { ...Promise.all(a), length: a.length };
}

/**
 * Parses the content from an "UPLOAD" DisDB message.
 * @param {string} content 
 * @returns {filename: string, partNo: string, totalParts: string}
 */
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

const xss = (str) =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27")
    .replace(/\//g, "&#x2F");

/**
 * Lists all valid files in a DisDB storage channel.
 * @param {Discord.TextChannel} channel 
 */
const listFiles = async (channel) => {
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
      messages = (
        await channel.messages.fetch({
          before: id,
        })
      ).array();
    }
  }
  return [...names].map((str) => xss(str));
};

/************************************************************************
  Delete file(s) from the given channel.
 ************************************************************************/

 /**
 * Deletes a file from the DisDB channel.
 * The filename must match a <NAME>.<EXTENSION>_<UUID> format.
 * @param {string} filename
 * @param {Discord.TextChannel} channel 
 * @returns {boolean} if the file was deleted or not
 */
const deleteFile = async (reqFilename, channel) => {
  let messages = (await channel.messages.fetch()).array();
  /**
   * @type {Discord.Message[]}
   */
  const toDelete = [];
  let i = 0;
  while (i < messages.length) {
    const m = messages[i];
    const {
      author: { bot },
      content,
      deletable,
      id,
    } = m;
    if (content.indexOf("-- INTERRUPT --") > -1) break;
    if (bot && deletable && content.indexOf("UPLOAD") > -1) {
      const { filename: msgFilename } = parseMessageContent(content);
      if (reqFilename === msgFilename) toDelete.push(m);
    }
    
    i++;

    if (i === messages.length) {
      i = 0;
      messages = (
        await channel.messages.fetch({
          before: id,
        })
      ).array();
    }
  }
  channel.bulkDelete(toDelete);
  return toDelete.length > 0;
}; 

/**
 * Wipes all DisDB files from a discord channel.
 * @param {Discord.TextChannel} channel 
 */
const deleteAllFiles = async (channel) => {
  const messages = (await channel.messages.fetch()).array();
  messages.forEach((m) => m.deletable && m.delete());
};

module.exports = {
  baseUrl,
  uploadBuffer,
  listFiles,
  parseMessageContent,
  deleteFile,
  deleteAllFiles,
};
