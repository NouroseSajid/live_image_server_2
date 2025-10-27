"use client";

import { useEffect, useState } from 'react';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

interface Image {
  id: string;
  fileName: string;
  folderId: string;
  variants: { path: string }[]; // Assuming variants have a path
}

interface Folder {
  id: string;
  name: string;
  folderThumb: string | null;
  uniqueUrl: string;
}

function LiveView() {
  const [liveImages, setLiveImages] = useState<Image[]>([]);
  const [latestImage, setLatestImage] = useState<Image | null>(null);
  const [open, setOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetchLiveImages();
  }, []);

  const fetchLiveImages = async () => {
    const res = await fetch('/api/images/live');
    if (res.ok) {
      const data: Image[] = await res.json();
      setLiveImages(data);
      if (data.length > 0) {
        setLatestImage(data[0]); // Assuming the first one is the latest
      }
    } else {
      console.error('Failed to fetch live images');
    }
  };

  const slides = liveImages.map((image) => ({
    src: image.variants[0]?.path || '/placeholder-image.jpg',
    alt: image.fileName,
  }));

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Blurred background with latest image */}
      {latestImage && (
        <div
          className="absolute inset-0 bg-cover bg-center filter blur-lg transition-all duration-500 ease-in-out"
          style={{ backgroundImage: `url(${latestImage.variants[0]?.path || '/placeholder-live-bg.jpg'})` }}
        ></div>
      )}
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-white p-4">
        <h2 className="text-4xl font-bold mb-4">Live Gallery</h2>
        {/* Latest image thumbnail */}
        {latestImage && (
          <img
            src={latestImage.variants[0]?.path || '/placeholder-latest-live.jpg'}
            alt={latestImage.fileName}
            className="w-64 h-48 object-cover rounded-lg shadow-lg mb-4 cursor-pointer transform transition-transform duration-300 hover:scale-105"
            onClick={() => { setCurrentIndex(0); setOpen(true); }}
          />
        )}
        {/* Archive thumbnail placeholder */}
        <img src="/placeholder-archive.jpg" alt="Archive" className="w-32 h-24 object-cover rounded-lg shadow-md mb-4"/>
        <a href="https://repo.nourose.com" className="text-blue-300 hover:underline text-lg mb-8">Visit Repo</a>

        <h3 className="text-2xl font-semibold mb-4">More Live Images</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4 overflow-y-auto max-h-[calc(100vh-300px)]">
          {liveImages.map((image, index) => (
            <div key={image.id} className="relative group cursor-pointer"
                 onClick={() => { setCurrentIndex(index); setOpen(true); }}>
              <img
                src={image.variants[0]?.path || '/placeholder-image.jpg'}
                alt={image.fileName}
                className="w-full h-32 object-cover rounded-lg shadow-md transform transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black bg-opacity-25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg">
                <p className="text-white text-sm font-medium">View</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Lightbox
        open={open}
        close={() => setOpen(false)}
        slides={slides}
        currentIndex={currentIndex}
      />
    </div>
  );
}

function RepoView() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [repoImages, setRepoImages] = useState<Image[]>([]);
  const [open, setOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetchFolders();
    fetchRepoImages();
  }, []);

  const fetchFolders = async () => {
    const res = await fetch('/api/folders');
    if (res.ok) {
      const data: Folder[] = await res.json();
      setFolders(data);
    } else {
      console.error('Failed to fetch folders');
    }
  };

  const fetchRepoImages = async () => {
    const res = await fetch('/api/images/repo');
    if (res.ok) {
      const data: Image[] = await res.json();
      setRepoImages(data);
    } else {
      console.error('Failed to fetch repository images');
    }
  };

  const slides = repoImages.map((image) => ({
    src: image.variants[0]?.path || '/placeholder-image.jpg',
    alt: image.fileName,
  }));

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Blurred background placeholder */}
      <div className="absolute inset-0 bg-cover bg-center filter blur-lg" style={{ backgroundImage: "url('/placeholder-repo-bg.jpg')" }}></div>
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-white p-4">
        <h2 className="text-4xl font-bold mb-8">Repository</h2>

        <h3 className="text-2xl font-semibold mb-4">Folders</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4 overflow-y-auto max-h-[calc(50vh-100px)] mb-8">
          {folders.map((folder) => (
            <div key={folder.id} className="relative group cursor-pointer">
              <img
                src={folder.folderThumb || '/placeholder-folder.jpg'}
                alt={folder.name}
                className="w-full h-32 object-cover rounded-lg shadow-md transform transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black bg-opacity-25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg">
                <p className="text-white text-sm font-medium">{folder.name}</p>
              </div>
            </div>
          ))}
        </div>

        <h3 className="text-2xl font-semibold mb-4">Images in Grid View</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4 overflow-y-auto max-h-[calc(50vh-100px)]">
          {repoImages.map((image, index) => (
            <div key={image.id} className="relative group cursor-pointer"
                 onClick={() => { setCurrentIndex(index); setOpen(true); }}>
              <img
                src={image.variants[0]?.path || '/placeholder-image.jpg'}
                alt={image.fileName}
                className="w-full h-32 object-cover rounded-lg shadow-md transform transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black bg-opacity-25 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg">
                <p className="text-white text-sm font-medium">View</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Lightbox
        open={open}
        close={() => setOpen(false)}
        slides={slides}
        currentIndex={currentIndex}
      />
    </div>
  );
}

export default function Home() {
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    setIsLive(process.env.NEXT_PUBLIC_WHAT_AM_I === "1");
  }, []);

  return (
    <main>
      {isLive ? <LiveView /> : <RepoView />}
    </main>
  );
}