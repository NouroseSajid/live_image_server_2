import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import prisma from '../../../../prisma/client';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const cookies = request.cookies;

  try {
    const liveImages = await prisma.file.findMany({
      where: {
        isLive: true,
      },
      include: {
        folder: true,
        variants: true,
      },
    });

    const filteredImages = liveImages.filter(image => {
      if (image.folder?.isPrivate) {
        const authCookieName = `folder_auth_${image.folder.id}`;
        return cookies.has(authCookieName) && cookies.get(authCookieName)?.value === 'true';
      }
      return true; // Public images are always returned
    });

    return NextResponse.json(filteredImages);
  } catch (error) {
    console.error('Error fetching live images:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}