const axios = require("axios");

/**
 * @typedef {import('discord.js').VoiceChannel} Discord.VoiceChannel
 */
const { uploadBuffer, baseUrl } = require("./common");
const { getDefaultChannel } = require("./discord");

const uploadHandler = async (req, res) => {
  if (!req.files.fileList) {
    res.redirect("/");
    return;
  }
  if (Array.isArray(req.files.fileList)) {
    for (let file of req.files.fileList) {
      await uploadBuffer(getDefaultChannel(), file.name, file.data);
    }
  } else {
    try {
      await uploadBuffer(
        getDefaultChannel(),
        req.files.fileList.name,
        req.files.fileList.data
      );
    } catch {
      // do nothing
    }
  }
  res.redirect("/");
};

let downloadFn = async (req, res) => {
  let messages = (await getDefaultChannel().messages.fetch()).array();
  let filename = req.params.file;

  let i = 0;
  let arrthingy = [];
  while (i < messages.length) {
    const cmessage = messages[i];
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

    i++;

    if (i === messages.length) {
      i = 0;
      messages = (
        await getDefaultChannel().messages.fetch({
          before: cmessage.id,
        })
      ).array();
    }
  }

  if (arrthingy.length === 0)
    return res.json({
      error: "Could not find file.",
    });

  var buf = Buffer.concat((await Promise.all(arrthingy)).map((_) => _.data));
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${encodeURIComponent(
      filename.split("_").slice(0, -1).join("")
    )}"`
  );
  res.write(buf);
  res.end();
};

const downloadHandler = async (req, res) => {
  try {
    await downloadFn(req, res);
  } catch {
    // do nothing
  }
};

const previewHandler = async (req, res) => {
	try {
		random_garbage.send(`${baseUrl}preview/${encodeURIComponent(req.params.file)}.${req.params.file.split('_')[req.params.file.split('_').length-2]}`);
  	res.redirect("/");
	} catch {
		// do nothing
	}
};

const streamHandler = async (req, res) => {
  /**
   * @type {Discord.VoiceChannel}
   */
  const vc = getDefaultChannel()
    .guild.channels.cache.array()
    .filter((_) => _.type === "voice")
    .find((_) => _.name === req.params.channel);

  vc.join().then((conn) => {
    conn.play(`${baseUrl}download/${encodeURIComponent(req.params.file)}`);
    res.redirect("/");
  });
};

module.exports = {
  uploadHandler,
  downloadHandler,
  streamHandler,
};
