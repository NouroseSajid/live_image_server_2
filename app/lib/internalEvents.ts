import http from "node:http";

/**
 * Fire-and-forget bridge into the SSE endpoint. Mirrors the helper used by the
 * ZIP download route so server-side work can notify connected browsers.
 */
export function sendInternalEvent(payload: unknown): void {
  const body = JSON.stringify(payload);
  const appPort = Number.parseInt(process.env.PORT || "3000", 10);

  const req = http.request(
    {
      hostname: "localhost",
      port: appPort,
      path: "/api/events",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": process.env.INTERNAL_SECRET || "ingest-123",
        "Content-Length": Buffer.byteLength(body),
      },
    },
    (res) => {
      res.on("data", () => {});
      res.on("end", () => {});
    },
  );

  req.on("error", () => {
    // Realtime updates are best-effort; the admin can always refresh manually.
  });
  req.write(body);
  req.end();
}
