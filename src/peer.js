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
  let buffer_array = [];

  connection.on("data", (data, info) => {

    if (mode === "upload") {
      buffer_array.push(data);
      console.log(buffer_array.length, upload_data.length)
      if (buffer_array.length === upload_data.length) {
        // common.uploadBuffer(channel, upload_data.name, Buffer.concat(buffer_array), upload_data.uuid, upload_data.offset, data.total_chunks);
        channel.send(
          `UPLOAD ${upload_data.name}_${upload_data.uuid}, part ${upload_data.offset} / ${upload_data.total_chunks} ()`,
          {
            files: [Buffer.concat(buffer_array)],
          }
        )
        mode = "normal";
      }
      return;
    }

		try {
			const message = JSON.parse(data.toString());

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

function wait(ms) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
};

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

  async uploadFile (name, buffer) {

    const uploaders = peers.size + 1;

    const total_chunks = common.countChunks(buffer, 8388119);
    // const chonks = common.chunks(buffer, Math.ceil(buffer.length / uploaders));
    const chonks = common.chunks(buffer, 8388119);
    const uuid = Math.random().toString(36).replace("0.", "");

    // common.uploadBuffer(channel, name, chonks[0], uuid, 0, total_chunks);

    // console.log(total_chunks);
    // for (let i = 0; i < uploaders; i++) {
    console.log(chonks.length, total_chunks);
		for (let part = 0; part < total_chunks; ++part) {
			const peer_id = part % uploaders;
			if (peer_id === 0) {
        console.log(part);
        // common.uploadBuffer(channel, name, chonks[part], uuid, 0, total_chunks);
        channel.send(
          `UPLOAD ${name}_${uuid}, part ${part + 1} / ${total_chunks} ()`,
          {
            files: [chonks[part]],
          }
        )
			} else {
      	const connection = [...peers.values()][peer_id - 1].connection;
      	connection.write(JSON.stringify({

      	  type: "upload",
      	  name,
      	  uuid,
      	  offset: part + 1,
					count: uploaders,
          length: common.countChunks(chonks[part], 65535),
          total_chunks
    
      	}));
  
        // setTimeout(() => {
        await wait(100);
        connection.write(chonks[part]);
        await wait(100);
        // }, 100);

      	// const bufferStream = new stream.PassThrough();
  
      	// bufferStream.end(chonks[part]);
  
      	// await setTimeout(() => {
  
      	//   bufferStream.pipe(connection);
  
      	// }, 100);
			}
    }

  }

}
