import { NextRequest } from "next/server";
import { EventEmitter } from "events";

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

// GET /api/events  (existing SSE)
export async function GET(request: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      const handler = (data: any) => {
        controller.enqueue(
          `event: image_update\ndata: ${JSON.stringify({ images: [data] })}\n\n`,
        );
      };
      emitter.on("new-file", handler);

      // keep-alive
      const keepAlive = setInterval(() => controller.enqueue(":\n\n"), 15_000);

      request.signal.addEventListener("abort", () => {
        clearInterval(keepAlive);
        emitter.off("new-file", handler);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// POST /api/events  (new – only ws-server calls this)
export async function POST(req: NextRequest) {
  const secret = req.headers.get("X-Internal-Secret");
  if (secret !== "ingest-123")
    return new Response("Forbidden", { status: 403 });

  const file = await req.json();
  emitter.emit("new-file", file); // push to every open SSE connection
  return new Response("OK", { status: 200 });
}
