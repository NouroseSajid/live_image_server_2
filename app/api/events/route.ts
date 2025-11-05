import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'edge';

export async function GET() {
  const encoder = new TextEncoder();
  const customReadable = new ReadableStream({
    start(controller) {
      // Keep track of connected clients
      const clientId = Date.now().toString();
      
      // Function to send updates to this client
      const sendUpdate = async () => {
        try {
          // Get latest images
          const latestImages = await prisma.file.findMany({
            where: {
              isProcessing: true,
              OR: [
                { isLive: true },
                { processingCompleted: false }
              ]
            },
            orderBy: { createdAt: 'desc' },
            take: 10
          });

          // Send the update
          const data = encoder.encode(`data: ${JSON.stringify({ 
            type: 'image_update',
            images: latestImages,
            timestamp: Date.now()
          })}\n\n`);
          
          controller.enqueue(data);
        } catch (error) {
          console.error('Error sending update:', error);
        }
      };

      // Send updates every 2 seconds
      const interval = setInterval(sendUpdate, 2000);

      // Cleanup when client disconnects
      return () => {
        clearInterval(interval);
      };
    }
  });

  return new NextResponse(customReadable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}