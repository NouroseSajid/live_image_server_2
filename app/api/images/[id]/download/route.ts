import { NextResponse, NextRequest } from 'next/server';
import prisma from '../../../../../prisma/client';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { join } from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const quality = searchParams.get('quality') || 'original';

  if (!id) {
    return new NextResponse('Image ID not provided', { status: 400 });
  }

  try {
    const file = await prisma.file.findUnique({
      where: { id },
      include: { variants: true },
    });

    if (!file) {
      return new NextResponse('File not found', { status: 404 });
    }

    const variant = file.variants.find((v) => v.name === quality);

    if (!variant) {
      return new NextResponse('Requested quality not found', { status: 404 });
    }

    const filePath = join(process.cwd(), 'public', variant.path);
    
    try {
      const stats = await stat(filePath);
      const stream = createReadStream(filePath);
      
      const headers = new Headers();
      headers.set('Content-Disposition', `attachment; filename="${file.fileName}"`);
      headers.set('Content-Type', 'application/octet-stream');
      headers.set('Content-Length', stats.size.toString());

      return new NextResponse(stream as any, { headers });
    } catch (error) {
      return new NextResponse('File not found on disk', { status: 404 });
    }

  } catch (error) {
    console.error('Error downloading file:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
