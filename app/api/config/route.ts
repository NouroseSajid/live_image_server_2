import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Build WebSocket URL based on environment
    let wsUrl: string;

    if (process.env.NODE_ENV === "production") {
      // In production, use the environment variable or construct from request
      const wsHost = process.env.WS_SERVER_HOST || "localhost";
      const wsPort = process.env.WS_SERVER_PORT || "8080";
      const protocol = process.env.WS_USE_SECURE === "true" ? "wss" : "ws";
      
      // If WS_SERVER_URL is explicitly set (for services like Socket.io), use that
      if (process.env.WS_SERVER_URL) {
        wsUrl = process.env.WS_SERVER_URL;
      } else {
        wsUrl = `${protocol}://${wsHost}:${wsPort}`;
      }
    } else {
      // In development, use localhost
      const wsPort = process.env.WS_SERVER_PORT || "8080";
      wsUrl = `ws://localhost:${wsPort}`;
    }

    return NextResponse.json({
      wsUrl,
      nodeEnv: process.env.NODE_ENV,
    });
  } catch (error) {
    console.error("Error fetching config:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
