import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import prisma from '../../../prisma/client';
import slugify from 'slugify';
import { Prisma } from '@prisma/client';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const folders = await prisma.folder.findMany();
    return NextResponse.json(folders);
  } catch (error) {
    console.error('Error fetching folders:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const body = await request.json();
    let { name, isPrivate, visible, passphrase, inGridView, folderThumb } = body;

    if (!name) {
    return NextResponse.json({ error: 'Missing folder name' }, { status: 400 });
    }

    let baseSlug = slugify(name, { lower: true, strict: true });
    let uniqueUrl = baseSlug;
    let counter = 1;
    while (await prisma.folder.findUnique({ where: { uniqueUrl } })) {
      uniqueUrl = `${baseSlug}-${counter}`;
      counter++;
    }

    const newFolder = await prisma.folder.create({
      data: {
        name,
        isPrivate: isPrivate || false,
        visible: visible || false,
        uniqueUrl,
        passphrase,
        inGridView: inGridView || false,
        folderThumb,
      },
    });

    return NextResponse.json(newFolder, { status: 201 });
  } catch (error) {
    console.error('Error creating folder:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Unique constraint failed
      if (error.code === 'P2002') {
        return NextResponse.json({ error: 'A record with this unique field already exists' }, { status: 409 });
      }
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}