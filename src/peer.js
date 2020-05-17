const net = require("net");
const crypto = require("crypto");
const stream = require("stream");
const hyperswarm = require("hyperswarm");

const common = require("./common");

let channel;

const swarm = hyperswarm();

const peers = new Map();

const topic = crypto.createHash("sha256")
  .update("disdb")
  .digest();

swarm.join(topic, {
  lookup: true, // find & connect to peers
  announce: true // optional- announce self as a connection target
});  

swarm.on("connection",
/**
 * @param {net.Socket} connection
 */
(connection, info) => {

  let mode = "normal";
  let peer_id;

  let upload_data = {};
  let uploaded_data = [];

  connection.on("data", (data, info) => {

    if (mode === "upload") {
      // console.log(data);
      // common.uploadBuffer(channel, upload_data.name, data, upload_data.uuid, upload_data.offset);
      uploaded_data.push(data);
      console.log(uploaded_data.length, upload_data.length)
      if (uploaded_data.length === upload_data.length) {
        common.uploadBuffer(channel, upload_data.name, Buffer.concat(uploaded_data), upload_data.uuid, upload_data.offset);
        mode = "normal";
      }
      return;
    }

		console.log(data.toString());
		const message = JSON.parse(data.toString());

		try {
			switch (message.type) {
				case "hello":
    	    peer_id = message.peer_id;
    	    console.log(`Connected to peer bot with peer id "${peer_id}"`);
    	    peers.set(peer_id, {
    	      connection
    	    });
    	    break;
    	  case "upload":
    	    upload_data = message;
    	    mode = "upload";
    	    break;
			}
		}
		catch {
			// do nothing
		}

  });
  
  connection.on("error", () => {});

  connection.on("close", () => {
    console.log(`Disconnected from "${peer_id}"`);
    peers.delete(peer_id);
  });

	connection.write(JSON.stringify({

		type: "hello",
		peer_id: process.env.PEER_ID

  }));

});

module.exports = {

  swarm,
  peers,

  setChannel(_channel) {channel = _channel},

  upload (name, uuid, offset, total_parts, buffer) {
    // console.log([...peers.values()]);
    for (const val of [...peers.values()]) {
      const connection = val.connection;
      connection.write(JSON.stringify({

        type: "upload",
        name,
        uuid,
        offset,
        total_parts,
        length: common.countChunks(buffer, 65535)
    
      }));
  
      const bufferStream = new stream.PassThrough();
  
      bufferStream.end(buffer);
  
      setTimeout(() => {
  
        bufferStream.pipe(connection);
  
      }, 100);
    }
  },

  uploadFile (name, buffer) {

    const uploaders = peers.size + 1;

    const total_chunks = common.countChunks(buffer, 8388119);
    const chonks = common.chunks(buffer, Math.ceil(buffer.length / uploaders));    
    const uuid = Math.random().toString(36).replace("0.", "");

    common.uploadBuffer(channel, name, chonks[0], uuid, 0, total_chunks);

    for (let i = 0; i < uploaders - 1; i++) {
      const connection = [...peers.values()][i].connection;
      connection.write(JSON.stringify({

        type: "upload",
        name,
        uuid,
        offset: (total_chunks / Math.ceil(buffer.length / uploaders)) * (i + 1),
        total_parts: total_chunks,
        length: common.countChunks(chonks[i], 65535)
    
      }));
  
      const bufferStream = new stream.PassThrough();
  
      bufferStream.end(chonks[i]);
  
      setTimeout(() => {
  
        bufferStream.pipe(connection);
  
      }, 100);
    }

  }

}
