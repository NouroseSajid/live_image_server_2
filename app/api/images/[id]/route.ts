import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import prisma from '../../../../prisma/client';

// Helper function to convert BigInt to string for JSON serialization
function serializeBigInt(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint'
      ? value.toString()
      : value // return everything else unchanged
  ));
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { rotation } = body;

    if (rotation === undefined) {
      return new NextResponse('Missing rotation value', { status: 400 });
    }

    const updatedFile = await prisma.file.update({
      where: { id: id },
      data: {
        rotation: rotation,
      },
    });

    return NextResponse.json(serializeBigInt(updatedFile));
  } catch (error) {
    console.error('Error updating image rotation:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}