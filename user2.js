import axios from "axios";
import { io } from "socket.io-client";

// ------------------- CONFIG -------------------
const BASE_URL = "http://localhost:3000";
const EMAIL = "dave@test.com";
const PASSWORD = "password123";
const ROOM_ID = "room-general"; // Must match DB room ID

// ------------------- GET JWT -------------------
async function getToken() {
  const res = await axios.post(`${BASE_URL}/auth/login`, { email: EMAIL, password: PASSWORD });
  console.log("✅ User2 token acquired");
  return res.data.token;
}

// ------------------- CONNECT SOCKET -------------------
async function main() {
  const token = await getToken();

  const socket = io(BASE_URL, {
    auth: { token: `Bearer ${token}` },
    transports: ["websocket"],
  });

  socket.on("connect", () => {
    console.log("✅ Connected:", socket.id);

    // Join room
    socket.emit("join_room", { roomId: ROOM_ID }, (ack) => {
      if (ack.success) {
        console.log(`🟢 Joined room: ${ROOM_ID}`);
        // Send a test message
        socket.emit("send_message", { roomId: ROOM_ID, content: "Hello from User2!" });
      } else {
        console.log("❌ Failed to join room:", ack.error);
      }
    });
  });

  // Listen for room history
  socket.on("room_history", (messages) => {
    console.log("📜 Room history:", messages);
  });

  // Listen for new messages
  socket.on("new_message", (message) => {
    console.log("📩 Received:", message);
  });

  // Listen for user join/leave
  socket.on("user_joined", (data) => console.log("➡️ User joined:", data.user.username));
  socket.on("user_left", (data) => console.log("⬅️ User left:", data.user.username));

  socket.on("connect_error", (err) => console.log("❌ Socket connect_error:", err.message));
}

main().catch(console.error);