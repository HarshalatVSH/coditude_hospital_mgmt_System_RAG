// test.js - Super simple test
import WebSocket from "ws";

const ws = new WebSocket("wss://e87d8699745e.ngrok-free.app/ws");

ws.on("open", () => {
  console.log("✅ Connected!");

  // Setup call
  ws.send('{"type":"setup","callSid":"test123"}');

  // Send message after 1 second
  setTimeout(() => {
    console.log('🗣️  Asking: "Hello, how are you?"');
    ws.send('{"type":"prompt","voicePrompt":"Hello, how are you?"}');
  }, 1000);
});

ws.on("message", (data) => {
  const msg = JSON.parse(data);
  if (msg.type === "text") {
    console.log("🤖 AI replied:", msg.token);
    process.exit(0); // Exit after getting response
  }
});

ws.on("error", (err) => {
  console.log("❌ Error:", err.message);
});
