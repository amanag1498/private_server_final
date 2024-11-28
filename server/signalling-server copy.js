/*
Note: This socket connection is used a signalling server as WebRTC does not support discovery of other peers. 
User's audio, video & chat messages does not use this socket.
*/
const util = require("util");
const mysql = require('mysql');
const channels = {};
const sockets = {};
const peers = {};
const hostIDs = {}; 
const options = { depth: null, colors: true };
const videoSharingPeers = {};
const blockIds ={};


const signallingServer = (socket) => {
	const socketHostName = socket.handshake.headers.host.split(":")[0];

	socket.channels = {};
	sockets[socket.id] = socket;

	console.log("[" + socket.id + "] connection accepted");
	console.log("[" + socketHostName + "] is generated");
	socket.on("disconnect", () => {
		for (const channel in socket.channels) {
			part(channel);
		}
		console.log("[" + socket.id + "] disconnected");
		delete sockets[socket.id];
	});
// new code 

// socket.on("blockUser", (config) => {
//     const channel = socketHostName + config.channel;
//     const blockUserId = config.userId;
// 	const peerId =config.peerId;

//     // Check if the socket ID of the requester is the host ID for the channel
//     if (socket.id !== hostIDs[channel]) {
//         console.log(`[${socket.id}] is not the host of channel ${channel}, block action denied.`);
//         return;
//     }

//     // Update the block list for the channel
//     if (!blockIds[channel]) {
//         blockIds[channel] = new Set();
//     }
//     blockIds[channel].add(blockUserId);

//     console.log(`[${blockUserId}] has been blocked from channel ${channel}`);

//     // Notify all users in the channel (optional)
//     for (const id in channels[channel]) {
//         channels[channel][id].emit("userBlocked", {peer_id : peerId});
//     }


// });




















// 	socket.on("hostApprovesVideoShare", (config) => {
// 		const channel = socketHostName +config.channel;
// 		const approvedPeerId = config.approvedPeerId;
// 	     console.log(config.channel + "   " +config.approvedPeerId);
// 		if (!videoSharingPeers[channel]) {
// 			videoSharingPeers[channel] = [];
// 		}
	
// 		// Add the approved peer ID to the list if not already present
// 		if (!videoSharingPeers[channel].includes(approvedPeerId)) {
// 			console.log(approvedPeerId);
// 			videoSharingPeers[channel].push(approvedPeerId);
// 		}
	
// 		// Notify all users in the channel
// 		for (const id in channels[channel]) {
// 			console.log(videoSharingPeers[channel]);
// 			channels[channel][id].emit("videoSharingPeersUpdate", videoSharingPeers[channel]);
// 		}
// 		socket.emit("videoSharingPeersUpdate", videoSharingPeers[channel]);
// 	});
//         socket.on("entryReceived", (config) => {
// 		const channel = socketHostName +config.channel;

	
// 		const entry_url = config.entry_url;
// 	        const entry_time = config.entry_time;
// 	        console.log(config.entry_url);
// 		// Notify all users in the channel
// 		for (const id in channels[channel]) {
// 		channels[channel][id].emit("entryReceivedByUser", {
// 				entry_url:entry_url,
// 			        entry_time:entry_time,   
// 			});
// 		}
// 	 socket.emit("entryReceivedByUser", {
// 		 	entry_url:entry_url,
// 		  entry_time:entry_time,
//  });
		
// 	});
	socket.on("giftReceived", (config) => {
		const channel = socketHostName +config.channel;
		const user_name = config.user_name;
		const gift_url = config.gift_url;
		const gift_name = config.gift_name;
		const audio = config.audio;
		// Notify all users in the channel
		for (const id in channels[channel]) {
		
			channels[channel][id].emit("giftReceivedByUser", {
				user_name :user_name,
				gift_url:gift_url,
				gift_name:gift_name,
				audio:audio
			});
		}
		// socket.emit("giftReceivedByUser", {
		// 	user_name :user_name,
		// 	gift_url:gift_url
		// });
	});


// 	socket.on("hostRemovesVideoShare", (config) => {
// 		const channel = socketHostName +config.channel;
// 		const peerId = config.peerId;
// 		const index = videoSharingPeers[channel]?.indexOf(peerId);
// 		console.log('index is' +index);
// 		console.log(peerId);
// 		if (index > -1) {
// 			videoSharingPeers[channel].splice(index, 1);
	
// 			// Notify all users in the channel about the updated list
// 			for (const id in channels[channel]) {
// 				channels[channel][id].emit("videoSharingPeersUpdate", videoSharingPeers[channel]);
// 			}
// 		}
		
// 		socket.emit("videoSharingPeersUpdate", videoSharingPeers[channel]);
// 	});














	socket.on("join", (config) => {
		console.log("[" + socket.id + "] join ", config);
		const channel = socketHostName + config.channel;

		// Already Joined
		if (channel in socket.channels) return;

		if (!(channel in channels)) {
			channels[channel] = {};
		}
      
		if (!(channel in peers)) {
			peers[channel] = {};
		}
		if (!(channel in hostIDs)) {
			hostIDs[channel] = socket.id;
			console.log(`Host for channel ${channel} is set to ${socket.id}`);
		}
		peers[channel][socket.id] = {
			userData: config.userData,
		};
		/// New code

		    // Check if user is blocked from the channel
			if (blockIds[channel] && blockIds[channel].has(config.userData.user_id)) {
				console.log(`[${socket.id}] is blocked from joining channel ${channel}`);
				socket.emit("joinDenied", "You are blocked from this channel.");
				return;
			}

			
		if (videoSharingPeers[channel]) {
			socket.emit("videoSharingPeersUpdate", videoSharingPeers[channel]);
		}
		console.log("[" + socket.id + "] join - connected peers grouped by channel", util.inspect(peers, options));

		for (const id in channels[channel]) {
			channels[channel][id].emit("addPeer", {
				peer_id: socket.id,
				should_create_offer: false,
				channel: peers[channel],
				userData:config.userData
			});
			socket.emit("addPeer", { peer_id: id, should_create_offer: true, channel: peers[channel],userData:config.userData});
			console.log(id);
		}

		channels[channel][socket.id] = socket;
		socket.channels[channel] = channel;
		if (channel in hostIDs) {
			socket.emit('hostInfo', { hostPeerId: hostIDs[channel] });
		}
	});

	// socket.on("requestVideoOn", (config) => {
	// 	const channel = socketHostName + config.channel;
	// 	// Assuming the host's socket ID is stored in `channels`
	// 	if (channels[channel] && channels[channel].hostSocketId) {
	// 		sockets[channels[channel].hostSocketId].emit("videoOnRequest", { requester_id: socket.id });
	// 	}
	// });

	socket.on("updateUserData", async (config) => {
		const channel = socketHostName + config.channel;
		const key = config.key;
		const value = config.value;
		for (let id in peers[channel]) {
			if (id == socket.id) {
				peers[channel][id]["userData"][key] = value;
			}
		}
		console.log("[" + socket.id + "] updateUserData", util.inspect(peers[channel][socket.id], options));
	});

	const part = (channel) => {
		// Socket not in channel
		if (!(channel in socket.channels)) return;

	


		delete socket.channels[channel];
		delete channels[channel][socket.id];
		delete peers[channel][socket.id];

		delete peers[channel][socket.id];
		if (Object.keys(peers[channel]).length == 0) {
			// last peer disconnected from the channel
			delete peers[channel];
			delete channels[channel];  // Clear the channel
            delete blockIds[channel]; 
			delete videoSharingPeers[channel]; 
		}
		console.log("[" + socket.id + "] part - connected peers grouped by channel", util.inspect(peers, options));

		///new code
		const index = videoSharingPeers[channel]?.indexOf(socket.id);
		if (index > -1) {
			videoSharingPeers[channel].splice(index, 1);
	
			// Notify all users in the channel about the updated list
			for (const id in channels[channel]) {
				channels[channel][id].emit("videoSharingPeersUpdate", videoSharingPeers[channel]);
			}
		}
		for (const id in channels[channel]) {
			channels[channel][id].emit("removePeer", { peer_id: socket.id });
			socket.emit("removePeer", { peer_id: id });
		}



	};

	socket.on("relayICECandidate", (config) => {
		let peer_id = config.peer_id;
		let ice_candidate = config.ice_candidate;

		if (peer_id in sockets) {
			console.log(ice_candidate + "    " + peer_id);
			sockets[peer_id].emit("iceCandidate", { peer_id: socket.id, ice_candidate: ice_candidate });
		}
	});

	socket.on("relaySessionDescription", (config) => {
		let peer_id = config.peer_id;
		let session_description = config.session_description;

		if (peer_id in sockets) {
			sockets[peer_id].emit("sessionDescription", {
				peer_id: socket.id,
				session_description: session_description,
			});
		}
	});
};

module.exports = signallingServer;
