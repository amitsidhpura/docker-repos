const { io } = require("socket.io-client");

const SERVER_URL = "https://socketio.syncroze.com";
const ROOM_NAME = "test-room";

// Create Client 1
function createClient(name) {
  const socket = io(SERVER_URL, {
    transports: ["websocket"],
    reconnection: false
  });

  socket.on("connect", () => {
    console.log(`[${name}] Connected with ID: ${socket.id}`);
  });

  socket.on("instance-info", (data) => {
    console.log(`[${name}] Connected to instance: ${data.instanceId}`);
  });

  socket.on("message", (data) => {
    console.log(`[${name}] Received message from ${data.from}: "${data.data.text}"`);
  });

  socket.on("user-joined", (data) => {
    console.log(`[${name}] User ${data.userId} joined room: ${data.room}`);
  });

  socket.on("room-message", (data) => {
    console.log(`[${name}] Room message from ${data.from}: "${data.message}"`);
  });

  socket.on("connect_error", (err) => {
    console.log(`[${name}] Connection error: ${err.message}`);
    process.exit(1);
  });

  socket.on("disconnect", (reason) => {
    console.log(`[${name}] Disconnected: ${reason}`);
  });

  return socket;
}

async function runTest() {
  console.log("=".repeat(60));
  console.log("Socket.IO Two-Client Messaging Test");
  console.log("=".repeat(60));
  console.log(`Server: ${SERVER_URL}`);
  console.log("");

  // Create two clients
  console.log("--- Creating clients ---");
  const client1 = createClient("Client-1");
  const client2 = createClient("Client-2");

  // Wait for both to connect
  await new Promise((resolve) => setTimeout(resolve, 2000));

  if (!client1.connected || !client2.connected) {
    console.log("ERROR: One or both clients failed to connect");
    process.exit(1);
  }

  console.log("");
  console.log("--- Test 1: Broadcast Message ---");
  console.log("[Client-1] Sending broadcast message...");
  client1.emit("message", { text: "Hello from Client-1!" });

  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log("");
  console.log("--- Test 2: Room Messaging ---");
  console.log("[Client-1] Joining room:", ROOM_NAME);
  client1.emit("join-room", ROOM_NAME);

  await new Promise((resolve) => setTimeout(resolve, 500));

  console.log("[Client-2] Joining room:", ROOM_NAME);
  client2.emit("join-room", ROOM_NAME);

  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log("[Client-1] Sending room message...");
  client1.emit("room-message", { room: ROOM_NAME, message: "Hello room from Client-1!" });

  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log("[Client-2] Sending room message...");
  client2.emit("room-message", { room: ROOM_NAME, message: "Hello room from Client-2!" });

  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log("");
  console.log("--- Cleanup ---");
  client1.disconnect();
  client2.disconnect();

  await new Promise((resolve) => setTimeout(resolve, 500));

  console.log("");
  console.log("=".repeat(60));
  console.log("Test completed successfully!");
  console.log("=".repeat(60));
  process.exit(0);
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});