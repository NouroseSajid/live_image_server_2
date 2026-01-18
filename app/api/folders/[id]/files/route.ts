import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../auth/[...nextauth]/route';
import prisma from '../../../../../prisma/client';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { id } = await params;
    const files = await prisma.file.findMany({
      where: { folderId: id },
      orderBy: { createdAt: 'desc' },
    });

    // Serialize BigInt to string for JSON
    const serialized = files.map(file => ({
      ...file,
      fileSize: file.fileSize.toString(),
    }));

    return NextResponse.json(serialized);
  } catch (error) {
    console.error('Error fetching files:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
