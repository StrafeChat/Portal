const http = require("http");
const fs = require("fs");
const ws = require("ws");
const OP = require("./enum/OP.js");
const EventEmitter = require("events");

const { RTCPeerConnection, RTCSessionDescription, useSdesMid, useAbsSendTime } = require("werift");

class Socket extends EventEmitter {
  socket = null;
  authenticated = false;

  constructor(wsSocket) {
    super();

    this.socket = wsSocket;
    wsSocket.on("message", this.handleMessage.bind(this));
  }

  handleMessage(message) {
    try {
      message = JSON.parse(message);
    } catch(e) {
      this.socket.send("Semantic error: Invalid JSON");
      return; 
    }

    if (!this.authenticated && message.op !== OP.AUTH) {
      // handle authentication
      this.authenticated = true;

      // When AUTHENTICATED:
      this.emit("ready");
      // TODO: auth return;
    }

    switch(message.op) {
      case OP.PING:
        this.socket.send(JSON.stringify({ op: OP.PONG, data: "PONG" }));
        break;
      case OP.SDP:
        this.emit("sdp", message.data);
        break;
    }
      // handle messages
    }

    sendSdp(sdp) {
      this.socket.send(JSON.stringify({ op: OP.SDP, data: sdp }));
    };
}

class Portal {
  constructor() {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(fs.readFileSync("./src/client/index.html")); // only for testing
    });
    server.listen(3000, () => {
      console.log("listening")
    });

    const wss = new ws.WebSocketServer({ server, path: "/ws" });
    wss.on("connection", this.handleSocket.bind(this));
  }

  handleSocket(socket) {
    const s = new Socket(socket);

    s.on("ready", async () => {
      const pc = new RTCPeerConnection({
        /*headerExtensions: {
          video: [useSdesMid(), useAbsSendTime()],
        }*/
      });
      pc.iceConnectionStateChange.subscribe((state) => {
        console.log("iceconstatechange", state);
      });

      pc.onNegotiationneeded.subscribe(async () => {
        console.log("negotiation start");
      });

      const t1 = pc.addTransceiver("video");
      const t2 = pc.addTransceiver("audio");

      t1.onTrack.subscribe((track) => {
        if (track.kind !== "video") return;
        t1.sender.replaceTrack(track);
      });

      t2.onTrack.subscribe((track) => {
        if (track.kind !== "audio") return;
        t2.sender.replaceTrack(track);
      });

      await pc.setLocalDescription(await pc.createOffer());
      const sdp = JSON.stringify(pc.localDescription);

      s.sendSdp(sdp);
      s.on("sdp", (sdp) => {
        console.log("sdp")
        pc.setRemoteDescription(sdp);
      });
    });
  }
}

module.exports = Portal;
