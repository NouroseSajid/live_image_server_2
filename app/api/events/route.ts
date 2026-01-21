import { type NextRequest, NextResponse } from "next/server";

// Store active SSE connections
const clients = new Set<{ id: string; send: (data: string) => void }>();

export async function POST(request: NextRequest) {
  try {
    // Simple auth check
    const secret = request.headers.get("X-Internal-Secret");
    if (secret !== "ingest-123") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await request.json();

    // Broadcast to all SSE clients
    const message = `data: ${JSON.stringify(payload)}\n\n`;
    clients.forEach((client) => {
      try {
        client.send(message);
      } catch (err) {
        console.error("Error sending to SSE client:", err);
        clients.delete(client);
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in events endpoint:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  // Set up SSE headers
  const headers = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };

  // Create a custom stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      const clientId = `client-${Date.now()}-${Math.random()}`;
      const client = {
        id: clientId,
        send: (data: string) => {
          try {
            controller.enqueue(new TextEncoder().encode(data));
          } catch (err) {
            console.error("Error enqueueing data:", err);
          }
        },
      };

      clients.add(client);
      console.log(
        `[SSE] Client ${clientId} connected. Total clients: ${clients.size}`,
      );

      // Send initial connection message
      client.send(
        `data: ${JSON.stringify({ type: "connected", clientId })}\n\n`,
      );

      // Handle client disconnect
      const closeHandler = () => {
        clients.delete(client);
        console.log(
          `[SSE] Client ${clientId} disconnected. Total clients: ${clients.size}`,
        );
        try {
          controller.close();
        } catch (err) {
          console.error("Error closing SSE stream:", err);
        }
      };

      // Close stream if request is aborted
      request.signal.addEventListener("abort", closeHandler);
    },
  });

  return new NextResponse(stream, { headers });
}
