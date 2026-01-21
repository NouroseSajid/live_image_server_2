const { WebSocketServer } = require("ws");
const http = require("node:http");

// helper: forward a message to the SSE endpoint
function forwardToSSE(payload) {
  const body = JSON.stringify(payload);
  const req = http.request({
    hostname: "localhost",
    port: 3000,
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

const wss = new WebSocketServer({ port: 8080 });

console.log("WebSocket server started on port 8080");

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
