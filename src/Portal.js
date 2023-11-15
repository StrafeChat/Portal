const http = require("http");
const fs = require("fs");
const ws = require("ws");
const OP = require("./enum/OP.js");

class Socket {
    socket = null;
    authenticated = false;

    constructor(wsSocket) {
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
            // TODO: auth return;
        }

        switch(message.op) {
            case OP.PING:
                this.socket.send(JSON.stringify({ op: OP.PONG, data: "PONG" }));
                break;
        }
        // handle messages
    }
}

class Portal {
    constructor() {
        const server = http.createServer((req, res) => {
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(fs.readFileSync("./src/client/index.html")); // only for testing
        });
        server.listen(3000);

        const wss = new ws.WebSocketServer({ server, path: "/ws" });
        wss.on("connection", this.handleSocket.bind(this));
    }

    handleSocket(socket) {
        const s = new Socket(socket);
    }
}

module.exports = Portal;