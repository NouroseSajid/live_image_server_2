import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import prisma from '../../../../prisma/client';
import slugify from 'slugify';

interface RouteParams {
  id: string;
}

interface RouteContext {
  params: RouteParams;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const folder = await prisma.folder.findUnique({
      where: { id: params.id },
    });

    if (!folder) {
      return new NextResponse('Folder not found', { status: 404 });
    }

    return NextResponse.json(folder);
  } catch (error) {
    console.error('Error fetching folder:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const body = await request.json();
    let { name, isPrivate, visible, passphrase, inGridView, folderThumb } = body;

    if (!name) {
      return new NextResponse('Missing folder name', { status: 400 });
    }

    // Fetch the existing folder to compare name changes
    const existingFolder = await prisma.folder.findUnique({ where: { id: params.id } });
    if (!existingFolder) {
      return new NextResponse('Folder not found', { status: 404 });
    }

    let updatedUniqueUrl = existingFolder.uniqueUrl;

    // If name changed, regenerate uniqueUrl
    if (name !== existingFolder.name) {
      let baseSlug = slugify(name, { lower: true, strict: true });
      let slug = baseSlug;
      let counter = 1;
      while (await prisma.folder.findFirst({ where: { uniqueUrl: slug, id: { not: params.id } } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      updatedUniqueUrl = slug;
    }

    const updatedFolder = await prisma.folder.update({
      where: { id: params.id },
      data: {
        name,
        isPrivate,
        visible,
        uniqueUrl: updatedUniqueUrl,
        passphrase,
        inGridView,
        folderThumb,
      },
    });

    return NextResponse.json(updatedFolder);
  } catch (error) {
    console.error('Error updating folder:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    await prisma.folder.delete({
      where: { id: params.id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error deleting folder:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}