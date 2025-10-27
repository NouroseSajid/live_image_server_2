import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import prisma from '../../../../prisma/client';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const cookies = request.cookies;
  const { searchParams } = new URL(request.url);
  const uniqueUrl = searchParams.get('uniqueUrl');

  if (!uniqueUrl) {
    return new NextResponse('Missing uniqueUrl parameter', { status: 400 });
  }

  try {
    const folder = await prisma.folder.findUnique({
      where: { uniqueUrl },
      include: {
        files: {
          include: {
            variants: true,
          },
        },
      },
    });

    if (!folder) {
      return new NextResponse('Folder not found', { status: 404 });
    }

    if (folder.isPrivate) {
      const authCookieName = `folder_auth_${folder.id}`;
      if (!cookies.has(authCookieName) || cookies.get(authCookieName)?.value !== 'true') {
        return new NextResponse('Unauthorized: Private folder', { status: 401 });
      }
    }

    return NextResponse.json(folder.files);
  } catch (error) {
    console.error('Error fetching repo images:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
