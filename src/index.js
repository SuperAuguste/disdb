require("dotenv").config();

const express = require("express");

const { deleteFile, listFiles } = require('./common');
const { client, getDefaultChannel } = require('./discord');
const { uploadHandler, downloadHandler, streamHandler } = require("./controllers");

const app = express();

app.use(express.static("static"));
app.use(require("express-fileupload")());

app.get("/", async (req, res) => {
  res.render("index.ejs", {files: await listFiles(getDefaultChannel())});
});

app.post("/upload", uploadHandler);
app.get("/download/:file", downloadHandler);
app.get("/preview/:file.*", downloadHandler);
app.get("/delete/:file", async req => deleteFile(req.params.file, getDefaultChannel()));
app.get("/stream_audio/:channel/:file", streamHandler);

client.login(process.env.TOKEN);

app.listen(process.env.PORT);
