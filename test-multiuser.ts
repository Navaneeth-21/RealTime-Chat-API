// test-multiuser.ts
// This test file involves multiple users connecting to the server, joining the same room, and sending messages to test the multi-user functionality and Redis pub/sub integration.

import axios from "axios";
import { io, Socket } from "socket.io-client";

const SERVER_URL = "https://realtime-chat-api-7vkn.onrender.com";
const ROOM_ID = "replace with actual room id";
// Make sure the room exists in you db

// Define your test users here
const USERS = [
  { email: "alice@example.com", password: "password123" },
  { email: "new@example.com", password: "password123" },
  { email: "testuser@example.com", password: "password123" },
  // Add registered users from your DB
];

// Helper to acquire JWT token for a user
async function getToken(user: { email: string; password: string }) {
  const res = await axios.post(`${SERVER_URL}/auth/login`, user);
  return res.data.token;
}

// Main test runner
async function runTest() {
  console.log("🔑 Acquiring tokens...");
  const tokens = await Promise.all(USERS.map(getToken));
  console.log("✅ Tokens acquired");

  console.log("Connecting sockets...");
  const sockets: Socket[] = tokens.map((token, idx) => {
    const socket = io(SERVER_URL, {
      auth: { token: `Bearer ${token}` },
      transports: ["websocket"],
    });

    const username = USERS[idx].email.split("@")[0];

    socket.on("connect", () => console.log(`✅ Connected: ${socket.id} (${username})`));
    socket.on("connect_error", (err) => console.log(`❌ Connect error (${username}):`, err.message));

    socket.on("room_history", (history) => console.log(`📜 Room history for ${username}:`, history));
    socket.on("user_joined", (data) => console.log(`➡️ User joined room ${data.roomId}:`, data.user.username));
    socket.on("user_left", (data) => console.log(`⬅️ User left room ${data.roomId}:`, data.user.username));
    socket.on("new_message", (msg) => console.log(`💬 New message for ${username} from ${msg.sender.username}:`, msg.content));

    return socket;
  });

  // Wait for all sockets to connect
  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log(" Joining rooms...");
  await Promise.all(
    sockets.map((socket, idx) =>
      new Promise<void>((resolve) => {
        socket.emit("join_room", { roomId: ROOM_ID }, (ack: any) => {
          if (ack.success) console.log(`✅ ${USERS[idx].email.split("@")[0]} joined room`);
          else console.log(`❌ ${USERS[idx].email.split("@")[0]} failed to join room:`, ack.error);
          resolve();
        });
      })
    )
  );

  // Wait a bit for everyone to settle in the room
  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log("🏃 Sending messages...");
  // Each user sends a message
  sockets.forEach((socket, idx) => {
    const username = USERS[idx].email.split("@")[0];
    const message = `Hello from ${username}!`;
    console.log(`➡️ ${username} sending:`, message);
    socket.emit("send_message", { roomId: ROOM_ID, content: message });
  });

  // Wait for messages to propagate
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log("🏃 Users leaving room...");
  await Promise.all(
    sockets.map((socket, idx) =>
      new Promise<void>((resolve) => {
        socket.emit("leave_room", { roomId: ROOM_ID });
        console.log(`⬅️ ${USERS[idx].email.split("@")[0]} left room`);
        resolve();
      })
    )
  );

  console.log("❌ Disconnecting sockets...");
  sockets.forEach((socket) => socket.disconnect());
  console.log("✅ Test complete.");
}

runTest().catch(console.error);