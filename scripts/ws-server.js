const WebSocket = require("ws");
const http = require("http"); // already built-in

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
      "X-Internal-Secret": "ingest-123", // simple auth so outside callers cannot POST
    },
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
      if (msg.type === "new-file") {
        forwardToSSE(msg.payload); // <-- bridge
      }
    } catch {}
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});

function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(data);
    }
  });
}

// Example of broadcasting a message every 5 seconds
// setInterval(() => {
//   broadcast(JSON.stringify({ type: "heartbeat", timestamp: new Date() }));
// }, 5000);
