import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import prisma from '../../../../prisma/client';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Validate pagination params
    const validLimit = Math.min(Math.max(limit, 1), 100); // Between 1-100
    const validOffset = Math.max(offset, 0);

    const repoImages = await prisma.file.findMany({
      include: {
        folder: true,
        variants: true,
      },
      skip: validOffset,
      take: validLimit,
      orderBy: {
        createdAt: 'desc',
      },
    });

    const serializedImages = repoImages.map(image => ({
      ...image,
      fileSize: image.fileSize.toString(),
      variants: image.variants.map(variant => ({
        ...variant,
        size: variant.size.toString(),
      })),
    }));

    return NextResponse.json(serializedImages);
  } catch (error) {
    console.error('Error fetching repository images:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}