import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import prisma from '../../../../prisma/client';
import { unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const file = await prisma.file.findUnique({
      where: { id: params.id },
    });

    if (!file) {
      return new NextResponse('File not found', { status: 404 });
    }

    // Try to delete file from disk
    try {
      const filePath = join(process.cwd(), 'public', 'uploads', file.folderId, file.fileName);
      if (existsSync(filePath)) {
        await unlink(filePath);
      }
    } catch (e) {
      console.error('Error deleting file from disk:', e);
      // Continue even if file deletion fails
    }

    // Delete from database
    await prisma.file.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
