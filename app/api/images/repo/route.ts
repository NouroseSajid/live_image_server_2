import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import prisma from '../../../../prisma/client';

export async function GET() {
  const session = await getServerSession(authOptions);

  // Decide if authentication is required for repo images. 
  // For now, assuming repo images might be public or require authentication based on folder settings.
  // if (!session || !session.user) {
  //   return new NextResponse('Unauthorized', { status: 401 });
  // }

  try {
    const repoImages = await prisma.file.findMany({
      where: {
        folder: {
          inGridView: true,
        },
      },
      include: {
        folder: true, // Include folder information if needed
        variants: true, // Include variants for different image sizes/formats
      },
    });
    return NextResponse.json(repoImages);
  } catch (error) {
    console.error('Error fetching repository images:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}