const util = require("util");
const channels = {}; // Active rooms and their participants
const sockets = {}; // Socket references
const callDurations = {}; // Tracks call start times for each room
const options = { depth: null, colors: true };

const signallingServer = (socket) => {
  socket.channels = {}; // Rooms the socket is in
  sockets[socket.id] = socket;

  console.log(`[${socket.id}] connected`);

  // Disconnect handling
  socket.on("disconnect", () => {
    for (const channel in socket.channels) {
      leaveRoom(channel);
    }
    console.log(`[${socket.id}] disconnected`);
    delete sockets[socket.id];
  });

  // Join a room
  socket.on("joinRoom", (config) => {
    const room = config.room;
    const userData = config.userData;

    console.log(`[${socket.id}] requested to join room: ${room}`);

    // Ensure room exists
    if (!(room in channels)) {
      channels[room] = {};
    }

    // Ensure room capacity is not exceeded
    if (Object.keys(channels[room]).length >= 2) {
      socket.emit("roomFull", { message: "Room is full. Try another room." });
      return;
    }

    // Add the user to the room
    channels[room][socket.id] = { socket, userData };
    socket.channels[room] = room;

    console.log(`[${socket.id}] joined room: ${room}`);
    console.log(`Room ${room} participants: ${Object.keys(channels[room]).length}`);

    // Notify existing peer (if any) and establish WebRTC connection
    if (Object.keys(channels[room]).length === 2) {
      const peerIds = Object.keys(channels[room]);
      const [peer1, peer2] = peerIds;

      // Start the call timer
      callDurations[room] = Date.now();
      console.log(`Call started in room: ${room}`);

      // Notify both peers to start the WebRTC connection
      sockets[peer1].emit("connectPeer", { peer_id: peer2, role: "caller",userData: channels[room][peer2].userData });
      sockets[peer2].emit("connectPeer", { peer_id: peer1, role: "acceptor",userData: channels[room][peer1].userData });
    }
  });

  // Relay ICE candidates between peers
  socket.on("relayICECandidate", (config) => {
    const peer_id = config.peer_id;
    const ice_candidate = config.ice_candidate;

    if (peer_id in sockets) {
      sockets[peer_id].emit("iceCandidate", { peer_id: socket.id, ice_candidate });
    }
  });

  // Relay session descriptions (SDP) between peers
  socket.on("relaySessionDescription", (config) => {
    const peer_id = config.peer_id;
    const session_description = config.session_description;

    if (peer_id in sockets) {
      sockets[peer_id].emit("sessionDescription", { peer_id: socket.id, session_description });
    }
  });

  // Leave a room
  const leaveRoom = (room) => {
    if (!(room in socket.channels)) return;

    console.log(`[${socket.id}] leaving room: ${room}`);

    // Notify the other peer about disconnection
    for (const peer_id in channels[room]) {
      if (peer_id !== socket.id) {
        sockets[peer_id].emit("peerDisconnected", { peer_id: socket.id });
      }
    }

    // Remove user from the room
    delete channels[room][socket.id];
    delete socket.channels[room];

    // End the call timer and log duration
    if (Object.keys(channels[room]).length === 0) {
      if (callDurations[room]) {
        const duration = Math.floor((Date.now() - callDurations[room]) / 1000);
        console.log(`Call in room ${room} ended. Duration: ${duration} seconds.`);
        delete callDurations[room];
      }
      delete channels[room];
    }
  };
};

module.exports = signallingServer;
