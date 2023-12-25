const { RTCPeerConnection } = require("werift");
const EventEmitter = require("events");
const { v4: uuid } = require("uuid");

class Connection extends EventEmitter { // client server connection
  user;

  audio = null;
  video = null;
  pc = null;

  id = uuid();
  constructor(user) {
    super();

    this.user = user;

    const socket = this.user.socket;
    socket.on("ready", () => {
      //this.init(); // socket should be ready already
    });

    this.init();
  }

  async init() {
    const socket = this.user.socket;

    await socket.prepareConnection(this.id);

    const pc = new RTCPeerConnection({});
    this.pc = pc;

    pc.iceConnectionStateChange.subscribe((state) => {
      console.log(user.name, "iceconstatechange", state);
    });

    const t1 = pc.addTransceiver("video");
    const t2 = pc.addTransceiver("audio");
    this.audio = t2;
    this.video = t1;

    t1.onTrack.subscribe((track) => {
      if (track.kind !== "video") return;
      this.emit("track", track);
      //t1.sender.replaceTrack(track);
    });

    t2.onTrack.subscribe((track) => {
      if (track.kind !== "audio") return;
      this.emit("track", track);
    });

    await pc.setLocalDescription(await pc.createOffer());
    const sdp = JSON.stringify(pc.localDescription);

    socket.sendSdp(sdp, this.id);
    socket.on("sdp", (sdp) => {
      console.log(this.user.name, "sdp")
      pc.setRemoteDescription(sdp);
    });
  }

  addAudioTrack(track) {
    this.audio.sender.replaceTrack(track);
  }
  addVideoTrack(track) {
    this.video.sender.replaceTrack(track);
  }
}

class RelayConnection { // relay between 2 connections
  userA;
  userB;
  connectionA;
  connectionB;

  constructor(userA, userB) {
    this.userA = userA;
    this.userB = userB;

    this.connectionA = new Connection(userA);
    this.connectionA.on("track", (track) => {
      if (track.kind === "audio") {
        this.connectionB.addAudioTrack(track);
      } else {
        this.connectionB.addVideoTrack(track);
      }
    });
    this.connectionB = new Connection(userB);
    this.connectionB.on("track", (track) => {
      if (track.kind === "audio") {
        this.connectionA.addAudioTrack(track);
      } else {
        this.connectionA.addVideoTrack(track);
      }
    });
  }
}

class User {
  id;
  name;
  socket;

  connections = [];
  constructor(id, name, socket) {
    this.id = id;
    this.name = name;
    this.socket = socket;
  }
}

class VoiceCall {
  initiator = null; // user who started the call
  users = [];

  channelId;
  relays = [];
  constructor(channelId) {
    this.channelId = channelId;
  }

  initiate(socket) {
    const initiator = new User(socket.userId, socket.username, socket);
    this.users.push(initiator);
  }

  join(socket) {
    const user = new User(socket.userId, socket.username, socket);

    this.users.forEach((u) => {
      const relay = new RelayConnection(u, user);
      this.relays.push(relay);
    });
    this.users.push(user);
  }
}

module.exports = { User, VoiceCall }
