const { WebSocketServer } = require("ws");
const http = require("node:http");
require("dotenv").config({ path: ".env.local" });

// Get configuration from environment variables
const WS_HOST = process.env.WS_SERVER_HOST || "localhost";
const WS_PORT = parseInt(process.env.WS_SERVER_PORT || "8080", 10);
const NEXT_APP_HOST = process.env.NEXT_APP_HOST || "localhost";
const NEXT_APP_PORT = parseInt(process.env.NEXT_APP_PORT || "3000", 10);

// helper: forward a message to the SSE endpoint
function forwardToSSE(payload) {
  const body = JSON.stringify(payload);
  const req = http.request({
    hostname: NEXT_APP_HOST,
    port: NEXT_APP_PORT,
    path: "/api/events",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": "ingest-123",
    },
  });
  req.on("error", (err) => {
    console.error("[WS Server] Error forwarding to SSE:", err.message);
  });
  req.write(body);
  req.end();
}

const wss = new WebSocketServer({ host: WS_HOST, port: WS_PORT });

console.log(`[WS Server] WebSocket server started on ws://${WS_HOST}:${WS_PORT}`);

wss.on("connection", (ws) => {
  console.log("Client connected");

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data);
      console.log(`[WS Server] Received message type: ${msg.type}`);

      if (msg.type === "new-file") {
        forwardToSSE(msg.payload);
      }

      // Broadcast all messages to all connected clients
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(data);
        }
      });
    } catch (err) {
      console.error("[WS Server] Error processing message:", err);
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });

  ws.on("error", (err) => {
    console.error("[WS Server] Client error:", err);
  });
});

function _broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(data);
    }
  });
}
